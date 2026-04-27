// DFSP Module 4 — AccountRecoveryHoldService
// Spec: DFSP Engineering Spec v1.0, Module 4 — 48-hour security hold
// triggered by contact-info swap attacks or DFSP_OTP_MAX_ATTEMPTS consecutive
// OTP failures during a high-value transaction. Tightly coupled to
// PlatformOtpService (Module 3) — subscribes to DFSP_OTP_FAILED.
//
// Append-only exception (documented): the AccountHold schema carries release
// fields (released_at, released_by, release_reason, identity_reverified) on
// the same row as the hold itself. Release therefore transitions the
// existing row from held to released in a single auditable write — analogous
// to VoiceSample's disposal-update exception and OtpEvent's status-update
// exception per PV-001 schema design. No other fields are modified during
// release; no AccountHold row is ever deleted. All other tables in this
// service remain strictly append-only (Invariant #1).
//
// Failure counter window (per directive):
//   Counter resets on DFSP_OTP_VERIFIED for the same account_id OR on OTP
//   TTL expiry — whichever comes first. Both are natural properties of
//   OtpEvent lifecycle: a new OtpEvent has failed_attempts = 0, and expired
//   events are no longer eligible for verification. The threshold check
//   inspects OtpEvent.failed_attempts of the specific event that failed,
//   which resets naturally with each new OTP issuance.
//
// CEO authorization required to shorten hold below 48h — not implemented
// here; deferred until a CEO clearance directive authorizes that path.

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NatsService } from '../nats/nats.service';
import { NATS_TOPICS } from '../../../nats/topics.registry';
import { GovernanceConfig } from '../governance/governance.config';

// ── Types ────────────────────────────────────────────────────────────────────

export type HoldTriggerType = 'contact_change' | 'otp_5_fail' | 'agent_flag';

export type ApplyHoldResultCode = 'HOLD_PLACED' | 'ALREADY_HELD';

export type ReleaseHoldResultCode =
  | 'HOLD_RELEASED'
  | 'HOLD_NOT_FOUND'
  | 'RELEASE_CONDITIONS_NOT_MET';

export type HoldedAction = 'purchase' | 'gifting' | 'withdrawal' | 'login' | 'settings_change';

export type EnforcementDecision = 'BLOCKED' | 'PERMITTED';

export interface ApplyHoldParams {
  accountId: string;
  triggerType: HoldTriggerType;
  triggerTransactionId?: string;
  organizationId: string;
  tenantId: string;
}

export interface ApplyHoldResult {
  code: ApplyHoldResultCode;
  hold_id?: string;
  account_id: string;
  trigger_type: HoldTriggerType;
  triggered_at?: string;
  hold_until?: string;
  rule_applied_id: string;
}

export interface ReleaseHoldParams {
  holdId: string;
  releasedBy: string;
  releaseReason: string;
  identityReverified: boolean;
  agentSignOff: boolean;
}

export interface ReleaseHoldResult {
  code: ReleaseHoldResultCode;
  hold_id: string;
  account_id?: string;
  released_at?: string;
  conditions_unmet?: string[];
  rule_applied_id: string;
}

export interface EnforceActionParams {
  accountId: string;
  action: HoldedAction;
}

