// services/core-api/src/compliance/audit-chain.service.ts
// GOV: Hash-chained audit event service — Corpus v10 Chapter 7, S5 + Appendix D
// Each event is hash-linked: E(n) = HASH(E(n-1) + E(n))
// SHA-256 is the required algorithm (per WormExportService precedent).
import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { NatsService } from '../nats/nats.service';
import { NATS_TOPICS } from '../../../nats/topics.registry';

export const GENESIS_HASH = '0'.repeat(64);

const RULE_ID = 'AUDIT_CHAIN_v1';

export interface AuditChainEvent {
  event_id: string;
  prior_hash: string;
  stored_hash: string;
  payload: object;
  created_at_utc: string;
}

export interface AuditChainVerificationResult {
  valid: boolean;
  events_verified: number;
  first_failure_event_id: string | null;
  failure_reason: string | null;
  verified_at_utc: string;
  rule_applied_id: string;
}

@Injectable()
export class AuditChainService {
  private readonly logger = new Logger(AuditChainService.name);

  constructor(private readonly nats: NatsService) {}

  /**
   * Computes SHA-256 hash of prior_hash + JSON.stringify(event_payload).
   */
  computeEventHash(prior_hash: string, event_payload: object): string {
    const input = prior_hash + JSON.stringify(event_payload);
    return createHash('sha256').update(input).digest('hex');
  }

  /**
   * Replays the chain and confirms each stored hash matches the computed hash.
   * Publishes NATS event on integrity failure.
   */
  verifyChain(events: AuditChainEvent[]): AuditChainVerificationResult {
    const now = new Date().toISOString();

    if (events.length === 0) {
      return {
        valid: true,
        events_verified: 0,
        first_failure_event_id: null,
        failure_reason: null,
        verified_at_utc: now,
        rule_applied_id: RULE_ID,
      };
    }

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const expected_prior = i === 0 ? GENESIS_HASH : events[i - 1].stored_hash;

      // Verify prior_hash linkage
      if (event.prior_hash !== expected_prior) {
        const reason = `prior_hash mismatch at index ${i}: expected ${expected_prior}, got ${event.prior_hash}`;
        this.logger.error('AuditChainService: CHAIN INTEGRITY FAILURE', {
          event_id: event.event_id,
          index: i,
          reason,
          rule_applied_id: RULE_ID,
        });
        this.nats.publish(NATS_TOPICS.AUDIT_CHAIN_INTEGRITY_FAILURE, {
          event_id: event.event_id,
          index: i,
          reason,
          rule_applied_id: RULE_ID,
          detected_at_utc: now,
        });
        return {
          valid: false,
          events_verified: i,
          first_failure_event_id: event.event_id,
          failure_reason: reason,
          verified_at_utc: now,
          rule_applied_id: RULE_ID,
        };
      }

      // Verify stored hash matches recomputed hash
      const computed = this.computeEventHash(event.prior_hash, event.payload);
      if (computed !== event.stored_hash) {
        const reason = `stored_hash mismatch at index ${i}: computed ${computed}, stored ${event.stored_hash}`;
        this.logger.error('AuditChainService: CHAIN INTEGRITY FAILURE', {
          event_id: event.event_id,
          index: i,
          reason,
          rule_applied_id: RULE_ID,
        });
        this.nats.publish(NATS_TOPICS.AUDIT_CHAIN_INTEGRITY_FAILURE, {
          event_id: event.event_id,
          index: i,
          reason,
          rule_applied_id: RULE_ID,
          detected_at_utc: now,
        });
        return {
          valid: false,
          events_verified: i,
          first_failure_event_id: event.event_id,
          failure_reason: reason,
          verified_at_utc: now,
          rule_applied_id: RULE_ID,
        };
      }
    }

    this.logger.log('AuditChainService: chain verified', {
      events_verified: events.length,
      rule_applied_id: RULE_ID,
    });

    return {
      valid: true,
      events_verified: events.length,
      first_failure_event_id: null,
      failure_reason: null,
      verified_at_utc: now,
      rule_applied_id: RULE_ID,
    };
  }
}
