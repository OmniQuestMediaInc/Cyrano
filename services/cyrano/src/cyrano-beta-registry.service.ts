// PAYLOAD 5+ — Cyrano Beta Registry (Issue #16 — Phase 4)
// Manages the allowlist of internal beta creators (20–30 creators).
//
// The registry is intentionally in-process (no DB) for Phase 0 — Phase 1
// moves enrollment to a Prisma-backed beta_creators table with
// correlation_id + reason_code on every row (SCHEMA INTEGRITY invariant).
//
// Invariants:
//   • Max 30 enrolled creators at one time (beta capacity ceiling).
//   • Every enrollment / removal emits a NATS event with correlation_id.
//   • No PII beyond creator_id is held in-process.
//   • correlation_id + reason_code present on every event.

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { NATS_TOPICS } from '../../nats/topics.registry';
import { CYRANO_LAYER4_RULE_ID } from './cyrano-layer4.types';

/** Maximum number of creators that may be enrolled in the beta at any time. */
export const BETA_MAX_CREATORS = 30;

export const BETA_RULE_ID = 'CYRANO_BETA_v1';

export interface BetaCreatorRecord {
  creator_id: string;
  enrolled_at_utc: string;
  correlation_id: string;
  reason_code: string;
  rule_applied_id: string;
}

export interface EnrollBetaCreatorResult {
  enrolled: boolean;
  creator_id: string;
  /** Reason code when enrollment was rejected. */
  rejection_reason?: 'ALREADY_ENROLLED' | 'BETA_CAPACITY_REACHED';
  correlation_id: string;
  rule_applied_id: string;
}

@Injectable()
export class CyranoBetaRegistryService {
  private readonly logger = new Logger(CyranoBetaRegistryService.name);
  private readonly creators = new Map<string, BetaCreatorRecord>();

  constructor(private readonly nats: NatsService) {}

  /** Enroll a creator into the beta. Idempotent on creator_id. */
  enroll(creator_id: string, correlation_id?: string): EnrollBetaCreatorResult {
    const corr = correlation_id ?? randomUUID();

    if (this.creators.has(creator_id)) {
      return {
        enrolled: false,
        creator_id,
        rejection_reason: 'ALREADY_ENROLLED',
        correlation_id: corr,
        rule_applied_id: BETA_RULE_ID,
      };
    }

    if (this.creators.size >= BETA_MAX_CREATORS) {
      this.logger.warn('CyranoBetaRegistryService: beta capacity reached', {
        creator_id,
        current_count: this.creators.size,
        max: BETA_MAX_CREATORS,
        correlation_id: corr,
        rule_applied_id: BETA_RULE_ID,
      });
      return {
        enrolled: false,
        creator_id,
        rejection_reason: 'BETA_CAPACITY_REACHED',
        correlation_id: corr,
        rule_applied_id: BETA_RULE_ID,
      };
    }

    const record: BetaCreatorRecord = {
      creator_id,
      enrolled_at_utc: new Date().toISOString(),
      correlation_id: corr,
      reason_code: 'BETA_CREATOR_ENROLLED',
      rule_applied_id: BETA_RULE_ID,
    };
    this.creators.set(creator_id, record);

    this.nats.publish(NATS_TOPICS.CYRANO_BETA_CREATOR_ENROLLED, {
      creator_id,
      enrolled_at_utc: record.enrolled_at_utc,
      current_count: this.creators.size,
      max: BETA_MAX_CREATORS,
      correlation_id: corr,
      reason_code: 'BETA_CREATOR_ENROLLED',
      rule_applied_id: BETA_RULE_ID,
    });

    this.logger.log('CyranoBetaRegistryService: creator enrolled', {
      creator_id,
      current_count: this.creators.size,
      correlation_id: corr,
      rule_applied_id: BETA_RULE_ID,
    });

    return {
      enrolled: true,
      creator_id,
      correlation_id: corr,
      rule_applied_id: BETA_RULE_ID,
    };
  }

  /** Remove a creator from the beta. */
  remove(creator_id: string, correlation_id?: string): boolean {
    const corr = correlation_id ?? randomUUID();
    const existed = this.creators.delete(creator_id);
    if (existed) {
      this.nats.publish(NATS_TOPICS.CYRANO_BETA_CREATOR_REMOVED, {
        creator_id,
        removed_at_utc: new Date().toISOString(),
        correlation_id: corr,
        reason_code: 'BETA_CREATOR_REMOVED',
        rule_applied_id: BETA_RULE_ID,
      });
      this.logger.log('CyranoBetaRegistryService: creator removed', {
        creator_id,
        correlation_id: corr,
        rule_applied_id: BETA_RULE_ID,
      });
    }
    return existed;
  }

  /** Check whether a creator is currently enrolled in the beta. */
  isEnrolled(creator_id: string): boolean {
    return this.creators.has(creator_id);
  }

  /** Return all enrolled beta creators (defensive copies). */
  listEnrolled(): BetaCreatorRecord[] {
    return Array.from(this.creators.values()).map((r) => ({ ...r }));
  }

  /** Current enrollment count. */
  count(): number {
    return this.creators.size;
  }

  /** Test seam — wipe the registry. Never call from prod. */
  reset(): void {
    this.creators.clear();
  }
}
