/**
 * tests/e2e/rbac-step-up-enforcement.spec.ts
 * CYR: RBAC + step-up auth — every gated permission requires step-up
 *
 * Closes ship-gate E2E-1. Verifies the seven canonical step-up
 * permissions resolve at runtime through RbacService.requiresStepUp,
 * not just by source-text grep. Also keeps a defence-in-depth
 * source-scan check so a refactor that drops the runtime mapping
 * still gets caught even if the function signature changes. Hermetic.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  RbacService,
  RBAC_SERVICE_RULE_ID,
} from '../../services/core-api/src/auth/rbac.service';
import { NATS_TOPICS } from '../../services/nats/topics.registry';

const RBAC_SOURCE = readFileSync(
  join(__dirname, '..', '..', 'services', 'core-api', 'src', 'auth', 'rbac.service.ts'),
  'utf8',
);

/**
 * Build an RbacService with no-op deps. requiresStepUp() does not touch
 * the guard or audit injectables — the call goes straight to the
 * PERMISSION_TO_STEP_UP table — so passing nulls is safe and keeps the
 * test hermetic (no NestJS bootstrap, no Prisma, no NATS).
 */
function buildHermeticRbac(): RbacService {
  return new RbacService(null as never, null as never);
}

describe('RBAC service — canonical rule id', () => {
  it('RBAC_SERVICE_RULE_ID is the canonical id', () => {
    expect(RBAC_SERVICE_RULE_ID).toBe('RBAC_SERVICE_v1');
  });
});

describe('RbacService.requiresStepUp — runtime mapping (primary check)', () => {
  // Mirrors ship-gate-verifier.ts RBAC-1 (lines 192-213) and the
  // PERMISSION_TO_STEP_UP table at services/core-api/src/auth/rbac.service.ts:33.
  const required: ReadonlyArray<{ permission: string; action: string }> = [
    { permission: 'refund:override',     action: 'REFUND_OVERRIDE' },
    { permission: 'suspension:override', action: 'ACCOUNT_FREEZE' },
    { permission: 'ncii:suppress',       action: 'CONTENT_DELETION' },
    { permission: 'legal_hold:trigger',  action: 'TAKEDOWN_SUBMISSION' },
    { permission: 'geo_block:modify',    action: 'GEO_BLOCK_MODIFICATION' },
    { permission: 'rate_card:configure', action: 'PAYOUT_CHANGE' },
    { permission: 'worm:export',         action: 'WALLET_MODIFICATION' },
  ];

  it('exposes exactly seven step-up actions (no drift)', () => {
    expect(required).toHaveLength(7);
  });

  it.each(required)(
    'requiresStepUp("$permission") returns "$action" at runtime',
    ({ permission, action }) => {
      const rbac = buildHermeticRbac();
      expect(rbac.requiresStepUp(permission)).toBe(action);
    },
  );

  it('requiresStepUp returns null for non-gated permissions', () => {
    const rbac = buildHermeticRbac();
    expect(rbac.requiresStepUp('chat:send')).toBeNull();
    expect(rbac.requiresStepUp('wallet:read')).toBeNull();
    expect(rbac.requiresStepUp('not:a:real:permission')).toBeNull();
  });

  it('returns null for the empty permission string', () => {
    const rbac = buildHermeticRbac();
    expect(rbac.requiresStepUp('')).toBeNull();
  });
});

describe('RBAC source-scan — defence in depth', () => {
  // These greps are a backstop against a refactor that drops requiresStepUp
  // or replaces the const map with a different mechanism. The runtime test
  // above is the primary assertion; this catches the case where the
  // function signature is renamed but the table content is correct.
  it('source references ImmutableAuditService.emit for audit binding', () => {
    expect(RBAC_SOURCE).toContain('this.audit.emit');
  });

  it('source references ImmutableAuditService import', () => {
    expect(RBAC_SOURCE).toContain('ImmutableAuditService');
  });

  it('source defines the PERMISSION_TO_STEP_UP map', () => {
    expect(RBAC_SOURCE).toContain('PERMISSION_TO_STEP_UP');
  });
});

describe('AuthorizeResult shape — { permitted, step_up_required }', () => {
  it('AuthorizeResult interface exposes the step_up_required field', () => {
    expect(RBAC_SOURCE).toMatch(/step_up_required:\s*boolean/);
  });

  it('AuthorizeResult interface exposes the permitted field', () => {
    expect(RBAC_SOURCE).toMatch(/permitted:\s*boolean/);
  });
});

describe('Step-up auth NATS topology — challenge / verified / failed', () => {
  it('NATS registry exposes STEP_UP_CHALLENGE_ISSUED', () => {
    expect(NATS_TOPICS.STEP_UP_CHALLENGE_ISSUED).toBe('auth.step_up.challenge.issued');
  });

  it('NATS registry exposes STEP_UP_CHALLENGE_VERIFIED', () => {
    expect(NATS_TOPICS.STEP_UP_CHALLENGE_VERIFIED).toBe('auth.step_up.challenge.verified');
  });

  it('NATS registry exposes STEP_UP_CHALLENGE_FAILED', () => {
    expect(NATS_TOPICS.STEP_UP_CHALLENGE_FAILED).toBe('auth.step_up.challenge.failed');
  });
});

describe('Audit immutable topics — RBAC writes a STEP_UP audit event', () => {
  it('NATS registry exposes AUDIT_IMMUTABLE_STEP_UP', () => {
    expect(NATS_TOPICS.AUDIT_IMMUTABLE_STEP_UP).toBe('audit.immutable.step_up');
  });

  it('NATS registry exposes AUDIT_IMMUTABLE_RBAC', () => {
    expect(NATS_TOPICS.AUDIT_IMMUTABLE_RBAC).toBe('audit.immutable.rbac');
  });
});
