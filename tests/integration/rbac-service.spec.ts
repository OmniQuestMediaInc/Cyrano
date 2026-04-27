/**
 * rbac-service.spec.ts
 * PAYLOAD 6 — RbacService: decision + step-up + immutable audit emission.
 */
import { RbacService } from '../../services/core-api/src/auth/rbac.service';
import { RbacGuard } from '../../services/core-api/src/auth/rbac.guard';
import type {
  StepUpVerificationResult,
} from '../../services/core-api/src/auth/step-up.service';

function buildStubAudit() {
  const emitted: unknown[] = [];
  return {
    emit: jest.fn(async (params: unknown) => {
      emitted.push(params);
      return {
        event_id: 'evt_stub',
        correlation_id: 'corr_stub',
        sequence_number: '1',
        hash_prior: null,
        hash_current: 'stub',
        payload_hash: 'stub',
        duplicate: false,
        rule_applied_id: 'IMMUTABLE_AUDIT_v1',
      };
    }),
    __emitted: emitted,
  };
}

describe('RbacService', () => {
  it('permits a simple role-satisfying permission and emits ALLOW audit', async () => {
    const guard = new RbacGuard();
    const audit = buildStubAudit();
    const svc = new RbacService(guard, audit as never);

    const result = await svc.authorize({
      actor_id: 'user_1',
      actor_role: 'CREATOR',
      permission: 'broadcast:start',
    });

    expect(result.permitted).toBe(true);
    expect(result.step_up_required).toBe(false);
    expect(audit.__emitted).toHaveLength(1);
  });

  it('denies when role is insufficient and emits DENY audit', async () => {
    const guard = new RbacGuard();
    const audit = buildStubAudit();
    const svc = new RbacService(guard, audit as never);

    const result = await svc.authorize({
      actor_id: 'user_1',
      actor_role: 'VIEWER',
      permission: 'broadcast:start',
    });

    expect(result.permitted).toBe(false);
    expect(result.failure_reason).toBe('INSUFFICIENT_ROLE');
    expect(audit.__emitted).toHaveLength(1);
  });

  it('requires step-up for refund:override even when role is sufficient', async () => {
    const guard = new RbacGuard();
    const audit = buildStubAudit();
    const svc = new RbacService(guard, audit as never);

    const result = await svc.authorize({
      actor_id: 'compliance_user',
      actor_role: 'COMPLIANCE',
      permission: 'refund:override',
    });

    expect(result.permitted).toBe(false);
    expect(result.step_up_required).toBe(true);
    expect(result.required_step_up_action).toBe('REFUND_OVERRIDE');
    expect(result.failure_reason).toBe('STEP_UP_REQUIRED');
  });

  it('permits the step-up-gated action when a verified challenge is attached', async () => {
    const guard = new RbacGuard();
    const audit = buildStubAudit();
    const svc = new RbacService(guard, audit as never);

    const verification: StepUpVerificationResult = {
      verified: true,
      challenge_id: 'ch_1',
      actor_id: 'compliance_user',
      action: 'REFUND_OVERRIDE',
      verified_at_utc: new Date().toISOString(),
      failure_reason: null,
      rule_applied_id: 'STEP_UP_AUTH_v1',
    };

    const result = await svc.authorize({
      actor_id: 'compliance_user',
      actor_role: 'COMPLIANCE',
      permission: 'refund:override',
      step_up_verification: verification,
    });

    expect(result.permitted).toBe(true);
    expect(result.step_up_required).toBe(false);
  });

  it('rejects a step-up verification issued for a different actor or action', async () => {
    const guard = new RbacGuard();
    const audit = buildStubAudit();
    const svc = new RbacService(guard, audit as never);

    const mismatchedVerification: StepUpVerificationResult = {
      verified: true,
      challenge_id: 'ch_2',
      actor_id: 'someone_else',
      action: 'REFUND_OVERRIDE',
      verified_at_utc: new Date().toISOString(),
      failure_reason: null,
      rule_applied_id: 'STEP_UP_AUTH_v1',
    };

    const result = await svc.authorize({
      actor_id: 'compliance_user',
      actor_role: 'COMPLIANCE',
      permission: 'refund:override',
      step_up_verification: mismatchedVerification,
    });

    expect(result.permitted).toBe(false);
    expect(result.step_up_required).toBe(true);
  });
});
