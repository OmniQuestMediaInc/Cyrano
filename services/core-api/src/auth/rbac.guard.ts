// services/core-api/src/auth/rbac.guard.ts
// AUTH: AUTH-002 — RBAC guard
// Canonical Corpus v10, Chapter 7 §8.1 + Appendix E
// Roles: VIEWER < CREATOR < MODERATOR < COMPLIANCE < ADMIN
// All sensitive actions require role eligibility + step-up (enforced by StepUpService).
import { Injectable, Logger } from '@nestjs/common';

export type RbacRole = 'VIEWER' | 'CREATOR' | 'MODERATOR' | 'COMPLIANCE' | 'ADMIN';

const ROLE_RANK: Record<RbacRole, number> = {
  VIEWER: 1,
  CREATOR: 2,
  MODERATOR: 3,
  COMPLIANCE: 4,
  ADMIN: 5,
};

const PERMISSION_MATRIX: Record<string, RbacRole> = {
  'content:view': 'VIEWER',
  'token:purchase': 'VIEWER',
  'broadcast:start': 'CREATOR',
  'broadcast:stop': 'CREATOR',
  'rate_card:configure': 'CREATOR',
  'earnings:view': 'CREATOR',
  'content:flag': 'MODERATOR',
  'stream:suspend': 'MODERATOR',
  'severity:assign': 'MODERATOR',
  'suspension:override': 'COMPLIANCE',
  'ncii:suppress': 'COMPLIANCE',
  'legal_hold:trigger': 'COMPLIANCE',
  'refund:override': 'COMPLIANCE',
  'role:manage': 'ADMIN',
  'audit_log:view': 'ADMIN',
  'worm:export': 'ADMIN',
  'geo_block:modify': 'ADMIN',

  // ── RBAC-STUDIO-001 — additive studio permissions ─────────────────────
  // Platform-side floor; studio-scoped role checks are layered on top via
  // services/studio-affiliation/src/studio-rbac.guard.ts. PLATFORM_ADMIN
  // (mapped to ADMIN here) inherits all five via role rank.
  'studio:manage':            'CREATOR',
  'studio:invite-creator':    'CREATOR',
  'studio:view-affiliations': 'CREATOR',
  'studio:upload-contract':   'CREATOR',
  'studio:view-commission':   'CREATOR',
};

export interface RbacCheckResult {
  permitted: boolean;
  actor_id: string;
  actor_role: RbacRole;
  permission: string;
  required_role: RbacRole;
  failure_reason: string | null;
  rule_applied_id: string;
}

@Injectable()
export class RbacGuard {
  private readonly logger = new Logger(RbacGuard.name);
  private readonly RULE_ID = 'RBAC_GUARD_v1';

  check(params: { actor_id: string; actor_role: RbacRole; permission: string }): RbacCheckResult {
    const required_role = PERMISSION_MATRIX[params.permission];
    if (!required_role) {
      this.logger.error('RbacGuard: unknown permission requested', {
        actor_id: params.actor_id,
        permission: params.permission,
        rule_applied_id: this.RULE_ID,
      });
      return {
        permitted: false,
        actor_id: params.actor_id,
        actor_role: params.actor_role,
        permission: params.permission,
        required_role: 'ADMIN',
        failure_reason: 'UNKNOWN_PERMISSION',
        rule_applied_id: this.RULE_ID,
      };
    }
    const actorRank = ROLE_RANK[params.actor_role];
    const requiredRank = ROLE_RANK[required_role];
    const permitted = actorRank >= requiredRank;
    if (!permitted) {
      this.logger.warn('RbacGuard: permission denied', {
        actor_id: params.actor_id,
        actor_role: params.actor_role,
        permission: params.permission,
        required_role,
        rule_applied_id: this.RULE_ID,
      });
    } else {
      this.logger.log('RbacGuard: permission granted', {
        actor_id: params.actor_id,
        actor_role: params.actor_role,
        permission: params.permission,
        rule_applied_id: this.RULE_ID,
      });
    }
    return {
      permitted,
      actor_id: params.actor_id,
      actor_role: params.actor_role,
      permission: params.permission,
      required_role,
      failure_reason: permitted ? null : 'INSUFFICIENT_ROLE',
      rule_applied_id: this.RULE_ID,
    };
  }

  getPermissionsForRole(role: RbacRole): string[] {
    const rank = ROLE_RANK[role];
    return Object.entries(PERMISSION_MATRIX)
      .filter(([, required]) => rank >= ROLE_RANK[required])
      .map(([permission]) => permission);
  }
}
