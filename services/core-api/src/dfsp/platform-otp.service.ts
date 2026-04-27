// DFSP Module 3 — PlatformOtpService
// Spec: DFSP Engineering Spec v1.0, Module 3 — Platform-native dual-channel OTP
// for Diamond/VIP step-up authentication.
//
// Invariant #4 note: crypto.randomInt() is the correct primitive for OTP code
// generation. Math.random() is prohibited. crypto.randomBytes() is also
// prohibited here — randomInt() provides uniform rejection-sampled indexing
// into the alphabet without modulo-bias.
//
// Invariant #13 carve-out: OtpEvent.code_hash uses bcrypt
// (cost = GovernanceConfig.DFSP_OTP_BCRYPT_COST) per DFSP Engineering Spec
// v1.0 Module 3. Bcrypt is required because SHA-256 is GPU-brute-forceable
// against a 32^7 OTP space on DB breach. Invariant #13's SHA-256 requirement
// continues to apply to every other hash operation in this and every other
// service.
//
// Append-only exception: OTP verification sets `used_at` and transitions
// `status` to CONSUMED on the existing OtpEvent row. This is the documented
// OtpEvent status-update exception per PV-001 schema design. All other
// tables remain strictly append-only (Invariant #1).
//
// Step-up boundary (Invariant #11): this service generates and verifies OTPs
// only. It does not itself authorize financial actions. RBAC (Invariant #12)
// must be checked upstream before an OTP is issued.

import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma.service';
import { NatsService } from '../nats/nats.service';
import { NATS_TOPICS } from '../../../nats/topics.registry';
import { GovernanceConfig } from '../governance/governance.config';

// ── Constants ────────────────────────────────────────────────────────────────

/**
 * 32-character OTP alphabet. Excludes O, 0, I, 1, L (ambiguous). 32 chars gives
 * clean power-of-two indexing; crypto.randomInt(0, 32) is uniform.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const OTP_LENGTH = 7;

// ── Types ────────────────────────────────────────────────────────────────────

export type DeliveryChannel = 'email_primary' | 'email_secondary' | 'sms_secondary';

export type OtpStatus = 'ISSUED' | 'CONSUMED' | 'EXPIRED' | 'LOCKED';

export type IssueOtpResultCode = 'ISSUED';

export type VerifyOtpResultCode = 'VERIFIED' | 'INVALID' | 'EXPIRED' | 'ALREADY_CONSUMED';

export interface IssueOtpParams {
  accountId: string;
  transactionId?: string;
  channel: DeliveryChannel;
  organizationId: string;
  tenantId: string;
}

export interface IssueOtpResult {
  code: IssueOtpResultCode;
  otp_event_id: string;
  /** Display-formatted code: XXXXXX-Y (hyphen after char 6). */
  display_code: string;
  /** Raw 7-char code — callers must deliver over the selected channel then discard. */
  plaintext_code: string;
  channel: DeliveryChannel;
  expires_at: string;
  rule_applied_id: string;
}

export interface VerifyOtpParams {
  otpEventId: string;
  candidateCode: string;
}

