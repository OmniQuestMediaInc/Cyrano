// services/core-api/src/payments/webhook-hardening.service.ts
// FIZ: PROC-001 — Webhook Hardening Service
// Gate: CEO-AUTHORIZED-STAGED-2026-04-10
// Scope (LOCKED by gate): webhook infrastructure only.
//   - NO ledger writes
//   - NO balance columns
//   - NO transaction execution
// Purpose: multi-processor webhook normalization layer providing signature
// validation, replay-attack prevention, and idempotency dedup BEFORE any
// downstream service consumes a processor event. Supported processors:
// Stripe, CCBill, Epoch. Failures are NATS-broadcast for compliance review
// and optionally routed to an advisory dead letter queue.
import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { NatsService } from '../nats/nats.service';
import { NATS_TOPICS } from '../../../nats/topics.registry';
import { GovernanceConfig } from '../governance/governance.config';

// ── Public types ──────────────────────────────────────────────────────────

export type ProcessorId = 'stripe' | 'ccbill' | 'epoch';

export type ValidationFailureReason =
  | 'PROCESSOR_UNSUPPORTED'
  | 'MALFORMED_INPUT'
  | 'REPLAY_WINDOW_EXCEEDED'
  | 'NONCE_ALREADY_SEEN'
  | 'SIGNATURE_INVALID'
  | 'EVENT_ID_DUPLICATE';

export interface WebhookValidationInput {
  /** Processor identifier. Must be one of the supported processors. */
  processor_id: ProcessorId;
  /** Processor-assigned event identifier used for idempotency dedup. */
  event_id: string;
  /** Unix timestamp (seconds) of the webhook as asserted by the processor. */
  timestamp_seconds: number;
  /** Hex-encoded signature as delivered by the processor. */
  signature: string;
  /** Webhook signing secret for this processor. Never logged. */
  signing_secret: string;
  /** Raw request body, byte-exact. Required for signature recomputation. */
  raw_body: string;
  /** Optional per-processor nonce. Present for processors that send one. */
  nonce?: string;
}

export interface ValidationResult {
  valid: boolean;
  processor_id: ProcessorId | string;
  event_id: string;
  failure_reason: ValidationFailureReason | null;
  rule_applied_id: string;
}

export interface DeadLetterInput {
  processor_id: ProcessorId;
  event_id: string;
  failure_reason: ValidationFailureReason;
  raw_body: string;
}

// ── Internal types ────────────────────────────────────────────────────────

interface TtlEntry {
  expires_at_ms: number;
}

@Injectable()
export class WebhookHardeningService {
  private readonly logger = new Logger(WebhookHardeningService.name);
  private readonly RULE_ID = 'WEBHOOK_HARDENING_v1';

  /**
   * Append-only in-process stores. Entries are inserted on first observation
   * and harvested on TTL expiry — never mutated. A Redis / Postgres backing
   * store is introduced in a later PROC directive; this module defines the
   * contract so the swap is a drop-in replacement.
   */
  private readonly nonceStore = new Map<string, TtlEntry>();
  private readonly eventIdStore = new Map<string, TtlEntry>();

