// DFSP Module 5 — VoiceSampleService
// Diamond Financial Security Platform™ — OmniQuest Media Inc.
// Consent-gated voice sample collection and retention management for
// high-value Diamond transaction verification.
//
// Two-Phase Write Exception (documented per M5-VOICE-SAMPLE-COLLECTION directive):
//   VoiceSample uses a two-phase write pattern: recordConsent() creates the
//   pre-entry (consent captured, file_reference = ''), then collectSample()
//   updates that pre-entry to attach the file_reference and duration.
//   This UPDATE on the consent pre-entry is the documented exception for this
//   service — analogous to the OtpEvent status-update exception in DFSP-001.
//   All other tables in this service remain strictly append-only.
//
// Disposal Update Exception (documented per M5-VOICE-SAMPLE-COLLECTION directive):
//   disposeSample() sets disposed_at on an existing record where disposed_at
//   was previously NULL. This is the documented disposal UPDATE exception for
//   this service — the record transitions from active to disposed in a single
//   auditable write. No other fields are modified during disposal.

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NatsService } from '../nats/nats.service';
import { NATS_TOPICS } from '../../../nats/topics.registry';
import { GovernanceConfig } from '../governance/governance.config';

// ── Result codes ─────────────────────────────────────────────────────────────

export type RecordConsentResultCode = 'CONSENT_RECORDED' | 'LIMIT_REACHED';
export type CollectSampleResultCode =
  | 'COLLECTED'
  | 'CONSENT_NOT_FOUND'
  | 'INVALID_FILE_REFERENCE'
  | 'DURATION_TOO_SHORT';
export type DisposeSampleResultCode = 'DISPOSED' | 'SAMPLE_NOT_FOUND' | 'ALREADY_DISPOSED';

// ── Result shapes ─────────────────────────────────────────────────────────────

export interface RecordConsentResult {
  code: RecordConsentResultCode;
  sample_id?: string;
  sample_sequence?: number;
  account_id: string;
  rule_applied_id: string;
}

export interface CollectSampleResult {
  code: CollectSampleResultCode;
  sample_id?: string;
  file_reference?: string;
  rule_applied_id: string;
}

export interface GetSampleCountResult {
  count: number;
  remaining: number;
  maxCount: number;
  rule_applied_id: string;
}