export interface VerifyOtpResult {
  code: VerifyOtpResultCode;
  otp_event_id: string;
  account_id?: string;
  failed_attempts?: number;
  rule_applied_id: string;
}

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class PlatformOtpService {
  private readonly logger = new Logger(PlatformOtpService.name);
  private readonly RULE_ID = 'PLATFORM_OTP_v1';

  constructor(
    private readonly prisma: PrismaService,
    private readonly nats: NatsService,
  ) {}

  /**
   * Generate a fresh OTP for the given account. Upstream RBAC check must have
   * already confirmed the caller is entitled to issue step-up auth for this
   * account (Invariant #12).
   *
   * Delivery is stubbed — email/SMS providers are V6 infrastructure. The
   * plaintext code is returned to the caller who is responsible for dispatch
   * over the indicated channel. The channel is persisted on OtpEvent.
   */
  async issueOtp(params: IssueOtpParams): Promise<IssueOtpResult> {
    const plaintext = this.generateOtpCode();
    const displayCode = `${plaintext.slice(0, 6)}-${plaintext.slice(6)}`;

    const codeHash = await bcrypt.hash(plaintext, GovernanceConfig.DFSP_OTP_BCRYPT_COST);

    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + GovernanceConfig.DFSP_OTP_TTL_SECONDS * 1000);

    const record = await this.prisma.otpEvent.create({
      data: {
        account_id: params.accountId,
        transaction_id: params.transactionId ?? null,
        code_hash: codeHash,
        channel: params.channel,
        issued_at: issuedAt,
        expires_at: expiresAt,
        failed_attempts: 0,
        status: 'ISSUED',
        organization_id: params.organizationId,
        tenant_id: params.tenantId,
      },
    });

    this.logger.log('PlatformOtpService: OTP issued', {
      otp_event_id: record.id,
      account_id: params.accountId,
      transaction_id: params.transactionId ?? null,
      channel: params.channel,
      expires_at: expiresAt.toISOString(),
      rule_applied_id: this.RULE_ID,
    });

    this.nats.publish(NATS_TOPICS.DFSP_OTP_ISSUED, {
      otp_event_id: record.id,
      account_id: params.accountId,
      transaction_id: params.transactionId ?? null,
      channel: params.channel,
      issued_at: issuedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      rule_applied_id: this.RULE_ID,
    });

    return {
      code: 'ISSUED',
      otp_event_id: record.id,
      display_code: displayCode,
      plaintext_code: plaintext,
      channel: params.channel,
      expires_at: expiresAt.toISOString(),
      rule_applied_id: this.RULE_ID,
    };
  }

  /**
   * Verify a candidate OTP code against the stored hash.
   *
   * Precedence of outcomes:
   *   1. ALREADY_CONSUMED — if `used_at` is set or status = CONSUMED
   *   2. EXPIRED — if `expires_at` is in the past
   *   3. INVALID (locked) — if `failed_attempts` >= DFSP_OTP_MAX_ATTEMPTS
   *   4. INVALID (wrong code) — bcrypt compare fails; increments failed_attempts
   *   5. VERIFIED — bcrypt compare succeeds; sets used_at and status=CONSUMED
   */
  async verifyOtp(params: VerifyOtpParams): Promise<VerifyOtpResult> {
    const record = await this.prisma.otpEvent.findUnique({
      where: { id: params.otpEventId },
    });

    if (!record) {
      // Treat missing record as INVALID — do not leak existence.
      this.logger.warn('PlatformOtpService: OTP event not found', {
        otp_event_id: params.otpEventId,
        rule_applied_id: this.RULE_ID,
      });
      return {
        code: 'INVALID',
        otp_event_id: params.otpEventId,
        rule_applied_id: this.RULE_ID,
      };
    }

    // ── Precedence: already consumed ──────────────────────────────────────
    if (record.used_at !== null || record.status === 'CONSUMED') {
      this.nats.publish(NATS_TOPICS.DFSP_OTP_FAILED, {
        otp_event_id: record.id,
        account_id: record.account_id,
        reason: 'ALREADY_CONSUMED',
        failed_attempts: record.failed_attempts,
        rule_applied_id: this.RULE_ID,
      });
      return {
        code: 'ALREADY_CONSUMED',
        otp_event_id: record.id,
        account_id: record.account_id,
        failed_attempts: record.failed_attempts,
        rule_applied_id: this.RULE_ID,
      };
    }

    // ── Precedence: expired ───────────────────────────────────────────────
    const now = new Date();
    if (record.expires_at.getTime() < now.getTime()) {
      // Transition to EXPIRED — documented OtpEvent status-update exception.
      await this.prisma.otpEvent.update({
        where: { id: record.id },
        data: { status: 'EXPIRED' },
      });
      this.nats.publish(NATS_TOPICS.DFSP_OTP_EXPIRED, {
        otp_event_id: record.id,
        account_id: record.account_id,
        expired_at: now.toISOString(),
        rule_applied_id: this.RULE_ID,
      });
      return {
        code: 'EXPIRED',
        otp_event_id: record.id,
        account_id: record.account_id,
        failed_attempts: record.failed_attempts,
        rule_applied_id: this.RULE_ID,
      };
    }

    // ── Precedence: locked (max attempts reached) ─────────────────────────
    const maxAttempts = GovernanceConfig.DFSP_OTP_MAX_ATTEMPTS;
    if (record.failed_attempts >= maxAttempts) {
      this.nats.publish(NATS_TOPICS.DFSP_OTP_FAILED, {
        otp_event_id: record.id,
        account_id: record.account_id,
        reason: 'LOCKED',
        failed_attempts: record.failed_attempts,
        rule_applied_id: this.RULE_ID,
      });
      return {
        code: 'INVALID',
        otp_event_id: record.id,
        account_id: record.account_id,
        failed_attempts: record.failed_attempts,
        rule_applied_id: this.RULE_ID,
      };
    }

    // ── Bcrypt compare ────────────────────────────────────────────────────
    const matches = await bcrypt.compare(params.candidateCode, record.code_hash);

    if (!matches) {
      // Increment failure counter — documented OtpEvent update exception.
      const updated = await this.prisma.otpEvent.update({
        where: { id: record.id },
        data: { failed_attempts: { increment: 1 } },
      });

      this.logger.warn('PlatformOtpService: OTP verification failed', {
        otp_event_id: record.id,
        account_id: record.account_id,
        failed_attempts: updated.failed_attempts,
        rule_applied_id: this.RULE_ID,
      });

      // Emit FAILED — AccountRecoveryHoldService consumes this topic and
      // applies a 48-hour hold when failed_attempts >= DFSP_OTP_MAX_ATTEMPTS.
      this.nats.publish(NATS_TOPICS.DFSP_OTP_FAILED, {
        otp_event_id: record.id,
        account_id: record.account_id,
        reason: 'INVALID',
        failed_attempts: updated.failed_attempts,
        organization_id: record.organization_id,
        tenant_id: record.tenant_id,
        rule_applied_id: this.RULE_ID,
      });

      return {
        code: 'INVALID',
        otp_event_id: record.id,
        account_id: record.account_id,
        failed_attempts: updated.failed_attempts,
        rule_applied_id: this.RULE_ID,
      };
    }

    // ── VERIFIED ──────────────────────────────────────────────────────────
    // Documented OtpEvent status-update exception — consume the code.
    const consumed = await this.prisma.otpEvent.update({
      where: { id: record.id },
      data: { used_at: now, status: 'CONSUMED' },
    });

    this.logger.log('PlatformOtpService: OTP verified', {
      otp_event_id: consumed.id,
      account_id: consumed.account_id,
      rule_applied_id: this.RULE_ID,
    });

    this.nats.publish(NATS_TOPICS.DFSP_OTP_VERIFIED, {
      otp_event_id: consumed.id,
      account_id: consumed.account_id,
      transaction_id: consumed.transaction_id ?? null,
      verified_at: now.toISOString(),
      rule_applied_id: this.RULE_ID,
    });

    return {
      code: 'VERIFIED',
      otp_event_id: consumed.id,
      account_id: consumed.account_id,
      failed_attempts: consumed.failed_attempts,
      rule_applied_id: this.RULE_ID,
    };
  }

  /**
   * Uniform random OTP code generation. crypto.randomInt() uses rejection
   * sampling internally so each index is uniformly distributed over the
   * 32-char alphabet — Invariant #4.
   */
  private generateOtpCode(): string {
    let code = '';
    for (let i = 0; i < OTP_LENGTH; i++) {
      code += ALPHABET[randomInt(0, ALPHABET.length)];
    }
    return code;
  }
}
