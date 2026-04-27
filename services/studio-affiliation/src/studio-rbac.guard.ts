// services/studio-affiliation/src/studio-rbac.guard.ts
// RBAC-STUDIO-001 — studio-scoped permission guard.
//
// Two-layer RBAC for studio actions:
//   (1) Platform RBAC (RbacService): permission must be in the platform
//       PERMISSION_MATRIX (e.g. "studio:manage" → CREATOR or above).
//   (2) Studio-scoped role (this guard): the actor must have an ACTIVE
//       StudioAffiliation with the required StudioRole on the target studio.
//
// Required-role mapping per the technical spec §4 RBAC Matrix:
//   studio:manage           → STUDIO_OWNER
//   studio:invite-creator   → STUDIO_OWNER | STUDIO_ADMIN
//   studio:view-affiliations→ STUDIO_OWNER | STUDIO_ADMIN | CREATOR (any member)
//   studio:upload-contract  → STUDIO_OWNER | STUDIO_ADMIN
//   studio:view-commission  → STUDIO_OWNER | STUDIO_ADMIN  (PLATFORM_ADMIN
//                              bypasses this guard via RbacService)
//
// Every decision (ALLOW or DENY) is captured in the immutable audit ledger
// with reason_code STUDIO_RBAC_ALLOW / STUDIO_RBAC_DENY.

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../core-api/src/prisma.service';
import { ImmutableAuditService } from '../../core-api/src/audit/immutable-audit.service';

export const STUDIO_RBAC_RULE_ID = 'STUDIO_RBAC_v1';

export type StudioPermission =
  | 'studio:manage'
  | 'studio:invite-creator'
  | 'studio:view-affiliations'
  | 'studio:upload-contract'
  | 'studio:view-commission';

export type StudioScopedRole = 'STUDIO_OWNER' | 'STUDIO_ADMIN' | 'CREATOR';

const STUDIO_PERMISSION_MATRIX: Record<StudioPermission, StudioScopedRole[]> = {
  'studio:manage':            ['STUDIO_OWNER'],
  'studio:invite-creator':    ['STUDIO_OWNER', 'STUDIO_ADMIN'],
  'studio:view-affiliations': ['STUDIO_OWNER', 'STUDIO_ADMIN', 'CREATOR'],
  'studio:upload-contract':   ['STUDIO_OWNER', 'STUDIO_ADMIN'],
  'studio:view-commission':   ['STUDIO_OWNER', 'STUDIO_ADMIN'],
};

export interface StudioCheckParams {
  actor_id: string;        // creator_id of the acting user
  studio_id: string;
  permission: StudioPermission;
  correlation_id?: string;
}

export interface StudioCheckResult {
  permitted: boolean;
  actor_id: string;
  studio_id: string;
  permission: StudioPermission;
  actor_role: StudioScopedRole | null;
  failure_reason: string | null;
  correlation_id: string;
  rule_applied_id: string;
}

@Injectable()
export class StudioRbacGuard {
  private readonly logger = new Logger(StudioRbacGuard.name);
  private readonly RULE_ID = STUDIO_RBAC_RULE_ID;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: ImmutableAuditService,
  ) {}

  /** Static helper for tests / call sites that just need the matrix. */
  static getRequiredRoles(permission: StudioPermission): StudioScopedRole[] {
    return STUDIO_PERMISSION_MATRIX[permission];
  }

  async check(params: StudioCheckParams): Promise<StudioCheckResult> {
    const correlation_id = params.correlation_id ?? `studio_rbac_${randomUUID()}`;
    const allowedRoles = STUDIO_PERMISSION_MATRIX[params.permission];
    if (!allowedRoles) {
      const result = this.deny(params, null, 'UNKNOWN_STUDIO_PERMISSION', correlation_id);
      await this.emitAudit(result, params);
      return result;
    }

    const affiliation = await this.prisma.studioAffiliation.findUnique({
      where: {
        studio_id_creator_id: {
          studio_id: params.studio_id,
          creator_id: params.actor_id,
        },
      },
      select: { role: true, status: true },
    });

    if (!affiliation) {
      const result = this.deny(params, null, 'NOT_AFFILIATED', correlation_id);
      await this.emitAudit(result, params);
      return result;
    }
    if (affiliation.status !== 'ACTIVE') {
      const result = this.deny(
        params,
        affiliation.role as StudioScopedRole,
        `AFFILIATION_${affiliation.status}`,
        correlation_id,
      );
      await this.emitAudit(result, params);
      return result;
    }
    if (!allowedRoles.includes(affiliation.role as StudioScopedRole)) {
      const result = this.deny(
        params,
        affiliation.role as StudioScopedRole,
        'INSUFFICIENT_STUDIO_ROLE',
        correlation_id,
      );
      await this.emitAudit(result, params);
      return result;
    }

    const result: StudioCheckResult = {
      permitted: true,
      actor_id: params.actor_id,
      studio_id: params.studio_id,
      permission: params.permission,
      actor_role: affiliation.role as StudioScopedRole,
      failure_reason: null,
      correlation_id,
      rule_applied_id: this.RULE_ID,
    };
    await this.emitAudit(result, params);
    return result;
  }

  private deny(
    params: StudioCheckParams,
    role: StudioScopedRole | null,
    reason: string,
    correlation_id: string,
  ): StudioCheckResult {
    return {
      permitted: false,
      actor_id: params.actor_id,
      studio_id: params.studio_id,
      permission: params.permission,
      actor_role: role,
      failure_reason: reason,
      correlation_id,
      rule_applied_id: this.RULE_ID,
    };
  }

  private async emitAudit(
    result: StudioCheckResult,
    params: StudioCheckParams,
  ): Promise<void> {
    await this.audit.emit({
      eventType: 'RBAC_DECISION',
      correlationId: result.correlation_id,
      actorId: params.actor_id,
      actorRole: 'creator',
      reasonCode: result.permitted ? 'STUDIO_RBAC_ALLOW' : 'STUDIO_RBAC_DENY',
      redactedPayload: {
        studio_id: params.studio_id,
        permission: params.permission,
        actor_role: result.actor_role,
        failure_reason: result.failure_reason,
      },
      metadata: { rule: this.RULE_ID },
    });
    if (!result.permitted) {
      this.logger.warn('StudioRbacGuard: denied', {
        actor_id: params.actor_id,
        studio_id: params.studio_id,
        permission: params.permission,
        reason: result.failure_reason,
        correlation_id: result.correlation_id,
      });
    }
  }
}
