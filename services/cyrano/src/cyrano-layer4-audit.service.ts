// PAYLOAD 5+ — Cyrano Layer 4 audit log
// Phase 0 / Phase 2 (Layer 4 v1) — every Layer 4 decision (allow OR deny)
// is appended here with a SHA-256 hash of the redacted payload.
//
// SOC 2 / HIPAA-style invariants enforced here:
//   • Append-only — recordDecision() only ever PUSHES to the in-process
//     log; there is no update or delete path. Phase 2 wires the same
//     surface into the immutable_audit_events table via
//     ImmutableAuditService for a hash-chained ledger.
//   • Each row carries correlation_id + reason_code + rule_applied_id.
//   • Payload is hashed (canonical JSON) — never logs raw PII.
//   • A NATS audit event fires for every record so subscribers (SIEM,
//     observability) get a real-time stream.

import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { NATS_TOPICS } from '../../nats/topics.registry';
import {
  CYRANO_LAYER4_RULE_ID,
  type CyranoLayer4AuditRecord,
  type CyranoLayer4ReasonCode,
} from './cyrano-layer4.types';

export interface RecordDecisionInput {
  tenant_id: string;
  api_key_id: string | null;
  endpoint: string;
  reason_code: CyranoLayer4ReasonCode;
  outcome: 'ALLOW' | 'DENY';
  correlation_id: string;
  payload: Record<string, unknown>;
}

/** Genesis hash matches ImmutableAuditService convention. */
const GENESIS_HASH = '0'.repeat(64);

/** Audit record extended with hash-chain pointers. */
export interface CyranoLayer4ChainedAuditRecord extends CyranoLayer4AuditRecord {
  hash_prior: string | null;
  hash_current: string;
  sequence_number: number;
}

export interface CyranoLayer4ChainVerifyResult {
  valid: boolean;
  events_verified: number;
  first_failure_audit_id: string | null;
  failure_reason: string | null;
  verified_at_utc: string;
  rule_applied_id: string;
}

@Injectable()
export class CyranoLayer4AuditService {
  private readonly logger = new Logger(CyranoLayer4AuditService.name);
  /** Append-only chained log. Phase 2 wires through ImmutableAuditService when available. */
  private readonly records: CyranoLayer4ChainedAuditRecord[] = [];
  /** correlation_id → audit_id index for idempotent emission. */
  private readonly byCorrelation = new Map<string, string>();

  constructor(private readonly nats: NatsService) {}

  recordDecision(input: RecordDecisionInput): CyranoLayer4ChainedAuditRecord {
    if (!input.correlation_id) {
      throw new Error('CYRANO_LAYER4_AUDIT_MISSING_CORRELATION_ID');
    }

    // Idempotent emission: a duplicate correlation_id returns the original
    // chained row without re-extending the chain.
    const existingId = this.byCorrelation.get(input.correlation_id);
    if (existingId) {
      const found = this.records.find((r) => r.audit_id === existingId);
      if (found) {
        this.logger.log('CyranoLayer4AuditService: duplicate emit — returning existing', {
          audit_id: found.audit_id,
          correlation_id: input.correlation_id,
          rule_applied_id: CYRANO_LAYER4_RULE_ID,
        });
        return { ...found };
      }
    }

    const audit_id = randomUUID();
    const emitted_at_utc = new Date().toISOString();
    const payload_hash = this.hashCanonical({
      ...input.payload,
      tenant_id: input.tenant_id,
      api_key_id: input.api_key_id,
      endpoint: input.endpoint,
      reason_code: input.reason_code,
      outcome: input.outcome,
    });

    const tail = this.records[this.records.length - 1];
    const hash_prior = tail ? tail.hash_current : null;
    const sequence_number = (tail?.sequence_number ?? 0) + 1;
    const hash_current = createHash('sha256')
      .update((hash_prior ?? GENESIS_HASH) + payload_hash)
      .digest('hex');

    const record: CyranoLayer4ChainedAuditRecord = {
      audit_id,
      tenant_id: input.tenant_id,
      api_key_id: input.api_key_id,
      endpoint: input.endpoint,
      reason_code: input.reason_code,
      outcome: input.outcome,
      correlation_id: input.correlation_id,
      payload_hash,
      hash_prior,
      hash_current,
      sequence_number,
      rule_applied_id: CYRANO_LAYER4_RULE_ID,
      emitted_at_utc,
    };

    // Append-only — never mutate prior rows.
    this.records.push(record);
    this.byCorrelation.set(input.correlation_id, audit_id);

    this.logger.log('CyranoLayer4AuditService: decision recorded', {
      audit_id,
      tenant_id: input.tenant_id,
      api_key_id: input.api_key_id,
      endpoint: input.endpoint,
      reason_code: input.reason_code,
      outcome: input.outcome,
      correlation_id: input.correlation_id,
      sequence_number,
      rule_applied_id: CYRANO_LAYER4_RULE_ID,
    });

    this.nats.publish(NATS_TOPICS.CYRANO_LAYER4_AUDIT_RECORDED, {
      audit_id,
      tenant_id: input.tenant_id,
      api_key_id: input.api_key_id,
      endpoint: input.endpoint,
      reason_code: input.reason_code,
      outcome: input.outcome,
      correlation_id: input.correlation_id,
      payload_hash,
      hash_prior,
      hash_current,
      sequence_number,
      rule_applied_id: CYRANO_LAYER4_RULE_ID,
      emitted_at_utc,
    });

    return { ...record };
  }

