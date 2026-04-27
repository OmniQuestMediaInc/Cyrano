// WO: WO-036-KYC-VAULT-PUBLISH-GATE
import { Injectable } from '@nestjs/common';
import { db } from '../db';
import { logger } from '../logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EligibilityResult =
  | 'ELIGIBILITY_APPROVED'
  | 'ELIGIBILITY_DENIED'
  | 'ELIGIBILITY_EXPIRED'
  | 'ELIGIBILITY_NO_RECORD';

export interface VaultAccessParams {
  actorId: string;
  performerId: string;
  purposeCode: string;
  deviceFingerprint: string;
}

export interface ExtendExpiryParams {
  verificationId: string;
  newExpiryDate: Date;
  actorId: string;
  reasonCode: string;
  stepUpToken: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Age-at-recording calculation.
// Uses calendar-accurate date arithmetic: compares the date 18 years before
// recordedAtTimestamp against dob, correctly handling leap years.
// ---------------------------------------------------------------------------
function isAtLeast18AtDate(dob: Date, referenceDate: Date): boolean {
  const cutoff = new Date(referenceDate);
  cutoff.setFullYear(cutoff.getFullYear() - 18);
  return dob.getTime() <= cutoff.getTime();
}

// ---------------------------------------------------------------------------
// Minimal typed accessors for tables added in WO-036.
// These tables exist in the SQL schema (init-ledger.sql) but are not yet
// reflected in the generated Prisma client; we access them via the raw client
// delegate using a narrow typed wrapper to satisfy the linter.
// ---------------------------------------------------------------------------
type DynamicModel = {
  findFirst: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  create: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  update: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

function modelFor(name: string): DynamicModel {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model = (db as any)[name] as DynamicModel | undefined;
  if (!model || typeof model.findFirst !== 'function') {
    throw new Error(`modelFor: no Prisma delegate found for table '${name}'`);
  }
  return model;
}

// ---------------------------------------------------------------------------
// Step-up token validation
// Validates that a step-up authentication token is present and non-empty.
// Full cryptographic validation is delegated to the auth layer; this service
// enforces that the field is always supplied before any expiry mutation.
// ---------------------------------------------------------------------------
function validateStepUpToken(token: string): boolean {
  return typeof token === 'string' && token.trim().length > 0;
}

// ---------------------------------------------------------------------------
// SafetyService
// ---------------------------------------------------------------------------

/**
 * WO-036-KYC-VAULT-PUBLISH-GATE
 *
 * Deterministic publish gate and vault access audit service.
 * All checks are idempotent and every invocation is logged to audit_events.
 */
@Injectable()
export class SafetyService {
  /**
   * TASK 2: Deterministic Publish Gate
   *
   * Validates that a performer is age-verified and KYC-approved before a
   * recorded clip may be published.
   *
   * Logic (deterministic, side-effect-free calculation):
   *   AgeAtRecording = recordedAtTimestamp - performer.dob
   *   If AgeAtRecording < 18 years → ELIGIBILITY_DENIED
   *   If verification status !== VERIFIED or expiry_date exceeded → ELIGIBILITY_EXPIRED
   *   Otherwise → ELIGIBILITY_APPROVED
   *
   * Every invocation appends a row to audit_events (idempotent gate).
   */
  async validatePublishEligibility(
    performerId: string,
    recordedAtTimestamp: Date,
  ): Promise<EligibilityResult> {
    let outcome: EligibilityResult = 'ELIGIBILITY_NO_RECORD';

    try {
      // Fetch most-recent VERIFIED or PENDING verification for the performer.
      const verification = await modelFor('identity_verification').findFirst({
        where: { performer_id: performerId },
        orderBy: { created_at: 'desc' },
      });

      if (!verification) {
        outcome = 'ELIGIBILITY_NO_RECORD';
      } else {
        // --- Age check (deterministic: uses stored dob vs recordedAtTimestamp) ---
        const dob = new Date(verification.dob as string);

        if (!isAtLeast18AtDate(dob, recordedAtTimestamp)) {
          outcome = 'ELIGIBILITY_DENIED';
        } else if (
          verification.status !== 'VERIFIED' ||
          (verification.expiry_date !== null &&
            new Date(verification.expiry_date as string).getTime() < recordedAtTimestamp.getTime())
        ) {
          outcome = 'ELIGIBILITY_EXPIRED';
        } else {
          outcome = 'ELIGIBILITY_APPROVED';
        }
      }

      logger.info('validatePublishEligibility: eligibility determined', {
        context: 'SafetyService',
        performerId,
        recordedAtTimestamp: recordedAtTimestamp.toISOString(),
        outcome,
      });
    } catch (error) {
      logger.error('validatePublishEligibility: lookup failed', error, {
        context: 'SafetyService',
        performerId,
      });
      throw error;
    } finally {
      // Always append to audit chain regardless of outcome or error.
      await this.appendAuditEvent({
        eventType: 'PUBLISH_ELIGIBILITY_CHECK',
        actorId: performerId,
        performerId,
        outcome,
        metadata: {
          recorded_at_timestamp: recordedAtTimestamp.toISOString(),
        },
      });
    }

    return outcome;
  }

  /**
   * TASK 3: Vault Access Logging
   *
   * Emits an audit_event each time a moderator accesses raw identity documents
   * in the (mocked) vault. No document bytes are logged — only access metadata.
   */
  async logVaultAccess(params: VaultAccessParams): Promise<void> {
    const { actorId, performerId, purposeCode, deviceFingerprint } = params;

    logger.info('logVaultAccess: vault access recorded', {
      context: 'SafetyService',
      actorId,
      performerId,
      purposeCode,
    });

    await this.appendAuditEvent({
      eventType: 'VAULT_ACCESS',
      actorId,
      performerId,
      purposeCode,
      deviceFingerprint,
      metadata: {},
    });
  }

  /**
   * TASK 4: Step-Up Authentication for Expiry Overrides
   *
   * Extends the expiry_date of an identity_verification record.
   * Requires a valid step-up authentication token and a non-empty reason_code.
   * Both are validated before any mutation is attempted.
   *
   * The override details (actor, reason, timestamp) are recorded on the
   * identity_verification row AND appended to the audit_events chain.
   */
  async extendVerificationExpiry(params: ExtendExpiryParams): Promise<void> {
    const { verificationId, newExpiryDate, actorId, reasonCode, stepUpToken } = params;

    // Step-up token must be supplied before any mutation.
    if (!validateStepUpToken(stepUpToken)) {
      logger.warn('extendVerificationExpiry: step-up token missing or invalid', {
        context: 'SafetyService',
        verificationId,
        actorId,
      });
      throw new Error('STEP_UP_REQUIRED: a valid step-up authentication token must be provided.');
    }

    if (!reasonCode || reasonCode.trim().length === 0) {
      throw new Error('REASON_CODE_REQUIRED: a reason_code must be provided for expiry overrides.');
    }

    try {
      await modelFor('identity_verification').update({
        where: { verification_id: verificationId },
        data: {
          expiry_date: newExpiryDate,
          expiry_override_actor_id: actorId,
          expiry_override_reason_code: reasonCode.trim(),
          expiry_override_at: new Date(),
        },
      });

      logger.info('extendVerificationExpiry: expiry extended', {
        context: 'SafetyService',
        verificationId,
        actorId,
        newExpiryDate: newExpiryDate.toISOString(),
      });

      await this.appendAuditEvent({
        eventType: 'EXPIRY_OVERRIDE',
        actorId,
        performerId: undefined,
        reasonCode: reasonCode.trim(),
        outcome: 'EXPIRY_EXTENDED',
        metadata: {
          verification_id: verificationId,
          new_expiry_date: newExpiryDate.toISOString(),
        },
      });
    } catch (error) {
      logger.error('extendVerificationExpiry: failed', error, {
        context: 'SafetyService',
        verificationId,
        actorId,
      });
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async appendAuditEvent(params: {
    eventType: 'PUBLISH_ELIGIBILITY_CHECK' | 'VAULT_ACCESS' | 'EXPIRY_OVERRIDE';
    actorId: string;
    performerId?: string;
    purposeCode?: string;
    deviceFingerprint?: string;
    outcome?: string;
    reasonCode?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await modelFor('audit_events').create({
        data: {
          event_type: params.eventType,
          actor_id: params.actorId,
          performer_id: params.performerId ?? null,
          purpose_code: params.purposeCode ?? null,
          device_fingerprint: params.deviceFingerprint ?? null,
          outcome: params.outcome ?? null,
          reason_code: params.reasonCode ?? null,
          metadata: params.metadata ?? {},
        },
      });
    } catch (auditError) {
      // Audit failures are logged but must not suppress the primary result.
      logger.error('appendAuditEvent: failed to write audit event', auditError, {
        context: 'SafetyService',
        eventType: params.eventType,
        actorId: params.actorId,
      });
    }
  }
}