  constructor(private readonly nats: NatsService) {}

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Validates a webhook against the hardening chain:
   *   1. Processor support check
   *   2. Malformed-input check
   *   3. Replay window (timestamp drift ≤ GovernanceConfig.WEBHOOK_REPLAY_WINDOW_SECONDS)
   *   4. Nonce uniqueness (when the processor supplies one)
   *   5. Per-processor signature validation
   *   6. event_id idempotency dedup
   *
   * Returns a ValidationResult. This method performs NO ledger writes and
   * NO transaction execution — it is an infrastructure guard only.
   */
  validate(input: WebhookValidationInput): ValidationResult {
    // 1. Processor supported?
    if (!this.isProcessorSupported(input.processor_id)) {
      return this.reject(
        { processor_id: input.processor_id, event_id: input.event_id },
        'PROCESSOR_UNSUPPORTED',
      );
    }

    // 2. Input sanity. No secrets ever logged.
    if (!this.isInputWellFormed(input)) {
      return this.reject(
        { processor_id: input.processor_id, event_id: input.event_id },
        'MALFORMED_INPUT',
      );
    }

    // 3. Replay window
    if (!this.isWithinReplayWindow(input.timestamp_seconds)) {
      return this.reject(
        { processor_id: input.processor_id, event_id: input.event_id },
        'REPLAY_WINDOW_EXCEEDED',
      );
    }

    // 4. Nonce (when supplied)
    if (input.nonce && this.hasSeenNonce(input.processor_id, input.nonce)) {
      return this.reject(
        { processor_id: input.processor_id, event_id: input.event_id },
        'NONCE_ALREADY_SEEN',
      );
    }

    // 5. Signature validation
    if (!this.isSignatureValid(input)) {
      return this.reject(
        { processor_id: input.processor_id, event_id: input.event_id },
        'SIGNATURE_INVALID',
      );
    }

    // 6. Idempotency — event_id dedup MUST precede any ledger write.
    if (this.hasSeenEventId(input.processor_id, input.event_id)) {
      return this.reject(
        { processor_id: input.processor_id, event_id: input.event_id },
        'EVENT_ID_DUPLICATE',
      );
    }

    // Record event_id (and nonce, if any) append-only.
    this.recordEventId(input.processor_id, input.event_id);
    if (input.nonce) {
      this.recordNonce(input.processor_id, input.nonce);
    }

    this.logger.log('WebhookHardeningService: webhook accepted', {
      processor_id: input.processor_id,
      event_id: input.event_id,
      rule_applied_id: this.RULE_ID,
    });

    return {
      valid: true,
      processor_id: input.processor_id,
      event_id: input.event_id,
      failure_reason: null,
      rule_applied_id: this.RULE_ID,
    };
  }

  /**
   * Dead Letter Queue hook — advisory only. Publishes to WEBHOOK_DLQ topic
   * for human review. No automatic re-processing. No body contents are
   * published; consumers receive only processor_id, event_id, failure_reason,
   * and a byte length for triage.
   */
  sendToDeadLetterQueue(params: DeadLetterInput): void {
    this.logger.warn('WebhookHardeningService: dead letter queued (advisory)', {
      processor_id: params.processor_id,
      event_id: params.event_id,
      failure_reason: params.failure_reason,
      rule_applied_id: this.RULE_ID,
    });
    this.nats.publish(NATS_TOPICS.WEBHOOK_DLQ, {
      processor_id: params.processor_id,
      event_id: params.event_id,
      failure_reason: params.failure_reason,
      body_byte_length: params.raw_body.length,
      rule_applied_id: this.RULE_ID,
    });
  }

  // ── Internal: processor support ─────────────────────────────────────────

  private isProcessorSupported(id: string): id is ProcessorId {
    return id === 'stripe' || id === 'ccbill' || id === 'epoch';
  }

  private isInputWellFormed(input: WebhookValidationInput): boolean {
    if (!input.event_id || typeof input.event_id !== 'string') return false;
    if (!input.signature || typeof input.signature !== 'string') return false;
    if (!input.signing_secret || typeof input.signing_secret !== 'string') return false;
    if (typeof input.raw_body !== 'string') return false;
    if (typeof input.timestamp_seconds !== 'number') return false;
    return true;
  }

  // ── Internal: replay window ─────────────────────────────────────────────

  private isWithinReplayWindow(timestampSeconds: number): boolean {
    if (!Number.isFinite(timestampSeconds)) return false;
    const nowSec = Math.floor(Date.now() / 1000);
    const drift = Math.abs(nowSec - timestampSeconds);
    return drift <= GovernanceConfig.WEBHOOK_REPLAY_WINDOW_SECONDS;
  }

  // ── Internal: signature validation (per-processor) ──────────────────────