  /** Read records for a tenant — defensive copies, append order preserved. */
  listForTenant(tenant_id: string): CyranoLayer4ChainedAuditRecord[] {
    return this.records.filter((r) => r.tenant_id === tenant_id).map((r) => ({ ...r }));
  }

  /** Total count across all tenants — useful for dashboards. */
  size(): number {
    return this.records.length;
  }

  /**
   * Walk the chain and confirm hash_current = SHA-256(hash_prior || payload_hash)
   * for every row, plus that hash_prior matches the previous row's hash_current.
   */
  verifyChain(): CyranoLayer4ChainVerifyResult {
    const verified_at_utc = new Date().toISOString();
    for (let i = 0; i < this.records.length; i++) {
      const r = this.records[i];
      const expectedPrior = i === 0 ? null : this.records[i - 1].hash_current;
      if (r.hash_prior !== expectedPrior) {
        return {
          valid: false,
          events_verified: i,
          first_failure_audit_id: r.audit_id,
          failure_reason: `hash_prior mismatch at sequence ${r.sequence_number}`,
          verified_at_utc,
          rule_applied_id: CYRANO_LAYER4_RULE_ID,
        };
      }
      const recomputed = createHash('sha256')
        .update((r.hash_prior ?? GENESIS_HASH) + r.payload_hash)
        .digest('hex');
      if (recomputed !== r.hash_current) {
        return {
          valid: false,
          events_verified: i,
          first_failure_audit_id: r.audit_id,
          failure_reason: `hash_current mismatch at sequence ${r.sequence_number}`,
          verified_at_utc,
          rule_applied_id: CYRANO_LAYER4_RULE_ID,
        };
      }
    }
    return {
      valid: true,
      events_verified: this.records.length,
      first_failure_audit_id: null,
      failure_reason: null,
      verified_at_utc,
      rule_applied_id: CYRANO_LAYER4_RULE_ID,
    };
  }

  /** Test seam — wipe the in-memory log. Never call from prod. */
  reset(): void {
    this.records.length = 0;
    this.byCorrelation.clear();
  }

  private hashCanonical(value: unknown): string {
    return createHash('sha256').update(this.canonicalise(value)).digest('hex');
  }

  private canonicalise(value: unknown): string {
    return JSON.stringify(this.sortDeep(value), (_k, v) =>
      typeof v === 'bigint' ? v.toString() : v,
    );
  }

  private sortDeep(value: unknown): unknown {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map((v) => this.sortDeep(v));
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => [k, this.sortDeep(v)] as const);
    return Object.fromEntries(entries);
  }
}
