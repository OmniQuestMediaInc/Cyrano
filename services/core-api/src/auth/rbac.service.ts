// services/core-api/src/auth/rbac.service.ts
// PAYLOAD 6 — RBAC service: decision + audit + step-up coordination.
// Canonical Corpus v10 Chapter 7 §8.1 + Appendix E.
//
// Wraps RbacGuard (pure decision) with:
//   (1) ImmutableAuditService emission for every non-public check.
//   (2) Step-up requirement derivation for irreversible actions.
//   (3) Human-authorization boundary — any permission paired with a
//       StepUpAction returns { step_up_required: true } until a verified
//       StepUpVerificationResult is presented.
//
// ANY service that gates a mutation MUST route through RbacService.authorize()
// and honour the returned { permitted, step_up_required } tuple.

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RbacGuard, RbacRole } from './rbac.guard';
import { StepUpAction, StepUpVerificationResult } from './step-up.service';
import { ImmutableAuditService } from '../audit/immutable-audit.service';

export const RBAC_SERVICE_RULE_ID = 'RBAC_SERVICE_v1';

/**
 * Permissions that require step-up auth (TOTP / backup code) BEFORE the
 * underlying mutation is allowed. Mirrors the Corpus §8.2 list:
 *   - Wallet mutations / payout changes
 *   - Refunds / Three-Fifths Exit
 *   - Account freeze / suspension
 *   - GateGuard overrides / compliance overrides
 *   - Content deletion / takedown / legal hold
 *   - Geo block / role management
 */
const PERMISSION_TO_STEP_UP: Record<string, StepUpAction> = {
  'refund:override':      'REFUND_OVERRIDE',
  'suspension:override':  'ACCOUNT_FREEZE',
  'ncii:suppress':        'CONTENT_DELETION',
  'legal_hold:trigger':   'TAKEDOWN_SUBMISSION',
  'geo_block:modify':     'GEO_BLOCK_MODIFICATION',
  'rate_card:configure':  'PAYOUT_CHANGE',
  'worm:export':          'WALLET_MODIFICATION',
};

export interface AuthorizeParams {
  actor_id: string;
  actor_role: RbacRole;
  permission: string;
  correlation_id?: string;
  /**
   * Verified step-up result, if the caller has completed a challenge for
   * this action. Required for permissions that map to a StepUpAction.
   */
  step_up_verification?: StepUpVerificationResult | null;
  /**
   * Non-sensitive context for the audit trail (resource id, reason, etc).
   */
  context?: Record<string, unknown>;
}

export interface AuthorizeResult {
  permitted: boolean;
  step_up_required: boolean;
  required_step_up_action: StepUpAction | null;
  actor_id: string;
  actor_role: RbacRole;
  permission: string;
  correlation_id: string;
  failure_reason: string | null;
  rule_applied_id: string;
}

@Injectable()
export class RbacService {
  private readonly logger = new Logger(RbacService.name);
  private readonly RULE_ID = RBAC_SERVICE_RULE_ID;

  constructor(
    private readonly guard: RbacGuard,
    private readonly audit: ImmutableAuditService,
  ) {}

  requiresStepUp(permission: string): StepUpAction | null {
    return PERMISSION_TO_STEP_UP[permission] ?? null;
  }

  /**
   * Single entry point for permission checks across the platform.
   * Emits an immutable audit event for every decision (ALLOW or DENY)
   * and requires a verified step-up result for step-up-gated permissions.
   */
  async authorize(params: AuthorizeParams): Promise<AuthorizeResult> {
    const correlation_id = params.correlation_id ?? `rbac_${randomUUID()}`;
    const guardResult = this.guard.check({
      actor_id: params.actor_id,
      actor_role: params.actor_role,
      permission: params.permission,
    });

    const required_step_up = this.requiresStepUp(params.permission);
    let step_up_required = false;
    let failure_reason: string | null = guardResult.failure_reason;

    if (guardResult.permitted && required_step_up) {
      const verified =
        params.step_up_verification?.verified === true &&
        params.step_up_verification.action === required_step_up &&
        params.step_up_verification.actor_id === params.actor_id;
      if (!verified) {
        step_up_required = true;
        failure_reason = 'STEP_UP_REQUIRED';
      }
    }

    const permitted = guardResult.permitted && !step_up_required;

    await this.audit.emit({
      eventType: 'RBAC_DECISION',
      correlationId: correlation_id,
      actorId: params.actor_id,
      actorRole: this.mapRoleForAudit(params.actor_role),
      reasonCode: permitted ? 'RBAC_ALLOW' : failure_reason ?? 'RBAC_DENY',
      redactedPayload: {
        permission: params.permission,
        required_role: guardResult.required_role,
        required_step_up: required_step_up ?? null,
        context: params.context ?? {},
      },
      metadata: {
        actor_role: params.actor_role,
        permission: params.permission,
        step_up_required,
      },
    });

    const result: AuthorizeResult = {
      permitted,
      step_up_required,
      required_step_up_action: required_step_up,
      actor_id: params.actor_id,
      actor_role: params.actor_role,
      permission: params.permission,
      correlation_id,
      failure_reason,
      rule_applied_id: this.RULE_ID,
    };

    if (!permitted) {
      this.logger.warn('RbacService: denied', {
        actor_id: params.actor_id,
        permission: params.permission,
        reason: failure_reason,
        step_up_required,
        correlation_id,
        rule_applied_id: this.RULE_ID,
      });
    } else {
      this.logger.log('RbacService: allowed', {
        actor_id: params.actor_id,
        permission: params.permission,
        correlation_id,
        rule_applied_id: this.RULE_ID,
      });
    }

    return result;
  }

  private mapRoleForAudit(
    role: RbacRole,
  ): 'guest' | 'creator' | 'moderator' | 'compliance' | 'admin' {
    switch (role) {
      case 'VIEWER':     return 'guest';
      case 'CREATOR':    return 'creator';
      case 'MODERATOR':  return 'moderator';
      case 'COMPLIANCE': return 'compliance';
      case 'ADMIN':      return 'admin';
    }
  }
}

// ## HANDOFF
// RbacService is the canonical human-authorization boundary for every
// irreversible action in the platform. Calls flow:
//   controller / service
//     → RbacService.authorize({ actor, role, permission, step_up_verification? })
//       → RbacGuard.check() (decision)
//       → StepUp gate (if permission is in PERMISSION_TO_STEP_UP)
//       → ImmutableAuditService.emit({ event_type: 'RBAC_DECISION' })
//     → { permitted, step_up_required, required_step_up_action, ... }
// Mutation handlers must refuse to execute unless `permitted === true` AND
// `step_up_required === false`. Denial + step-up requirement are both
// captured in the hash-chained audit ledger, satisfying the L0 Canonical
// invariant that "every irreversible action has a human authorization
// record". Next priority: Frontend polish + full end-to-end testing.