  private isSignatureValid(input: WebhookValidationInput): boolean {
    try {
      switch (input.processor_id) {
        case 'stripe': {
          // Stripe: HMAC-SHA256 over `${timestamp}.${raw_body}`.
          const signedPayload = `${input.timestamp_seconds}.${input.raw_body}`;
          return this.verifyHmacSha256(signedPayload, input.signing_secret, input.signature);
        }
        case 'ccbill': {
          // CCBill: HMAC-SHA256 over `${event_id}.${timestamp}.${raw_body}`.
          // The full CCBill DataLink proprietary envelope is layered in at
          // processor integration time; the baseline HMAC is enforced here.
          const signedPayload = `${input.event_id}.${input.timestamp_seconds}.${input.raw_body}`;
          return this.verifyHmacSha256(signedPayload, input.signing_secret, input.signature);
        }
        case 'epoch': {
          // Epoch: SHA-256 digest over (raw_body || shared_secret).
          return this.verifyEpochDigest(input.raw_body, input.signing_secret, input.signature);
        }
      }
    } catch (err) {
      // Never include the signing secret or raw body in the log line.
      this.logger.warn('WebhookHardeningService: signature validation threw', {
        processor_id: input.processor_id,
        event_id: input.event_id,
        error_class: err instanceof Error ? err.name : 'Unknown',
      });
      return false;
    }
    return false;
  }

  private verifyHmacSha256(payload: string, secret: string, providedSignature: string): boolean {
    const expected = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
    return this.constantTimeEquals(expected, providedSignature);
  }

  private verifyEpochDigest(body: string, secret: string, providedSignature: string): boolean {
    const expected = crypto
      .createHash('sha256')
      .update(body + secret, 'utf8')
      .digest('hex');
    return this.constantTimeEquals(expected, providedSignature);
  }

  private constantTimeEquals(a: string, b: string): boolean {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.length !== b.length) return false;
    try {
      return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
    } catch {
      return false;
    }
  }

  // ── Internal: nonce dedup ───────────────────────────────────────────────

  private nonceKey(processor: ProcessorId, nonce: string): string {
    return `${processor}::${nonce}`;
  }

  private hasSeenNonce(processor: ProcessorId, nonce: string): boolean {
    this.harvestExpired(this.nonceStore);
    return this.nonceStore.has(this.nonceKey(processor, nonce));
  }

  private recordNonce(processor: ProcessorId, nonce: string): void {
    const ttlMs = GovernanceConfig.WEBHOOK_NONCE_STORE_TTL_SECONDS * 1000;
    this.nonceStore.set(this.nonceKey(processor, nonce), {
      expires_at_ms: Date.now() + ttlMs,
    });
  }

  // ── Internal: event_id idempotency ──────────────────────────────────────

  private eventIdKey(processor: ProcessorId, eventId: string): string {
    return `${processor}::${eventId}`;
  }

  private hasSeenEventId(processor: ProcessorId, eventId: string): boolean {
    this.harvestExpired(this.eventIdStore);
    return this.eventIdStore.has(this.eventIdKey(processor, eventId));
  }

  private recordEventId(processor: ProcessorId, eventId: string): void {
    const ttlMs = GovernanceConfig.WEBHOOK_NONCE_STORE_TTL_SECONDS * 1000;
    this.eventIdStore.set(this.eventIdKey(processor, eventId), {
      expires_at_ms: Date.now() + ttlMs,
    });
  }

  private harvestExpired(store: Map<string, TtlEntry>): void {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.expires_at_ms <= now) {
        store.delete(key);
      }
    }
  }

  // ── Internal: rejection path ────────────────────────────────────────────

  private reject(
    ref: { processor_id: string; event_id: string },
    failure_reason: ValidationFailureReason,
  ): ValidationResult {
    this.logger.warn('WebhookHardeningService: webhook rejected', {
      processor_id: ref.processor_id,
      event_id: ref.event_id,
      failure_reason,
      rule_applied_id: this.RULE_ID,
    });
    this.nats.publish(NATS_TOPICS.WEBHOOK_VALIDATION_FAILURE, {
      processor_id: ref.processor_id,
      event_id: ref.event_id,
      failure_reason,
      rule_applied_id: this.RULE_ID,
    });
    return {
      valid: false,
      processor_id: ref.processor_id,
      event_id: ref.event_id,
      failure_reason,
      rule_applied_id: this.RULE_ID,
    };
  }
}