export interface DisposeSampleResult {
  code: DisposeSampleResultCode;
  sample_id?: string;
  disposed_at?: string;
  rule_applied_id: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class VoiceSampleService {
  private readonly logger = new Logger(VoiceSampleService.name);
  private readonly RULE_ID = 'VOICE_SAMPLE_v1';

  constructor(
    private readonly prisma: PrismaService,
    private readonly nats: NatsService,
  ) {}

  /**
   * Phase 1 of two-phase write: records consent and creates the pre-entry.
   * Sets consent_given = true, consent_timestamp = now(), and file_reference = ''
   * (file not yet collected). Assigns the next available sample_sequence (1–3).
   * Rejects if the account already has DFSP_VOICE_SAMPLE_MAX_COUNT non-disposed samples.
   *
   * Two-phase write exception: the pre-entry created here will be updated by
   * collectSample() — see file-level comment for the documented exception rationale.
   */
  async recordConsent(params: {
    accountId: string;
    agentId: string;
    transactionId?: string;
    orgId: string;
    tenantId: string;
  }): Promise<RecordConsentResult> {
    const maxCount = GovernanceConfig.DFSP_VOICE_SAMPLE_MAX_COUNT;

    // Count existing non-disposed samples for this account
    const existing = await this.prisma.voiceSample.findMany({
      where: { account_id: params.accountId, disposed_at: null },
      select: { sample_sequence: true },
    });

    if (existing.length >= maxCount) {
      this.logger.warn('VoiceSampleService: sample limit reached', {
        account_id: params.accountId,
        count: existing.length,
        rule_applied_id: this.RULE_ID,
      });
      this.nats.publish(NATS_TOPICS.DFSP_VOICE_SAMPLE_LIMIT_REACHED, {
        account_id: params.accountId,
        count: existing.length,
        max_count: maxCount,
        rule_applied_id: this.RULE_ID,
      });
      return {
        code: 'LIMIT_REACHED',
        account_id: params.accountId,
        rule_applied_id: this.RULE_ID,
      };
    }

    // Determine next available sample_sequence
    const usedSequences = new Set(existing.map((s) => s.sample_sequence));
    let nextSequence = 1;
    while (usedSequences.has(nextSequence) && nextSequence <= maxCount) {
      nextSequence++;
    }

    const now = new Date();
    const retentionDays = GovernanceConfig.DFSP_VOICE_SAMPLE_RETENTION_DAYS;
    const retentionUntil = new Date(now);
    retentionUntil.setDate(retentionUntil.getDate() + retentionDays);

    // Phase 1 write: consent pre-entry (file_reference = '' — file not yet collected)
    const record = await this.prisma.voiceSample.create({
      data: {
        account_id: params.accountId,
        transaction_id: params.transactionId ?? null,
        agent_id: params.agentId,
        recorded_at: now,
        file_reference: '',
        consent_given: true,
        consent_timestamp: now,
        sample_sequence: nextSequence,
        retention_until: retentionUntil,
        organization_id: params.orgId,
        tenant_id: params.tenantId,
      },
    });

    this.logger.log('VoiceSampleService: consent recorded', {
      sample_id: record.id,
      account_id: params.accountId,
      sample_sequence: nextSequence,
      rule_applied_id: this.RULE_ID,
    });

    this.nats.publish(NATS_TOPICS.DFSP_VOICE_SAMPLE_CONSENT_RECORDED, {
      sample_id: record.id,
      account_id: params.accountId,
      sample_sequence: nextSequence,
      agent_id: params.agentId,
      transaction_id: params.transactionId ?? null,
      rule_applied_id: this.RULE_ID,
    });

    return {
      code: 'CONSENT_RECORDED',
      sample_id: record.id,
      sample_sequence: nextSequence,
      account_id: params.accountId,
      rule_applied_id: this.RULE_ID,
    };
  }

  /**
   * Phase 2 of two-phase write: attaches the file reference and duration to the
   * consent pre-entry created by recordConsent().
   *
   * Two-phase write exception: this UPDATE completes the pre-entry created in
   * recordConsent(). Consent must already exist and be true; only file_reference,
   * duration_seconds, and agent_id are written here — see file-level comment.
   */
  async collectSample(params: {
    sampleId: string;
    fileReference: string;
    durationSeconds?: number;
    agentId: string;
  }): Promise<CollectSampleResult> {
    if (!params.fileReference || params.fileReference.trim() === '') {
      return {
        code: 'INVALID_FILE_REFERENCE',
        rule_applied_id: this.RULE_ID,
      };
    }

    const minDuration = GovernanceConfig.DFSP_VOICE_SAMPLE_MIN_DURATION_SECONDS;
    if (params.durationSeconds !== undefined && params.durationSeconds < minDuration) {
      return {
        code: 'DURATION_TOO_SHORT',
        rule_applied_id: this.RULE_ID,
      };
    }

    // Locate the consent pre-entry
    const existing = await this.prisma.voiceSample.findUnique({
      where: { id: params.sampleId },
    });

    if (!existing || !existing.consent_given) {
      this.logger.warn('VoiceSampleService: consent pre-entry not found', {
        sample_id: params.sampleId,
        rule_applied_id: this.RULE_ID,
      });
      return {
        code: 'CONSENT_NOT_FOUND',
        rule_applied_id: this.RULE_ID,
      };
    }

    // Phase 2 write: attach file_reference, duration_seconds, and agent_id.
    // agent_id is intentionally set here because the collecting agent may differ
    // from the consenting agent recorded in Phase 1. The schema carries a single
    // agent_id field representing the agent who physically collected the sample.
    const updated = await this.prisma.voiceSample.update({
      where: { id: params.sampleId },
      data: {
        file_reference: params.fileReference,
        duration_seconds: params.durationSeconds ?? null,
        agent_id: params.agentId,
      },
    });

    this.logger.log('VoiceSampleService: sample collected', {
      sample_id: updated.id,
      account_id: updated.account_id,
      file_reference: updated.file_reference,
      rule_applied_id: this.RULE_ID,
    });

    this.nats.publish(NATS_TOPICS.DFSP_VOICE_SAMPLE_COLLECTED, {
      sample_id: updated.id,
      account_id: updated.account_id,
      sample_sequence: updated.sample_sequence,
      agent_id: updated.agent_id,
      transaction_id: updated.transaction_id ?? null,
      rule_applied_id: this.RULE_ID,
    });

    return {
      code: 'COLLECTED',
      sample_id: updated.id,
      file_reference: updated.file_reference,
      rule_applied_id: this.RULE_ID,
    };
  }

  /**
   * Returns the count of non-disposed samples for an account (disposed_at IS NULL).
   * Used upstream to enforce the max-sample cap before agent workflows proceed.
   */
  async getSampleCount(accountId: string): Promise<GetSampleCountResult> {
    const maxCount = GovernanceConfig.DFSP_VOICE_SAMPLE_MAX_COUNT;
    const count = await this.prisma.voiceSample.count({
      where: { account_id: accountId, disposed_at: null },
    });
    return {
      count,
      remaining: Math.max(0, maxCount - count),
      maxCount,
      rule_applied_id: this.RULE_ID,
    };
  }

  /**
   * Marks a sample as disposed by setting disposed_at = now().
   *
   * Disposal update exception: this UPDATE sets disposed_at on a record where
   * disposed_at was previously NULL. This is the documented disposal exception for
   * this service — no other fields are modified — see file-level comment.
   */
  async disposeSample(params: {
    sampleId: string;
    agentId: string;
    reason: string;
  }): Promise<DisposeSampleResult> {
    const existing = await this.prisma.voiceSample.findUnique({
      where: { id: params.sampleId },
    });

    if (!existing) {
      return {
        code: 'SAMPLE_NOT_FOUND',
        rule_applied_id: this.RULE_ID,
      };
    }

    if (existing.disposed_at !== null) {
      return {
        code: 'ALREADY_DISPOSED',
        sample_id: existing.id,
        disposed_at: existing.disposed_at.toISOString(),
        rule_applied_id: this.RULE_ID,
      };
    }

    const now = new Date();
    // Disposal update: sets disposed_at only — documented exception per directive
    const updated = await this.prisma.voiceSample.update({
      where: { id: params.sampleId },
      data: { disposed_at: now },
    });

    this.logger.log('VoiceSampleService: sample disposed', {
      sample_id: updated.id,
      account_id: updated.account_id,
      agent_id: params.agentId,
      reason: params.reason,
      disposed_at: now.toISOString(),
      rule_applied_id: this.RULE_ID,
    });

    this.nats.publish(NATS_TOPICS.DFSP_VOICE_SAMPLE_DISPOSED, {
      sample_id: updated.id,
      account_id: updated.account_id,
      agent_id: params.agentId,
      reason: params.reason,
      disposed_at: now.toISOString(),
      rule_applied_id: this.RULE_ID,
    });

    return {
      code: 'DISPOSED',
      sample_id: updated.id,
      disposed_at: now.toISOString(),
      rule_applied_id: this.RULE_ID,
    };
  }
}
