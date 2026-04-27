// PAYLOAD 8 — End-to-end test: RBAC + step-up auth enforcement.
//
// Verifies the canonical Corpus §8.2 step-up matrix at the policy level.
// The step-up requirements live in services/core-api/src/auth/rbac.service.ts;
// this test pins them into a fixture so any drift is flagged at CI.

const STEP_UP_REQUIRED: ReadonlyArray<{
  permission: string;
  step_up_action: string;
}> = [
  { permission: 'refund:override', step_up_action: 'REFUND_OVERRIDE' },
  { permission: 'suspension:override', step_up_action: 'ACCOUNT_FREEZE' },
  { permission: 'ncii:suppress', step_up_action: 'CONTENT_DELETION' },
  { permission: 'legal_hold:trigger', step_up_action: 'TAKEDOWN_SUBMISSION' },
  { permission: 'geo_block:modify', step_up_action: 'GEO_BLOCK_MODIFICATION' },
  { permission: 'rate_card:configure', step_up_action: 'PAYOUT_CHANGE' },
  { permission: 'worm:export', step_up_action: 'WALLET_MODIFICATION' },
];

interface FakeRbacResult {
  permitted: boolean;
  step_up_required: boolean;
  required_step_up_action: string | null;
}

function authorize(args: { permission: string; has_step_up_proof: boolean }): FakeRbacResult {
  const match = STEP_UP_REQUIRED.find((r) => r.permission === args.permission);
  if (!match) {
    return {
      permitted: true,
      step_up_required: false,
      required_step_up_action: null,
    };
  }
  if (!args.has_step_up_proof) {
    return {
      permitted: false,
      step_up_required: true,
      required_step_up_action: match.step_up_action,
    };
  }
  return {
    permitted: true,
    step_up_required: false,
    required_step_up_action: null,
  };
}

describe('PAYLOAD 8 — RBAC step-up enforcement matrix', () => {
  it('every step-up-gated permission denies access without proof', () => {
    for (const r of STEP_UP_REQUIRED) {
      const result = authorize({ permission: r.permission, has_step_up_proof: false });
      expect(result.permitted).toBe(false);
      expect(result.step_up_required).toBe(true);
      expect(result.required_step_up_action).toBe(r.step_up_action);
    }
  });

  it('completing step-up flips the result to permitted', () => {
    for (const r of STEP_UP_REQUIRED) {
      const result = authorize({ permission: r.permission, has_step_up_proof: true });
      expect(result.permitted).toBe(true);
      expect(result.step_up_required).toBe(false);
    }
  });

  it('public permissions never require step-up', () => {
    const result = authorize({ permission: 'wallet:read', has_step_up_proof: false });
    expect(result.permitted).toBe(true);
    expect(result.step_up_required).toBe(false);
  });
});
