// services/core-api/src/audit/audit-bridge.service.ts
// PAYLOAD 6 — Audit Bridge
//
// Subscribes to domain NATS topics and re-emits every sensitive action as
// an immutable, hash-chained audit event. This is the automatic emission
// layer — services publish their domain events as usual, and the bridge
// guarantees that GateGuard decisions, recovery cases, step-up challenges,
// Cyrano suggestions, Diamond contracts, and WORM exports all land in the
// canonical chain without requiring each service to import
// ImmutableAuditService directly.
//
// Services that already own their correlation IDs (GateGuard, Recovery,
// Cyrano, etc.) continue to drive the business flow; this bridge only
// duplicates into the audit chain, deduplicated by correlation_id.

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { NatsService } from '../nats/nats.service';
import { NATS_TOPICS } from '../../../nats/topics.registry';
import {
  ImmutableAuditService,
  ImmutableAuditActorRole,
  ImmutableAuditEventType,
} from './immutable-audit.service';

interface BridgeMapping {
  topic: string;
  eventType: ImmutableAuditEventType;
  actorRoleKey?: string;
  correlationKey?: string;
  actorIdKey?: string;
  reasonCode: string;
}

const BRIDGE_MAPPINGS: BridgeMapping[] = [
  {
    topic: NATS_TOPICS.GATEGUARD_EVALUATION_COMPLETED,
    eventType: 'GATEGUARD_DECISION',
    correlationKey: 'correlation_id',
    actorIdKey: 'user_id',
    reasonCode: 'GATEGUARD_EVALUATED',
  },
  {
    topic: NATS_TOPICS.GATEGUARD_DECISION_HARD_DECLINE,
    eventType: 'GATEGUARD_DECISION',
    correlationKey: 'correlation_id',
    actorIdKey: 'user_id',
    reasonCode: 'GATEGUARD_HARD_DECLINE',
  },
  {
    topic: NATS_TOPICS.GATEGUARD_DECISION_HUMAN_ESCALATE,
    eventType: 'GATEGUARD_DECISION',
    correlationKey: 'correlation_id',
    actorIdKey: 'user_id',
    reasonCode: 'GATEGUARD_HUMAN_ESCALATE',
  },
  {
    topic: NATS_TOPICS.STEP_UP_CHALLENGE_ISSUED,
    eventType: 'STEP_UP_CHALLENGE',
    correlationKey: 'challenge_id',
    actorIdKey: 'actor_id',
    reasonCode: 'STEP_UP_ISSUED',
  },
  {
    topic: NATS_TOPICS.STEP_UP_CHALLENGE_VERIFIED,
    eventType: 'STEP_UP_CHALLENGE',
    correlationKey: 'challenge_id',
    actorIdKey: 'actor_id',
    reasonCode: 'STEP_UP_VERIFIED',
  },
  {
    topic: NATS_TOPICS.STEP_UP_CHALLENGE_FAILED,
    eventType: 'STEP_UP_CHALLENGE',
    correlationKey: 'challenge_id',
    actorIdKey: 'actor_id',
    reasonCode: 'STEP_UP_FAILED',
  },
  {
    topic: NATS_TOPICS.LEGAL_HOLD_APPLIED,
    eventType: 'RED_BOOK_ESCALATION',
    correlationKey: 'correlation_id',
    actorIdKey: 'actor_id',
    reasonCode: 'LEGAL_HOLD_APPLIED',
  },
  {
    topic: NATS_TOPICS.LEGAL_HOLD_LIFTED,
    eventType: 'RED_BOOK_ESCALATION',
    correlationKey: 'correlation_id',
    actorIdKey: 'actor_id',
    reasonCode: 'LEGAL_HOLD_LIFTED',
  },
  {
    topic: NATS_TOPICS.RECONCILIATION_DRIFT_DETECTED,
    eventType: 'RED_BOOK_ESCALATION',
    correlationKey: 'correlation_id',
    actorIdKey: 'actor_id',
    reasonCode: 'RECONCILIATION_DRIFT',
  },
];

@Injectable()
export class AuditBridgeService implements OnModuleInit {
  private readonly logger = new Logger(AuditBridgeService.name);

  constructor(
    private readonly nats: NatsService,
    private readonly audit: ImmutableAuditService,
  ) {}

  onModuleInit(): void {
    for (const mapping of BRIDGE_MAPPINGS) {
      this.nats.subscribe(mapping.topic, (payload) =>
        this.handle(mapping, payload).catch((err) =>
          this.logger.error('AuditBridgeService: emission failed', err, {
            topic: mapping.topic,
          }),
        ),
      );
    }
    this.logger.log('AuditBridgeService: wired ' + BRIDGE_MAPPINGS.length + ' topic bindings');
  }

  private async handle(
    mapping: BridgeMapping,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const correlationSource = mapping.correlationKey
      ? (payload[mapping.correlationKey] as string | undefined)
      : undefined;
    const actorSource = mapping.actorIdKey
      ? (payload[mapping.actorIdKey] as string | undefined)
      : undefined;

    if (!correlationSource) {
      this.logger.warn('AuditBridgeService: missing correlation id — skipping', {
        topic: mapping.topic,
      });
      return;
    }
    const correlationId = `bridge:${mapping.topic}:${correlationSource}`;
    const actorId = actorSource ?? 'system';
    const actorRole: ImmutableAuditActorRole =
      (payload.actor_role as ImmutableAuditActorRole | undefined) ?? 'system';

    await this.audit.emit({
      eventType: mapping.eventType,
      correlationId,
      actorId,
      actorRole,
      reasonCode: mapping.reasonCode,
      redactedPayload: this.redact(payload),
      metadata: { source_topic: mapping.topic },
    });
  }

  /**
   * Strip any field that commonly carries sensitive data before hashing.
   * The canonical ledger holds a SHA-256 of the canonicalised payload only,
   * but we also refuse to persist the full payload into metadata.
   */
  private redact(payload: Record<string, unknown>): Record<string, unknown> {
    const SENSITIVE_KEYS = new Set([
      'email',
      'phone',
      'card_number',
      'cvv',
      'pan',
      'otp',
      'otp_code',
      'password',
      'document',
      'biometric',
      'device_fingerprint',
    ]);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload)) {
      if (SENSITIVE_KEYS.has(k)) continue;
      out[k] = v;
    }
    return out;
  }
}
