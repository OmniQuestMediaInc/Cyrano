// services/core-api/src/safety/publish-gate.service.ts
// KYC: KYC-001 — Deterministic 18+ publish gate
// Canonical Corpus v10, Chapter 10 §2.2 + Chapter 9 §3.1
// Gate: performer must be >= 18 years old at content recorded_at timestamp.
// Failure: blocks publication, generates SEV1 incident via NATS.
// Override: COMPLIANCE role + step-up only (not implemented here — advisory boundary).
import { Injectable, Logger } from '@nestjs/common';
import { NatsService } from '../nats/nats.service';
import { NATS_TOPICS } from '../../../nats/topics.registry';

export type PublishGateOutcome =
  | 'APPROVED'
  | 'BLOCKED_AGE_GATE'
  | 'BLOCKED_KYC_PENDING'
  | 'BLOCKED_KYC_EXPIRED';

export interface PublishGateResult {
  content_id: string;
  performer_id: string;
  outcome: PublishGateOutcome;
  performer_age_at_recording: number | null;
  gate_passed: boolean;
  blocked_reason: string | null;
  evaluated_at_utc: string;
  rule_applied_id: string;
}

// Minimum age in years — deterministic constant, never hardcoded in callers
const MINIMUM_AGE_YEARS = 18;

@Injectable()
export class PublishGateService {
  private readonly logger = new Logger(PublishGateService.name);
  private readonly RULE_ID = 'PUBLISH_GATE_v1';

  constructor(private readonly nats: NatsService) {}

  /**
   * Calculates the performer's age in completed years at a given reference date.
   * Pure function — no side effects.
   */
  calculateAgeAtDate(dob: Date, reference_date: Date): number {
    let age = reference_date.getFullYear() - dob.getFullYear();
    const monthDiff = reference_date.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && reference_date.getDate() < dob.getDate())) {
      age -= 1;
    }
    return age;
  }

  /**
   * Evaluates whether content may be published.
   * Checks KYC status and 18+ at recorded_at.
   * Publishes SEV1 to NATS on any block.
   * Caller must not publish if gate_passed is false.
   */
  evaluatePublishGate(params: {
    content_id: string;
    performer_id: string;
    performer_dob: Date;
    kyc_status: 'VERIFIED' | 'PENDING' | 'EXPIRED' | 'REJECTED';
    kyc_expiry_date: Date | null;
    recorded_at: Date;
  }): PublishGateResult {
    const evaluated_at_utc = new Date().toISOString();

    // Block 1: KYC must be VERIFIED
    if (params.kyc_status !== 'VERIFIED') {
      const outcome: PublishGateOutcome =
        params.kyc_status === 'EXPIRED' ? 'BLOCKED_KYC_EXPIRED' : 'BLOCKED_KYC_PENDING';

      this.logger.warn('PublishGateService: blocked — KYC not verified', {
        content_id: params.content_id,
        performer_id: params.performer_id,
        kyc_status: params.kyc_status,
        rule_applied_id: this.RULE_ID,
      });

      this.nats.publish(NATS_TOPICS.PUBLISH_GATE_BLOCKED, {
        content_id: params.content_id,
        performer_id: params.performer_id,
        outcome,
        blocked_reason: `KYC_STATUS_${params.kyc_status}`,
        severity: 'SEV1',
        evaluated_at_utc,
        rule_applied_id: this.RULE_ID,
      });

      return {
        content_id: params.content_id,
        performer_id: params.performer_id,
        outcome,
        performer_age_at_recording: null,
        gate_passed: false,
        blocked_reason: `KYC_STATUS_${params.kyc_status}`,
        evaluated_at_utc,
        rule_applied_id: this.RULE_ID,
      };
    }

    // Block 2: KYC must not be expired relative to recorded_at
    if (params.kyc_expiry_date && params.recorded_at > params.kyc_expiry_date) {
      this.logger.warn('PublishGateService: blocked — KYC expired at recording time', {
        content_id: params.content_id,
        performer_id: params.performer_id,
        kyc_expiry_date: params.kyc_expiry_date.toISOString(),
        recorded_at: params.recorded_at.toISOString(),
        rule_applied_id: this.RULE_ID,
      });

      this.nats.publish(NATS_TOPICS.PUBLISH_GATE_BLOCKED, {
        content_id: params.content_id,
        performer_id: params.performer_id,
        outcome: 'BLOCKED_KYC_EXPIRED',
        blocked_reason: 'KYC_EXPIRED_AT_RECORDING_TIME',
        severity: 'SEV1',
        evaluated_at_utc,
        rule_applied_id: this.RULE_ID,
      });

      return {
        content_id: params.content_id,
        performer_id: params.performer_id,
        outcome: 'BLOCKED_KYC_EXPIRED',
        performer_age_at_recording: null,
        gate_passed: false,
        blocked_reason: 'KYC_EXPIRED_AT_RECORDING_TIME',
        evaluated_at_utc,
        rule_applied_id: this.RULE_ID,
      };
    }

    // Block 3: Performer must be >= 18 at recorded_at (not at publish time)
    const age_at_recording = this.calculateAgeAtDate(params.performer_dob, params.recorded_at);

    if (age_at_recording < MINIMUM_AGE_YEARS) {
      this.logger.error('PublishGateService: SEV1 — performer under 18 at recording time', {
        content_id: params.content_id,
        performer_id: params.performer_id,
        age_at_recording,
        recorded_at: params.recorded_at.toISOString(),
        rule_applied_id: this.RULE_ID,
      });

      this.nats.publish(NATS_TOPICS.PUBLISH_GATE_BLOCKED, {
        content_id: params.content_id,
        performer_id: params.performer_id,
        outcome: 'BLOCKED_AGE_GATE',
        blocked_reason: `AGE_AT_RECORDING_${age_at_recording}_BELOW_MINIMUM_${MINIMUM_AGE_YEARS}`,
        severity: 'SEV1',
        age_at_recording,
        evaluated_at_utc,
        rule_applied_id: this.RULE_ID,
      });

      return {
        content_id: params.content_id,
        performer_id: params.performer_id,
        outcome: 'BLOCKED_AGE_GATE',
        performer_age_at_recording: age_at_recording,
        gate_passed: false,
        blocked_reason: `AGE_AT_RECORDING_${age_at_recording}_BELOW_MINIMUM_${MINIMUM_AGE_YEARS}`,
        evaluated_at_utc,
        rule_applied_id: this.RULE_ID,
      };
    }

    // Gate passed
    this.logger.log('PublishGateService: approved', {
      content_id: params.content_id,
      performer_id: params.performer_id,
      age_at_recording,
      rule_applied_id: this.RULE_ID,
    });

    this.nats.publish(NATS_TOPICS.PUBLISH_GATE_APPROVED, {
      content_id: params.content_id,
      performer_id: params.performer_id,
      age_at_recording,
      evaluated_at_utc,
      rule_applied_id: this.RULE_ID,
    });

    return {
      content_id: params.content_id,
      performer_id: params.performer_id,
      outcome: 'APPROVED',
      performer_age_at_recording: age_at_recording,
      gate_passed: true,
      blocked_reason: null,
      evaluated_at_utc,
      rule_applied_id: this.RULE_ID,
    };
  }
}
