// services/core-api/src/compliance/legal-hold.service.ts
// AUDIT: AUDIT-002 — Legal hold mechanism
// Canonical Corpus Chapter 7, §13.2
// Overrides retention deletion; reversible only by COMPLIANCE role.
// All hold actions logged and audit-trailed.
// LEGAL-HOLD-DB: Migrated from in-memory Map to Prisma DB store.
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NatsService } from '../nats/nats.service';
import { NATS_TOPICS } from '../../../nats/topics.registry';
import { PrismaService } from '../prisma.service';

export type HoldSubjectType = 'USER' | 'CONTENT' | 'TRANSACTION' | 'INCIDENT';

export interface LegalHoldRecord {
  hold_id: string;
  subject_id: string;
  subject_type: HoldSubjectType;
  applied_by: string;
  applied_at_utc: string;
  lifted_by: string | null;
  lifted_at_utc: string | null;
  reason_code: string;
  rule_applied_id: string;
}

@Injectable()
export class LegalHoldService {
  private readonly logger = new Logger(LegalHoldService.name);
  private readonly RULE_ID = 'LEGAL_HOLD_v1';

  constructor(
    private readonly nats: NatsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Marks a subject as held. Persists to DB. Publishes NATS event.
   * Returns the LegalHoldRecord.
   */
  async applyHold(params: {
    subject_id: string;
    subject_type: HoldSubjectType;
    applied_by: string;
    reason_code: string;
  }): Promise<LegalHoldRecord> {
    const now = new Date();
    const hold_id = randomUUID();

    await this.prisma.legalHold.create({
      data: {
        hold_id,
        subject_id: params.subject_id,
        subject_type: params.subject_type,
        applied_by: params.applied_by,
        applied_at_utc: now,
        reason_code: params.reason_code,
        rule_applied_id: this.RULE_ID,
      },
    });

    const record: LegalHoldRecord = {
      hold_id,
      subject_id: params.subject_id,
      subject_type: params.subject_type,
      applied_by: params.applied_by,
      applied_at_utc: now.toISOString(),
      lifted_by: null,
      lifted_at_utc: null,
      reason_code: params.reason_code,
      rule_applied_id: this.RULE_ID,
    };

    this.logger.log('LegalHoldService: hold applied', {
      hold_id,
      subject_id: params.subject_id,
      subject_type: params.subject_type,
      applied_by: params.applied_by,
      reason_code: params.reason_code,
      rule_applied_id: this.RULE_ID,
    });

    this.nats.publish(NATS_TOPICS.LEGAL_HOLD_APPLIED, {
      hold_id,
      subject_id: params.subject_id,
      subject_type: params.subject_type,
      applied_by: params.applied_by,
      applied_at_utc: now.toISOString(),
      reason_code: params.reason_code,
      rule_applied_id: this.RULE_ID,
    });

    return record;
  }

  /**
   * Lifts a hold on a subject. Requires COMPLIANCE role assertion from caller.
   * Updates lifted_by + lifted_at_utc in DB only (single permitted UPDATE).
   * Logs the lift and publishes NATS event.
   * Throws if no active hold exists for the given subject.
   */
  async liftHold(params: {
    subject_id: string;
    subject_type: HoldSubjectType;
    lifted_by: string;
    reason_code: string;
    caller_role: string;
  }): Promise<LegalHoldRecord> {
    if (params.caller_role !== 'COMPLIANCE') {
      const msg = `LEGAL_HOLD_UNAUTHORIZED: Only COMPLIANCE role may lift holds. Got: ${params.caller_role}`;
      this.logger.error(msg);
      throw new Error(msg);
    }

    const hold = await this.prisma.legalHold.findFirst({
      where: {
        subject_id: params.subject_id,
        subject_type: params.subject_type,
        lifted_at_utc: null,
      },
    });

    if (!hold) {
      const msg = `LEGAL_HOLD_NOT_FOUND: No active hold for ${params.subject_type}:${params.subject_id}`;
      this.logger.error(msg);
      throw new Error(msg);
    }

    const now = new Date();

    // Single permitted UPDATE: lifted_by + lifted_at_utc only
    await this.prisma.legalHold.update({
      where: { id: hold.id },
      data: {
        lifted_by: params.lifted_by,
        lifted_at_utc: now,
      },
    });

    const record: LegalHoldRecord = {
      hold_id: hold.hold_id,
      subject_id: params.subject_id,
      subject_type: params.subject_type,
      applied_by: hold.applied_by,
      applied_at_utc: hold.applied_at_utc.toISOString(),
      lifted_by: params.lifted_by,
      lifted_at_utc: now.toISOString(),
      reason_code: params.reason_code,
      rule_applied_id: this.RULE_ID,
    };

    this.logger.log('LegalHoldService: hold lifted', {
      hold_id: hold.hold_id,
      subject_id: params.subject_id,
      subject_type: params.subject_type,
      lifted_by: params.lifted_by,
      reason_code: params.reason_code,
      rule_applied_id: this.RULE_ID,
    });

    this.nats.publish(NATS_TOPICS.LEGAL_HOLD_LIFTED, {
      hold_id: hold.hold_id,
      subject_id: params.subject_id,
      subject_type: params.subject_type,
      lifted_by: params.lifted_by,
      lifted_at_utc: now.toISOString(),
      reason_code: params.reason_code,
      rule_applied_id: this.RULE_ID,
    });

    return record;
  }

  /**
   * Returns true if the subject currently has an active (un-lifted) hold in DB.
   */
  async isHeld(subject_id: string, subject_type: HoldSubjectType): Promise<boolean> {
    const hold = await this.prisma.legalHold.findFirst({
      where: {
        subject_id,
        subject_type,
        lifted_at_utc: null,
      },
    });
    return hold !== null;
  }
}