export interface EnforceActionResult {
  decision: EnforcementDecision;
  hold_id?: string;
  action: HoldedAction;
  rule_applied_id: string;
}

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class AccountRecoveryHoldService implements OnModuleInit {
  private readonly logger = new Logger(AccountRecoveryHoldService.name);
  private readonly RULE_ID = 'ACCOUNT_RECOVERY_HOLD_v1';

  constructor(
    private readonly prisma: PrismaService,
    private readonly nats: NatsService,
  ) {}

  /**
   * Module 3 → Module 4 coupling.
   * Subscribes to DFSP_OTP_FAILED and auto-applies a 48h hold when the
   * OtpEvent.failed_attempts counter has reached DFSP_OTP_MAX_ATTEMPTS for
   * the account.
   */
  onModuleInit(): void {
    this.nats.subscribe(NATS_TOPICS.DFSP_OTP_FAILED, (payload) => {
      this.handleOtpFailed(payload).catch((err) => {
        this.logger.error('AccountRecoveryHoldService: OTP_FAILED handler error', err, {
          rule_applied_id: this.RULE_ID,
        });
      });
    });
    this.logger.log('AccountRecoveryHoldService: subscribed to DFSP_OTP_FAILED', {
      rule_applied_id: this.RULE_ID,
    });
  }

  /**
   * Consumes DFSP_OTP_FAILED events. When the OtpEvent for that account has
   * accumulated DFSP_OTP_MAX_ATTEMPTS consecutive failures, apply an
   * `otp_5_fail` hold. Idempotent — active-hold guard in applyHold() prevents
   * duplicate holds on re-delivery.
   */
  private async handleOtpFailed(payload: Record<string, unknown>): Promise<void> {
    const accountId = typeof payload.account_id === 'string' ? payload.account_id : null;
    const failedAttempts =
      typeof payload.failed_attempts === 'number' ? payload.failed_attempts : null;
    const organizationId =
      typeof payload.organization_id === 'string' ? payload.organization_id : null;
    const tenantId = typeof payload.tenant_id === 'string' ? payload.tenant_id : null;
    const otpEventId = typeof payload.otp_event_id === 'string' ? payload.otp_event_id : null;

    if (!accountId || failedAttempts === null || !organizationId || !tenantId) {
      this.logger.warn('AccountRecoveryHoldService: OTP_FAILED payload incomplete — skipping', {
        has_account_id: !!accountId,
        has_failed_attempts: failedAttempts !== null,
        has_org_id: !!organizationId,
        has_tenant_id: !!tenantId,
        rule_applied_id: this.RULE_ID,
      });
      return;
    }

    if (failedAttempts < GovernanceConfig.DFSP_OTP_MAX_ATTEMPTS) {
      return;
    }

    this.logger.warn('AccountRecoveryHoldService: OTP failure threshold reached', {
      account_id: accountId,
      failed_attempts: failedAttempts,
      otp_event_id: otpEventId,
      rule_applied_id: this.RULE_ID,
    });

    await this.applyHold({
      accountId,
      triggerType: 'otp_5_fail',
      triggerTransactionId: otpEventId ?? undefined,
      organizationId,
      tenantId,
    });
  }

  /**
   * Place a recovery hold. Idempotent — returns ALREADY_HELD if an active
   * (non-released) hold already exists for the account.
   */
  async applyHold(params: ApplyHoldParams): Promise<ApplyHoldResult> {
    const existingActive = await this.prisma.accountHold.findFirst({
      where: { account_id: params.accountId, released_at: null },
      orderBy: { triggered_at: 'desc' },
    });

    if (existingActive) {
      this.logger.log('AccountRecoveryHoldService: hold already active — skipping', {
        account_id: params.accountId,
        existing_hold_id: existingActive.id,
        rule_applied_id: this.RULE_ID,
      });
      return {
        code: 'ALREADY_HELD',
        hold_id: existingActive.id,
        account_id: params.accountId,
        trigger_type: existingActive.trigger_type as HoldTriggerType,
        triggered_at: existingActive.triggered_at.toISOString(),
        hold_until: existingActive.hold_until.toISOString(),
        rule_applied_id: this.RULE_ID,
      };
    }

    const triggeredAt = new Date();
    const holdUntil = new Date(
      triggeredAt.getTime() + GovernanceConfig.DFSP_ACCOUNT_RECOVERY_HOLD_HOURS * 60 * 60 * 1000,
    );

    const record = await this.prisma.accountHold.create({
      data: {
        account_id: params.accountId,
        trigger_type: params.triggerType,
        trigger_transaction_id: params.triggerTransactionId ?? null,
        triggered_at: triggeredAt,
        hold_until: holdUntil,
        identity_reverified: false,
        organization_id: params.organizationId,
        tenant_id: params.tenantId,
      },
    });

    this.logger.warn('AccountRecoveryHoldService: hold placed', {
      hold_id: record.id,
      account_id: params.accountId,
      trigger_type: params.triggerType,
      triggered_at: triggeredAt.toISOString(),
      hold_until: holdUntil.toISOString(),
      rule_applied_id: this.RULE_ID,
    });

    this.nats.publish(NATS_TOPICS.DFSP_ACCOUNT_HOLD_APPLIED, {
      hold_id: record.id,
      account_id: params.accountId,
      trigger_type: params.triggerType,
      trigger_transaction_id: params.triggerTransactionId ?? null,
      triggered_at: triggeredAt.toISOString(),
      hold_until: holdUntil.toISOString(),
      organization_id: params.organizationId,
      tenant_id: params.tenantId,
      rule_applied_id: this.RULE_ID,
    });

    return {
      code: 'HOLD_PLACED',
      hold_id: record.id,
      account_id: params.accountId,
      trigger_type: params.triggerType,
      triggered_at: triggeredAt.toISOString(),
      hold_until: holdUntil.toISOString(),
      rule_applied_id: this.RULE_ID,
    };
  }

  /**
   * Release a hold. All three conditions must be satisfied:
   *   1. identity_reverified = true
   *   2. hold_until elapsed
   *   3. Agent sign-off
   *
   * CEO authorization is required to shorten a hold below 48h — not
   * implemented here; deferred as a separate CEO-authorized directive.
   */
  async releaseHold(params: ReleaseHoldParams): Promise<ReleaseHoldResult> {
    const record = await this.prisma.accountHold.findUnique({
      where: { id: params.holdId },
    });

    if (!record) {
      return {
        code: 'HOLD_NOT_FOUND',
        hold_id: params.holdId,
        rule_applied_id: this.RULE_ID,
      };
    }

    if (record.released_at !== null) {
      // Already released — surface as HOLD_NOT_FOUND for an active hold search.
      return {
        code: 'HOLD_NOT_FOUND',
        hold_id: params.holdId,
        account_id: record.account_id,
        rule_applied_id: this.RULE_ID,
      };
    }

    const now = new Date();
    const conditionsUnmet: string[] = [];
    if (!params.identityReverified) conditionsUnmet.push('identity_reverified');
    if (record.hold_until.getTime() > now.getTime()) conditionsUnmet.push('hold_until_elapsed');
    if (!params.agentSignOff) conditionsUnmet.push('agent_sign_off');

    if (conditionsUnmet.length > 0) {
      this.logger.warn('AccountRecoveryHoldService: release conditions not met', {
        hold_id: record.id,
        account_id: record.account_id,
        conditions_unmet: conditionsUnmet,
        rule_applied_id: this.RULE_ID,
      });
      return {
        code: 'RELEASE_CONDITIONS_NOT_MET',
        hold_id: record.id,
        account_id: record.account_id,
        conditions_unmet: conditionsUnmet,
        rule_applied_id: this.RULE_ID,
      };
    }

    // Documented AccountHold release-update exception — see file-level comment.
    const released = await this.prisma.accountHold.update({
      where: { id: record.id },
      data: {
        released_at: now,
        released_by: params.releasedBy,
        release_reason: params.releaseReason,
        identity_reverified: params.identityReverified,
      },
    });

    this.logger.log('AccountRecoveryHoldService: hold released', {
      hold_id: released.id,
      account_id: released.account_id,
      released_by: params.releasedBy,
      released_at: now.toISOString(),
      rule_applied_id: this.RULE_ID,
    });

    this.nats.publish(NATS_TOPICS.DFSP_ACCOUNT_HOLD_RELEASED, {
      hold_id: released.id,
      account_id: released.account_id,
      released_by: params.releasedBy,
      release_reason: params.releaseReason,
      identity_reverified: params.identityReverified,
      released_at: now.toISOString(),
      rule_applied_id: this.RULE_ID,
    });

    return {
      code: 'HOLD_RELEASED',
      hold_id: released.id,
      account_id: released.account_id,
      released_at: now.toISOString(),
      rule_applied_id: this.RULE_ID,
    };
  }

  /**
   * Enforce hold semantics for an attempted action.
   *   purchases:         BLOCKED
   *   gifting:           BLOCKED
   *   withdrawals:       BLOCKED
   *   login:             PERMITTED (read-only)
   *   settings_changes:  BLOCKED
   *
   * If no active hold exists, all actions PERMITTED — upstream guards remain
   * responsible for non-hold authorization.
   */
  async enforceAction(params: EnforceActionParams): Promise<EnforceActionResult> {
    const active = await this.prisma.accountHold.findFirst({
      where: { account_id: params.accountId, released_at: null },
      orderBy: { triggered_at: 'desc' },
    });

    if (!active) {
      return {
        decision: 'PERMITTED',
        action: params.action,
        rule_applied_id: this.RULE_ID,
      };
    }

    const decision: EnforcementDecision = params.action === 'login' ? 'PERMITTED' : 'BLOCKED';

    if (decision === 'BLOCKED') {
      this.logger.warn('AccountRecoveryHoldService: action blocked by active hold', {
        hold_id: active.id,
        account_id: params.accountId,
        action: params.action,
        rule_applied_id: this.RULE_ID,
      });
    }

    return {
      decision,
      hold_id: active.id,
      action: params.action,
      rule_applied_id: this.RULE_ID,
    };
  }
}
