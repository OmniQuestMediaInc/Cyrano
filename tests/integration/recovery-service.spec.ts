/**
 * recovery-service.spec.ts
 * Integration tests: RecoveryEngine Three Pillars + Happy-Path flows.
 *
 * Validates:
 *  - Pillar 1 Token Bridge offer math and waiver acceptance
 *  - Pillar 2 Three-Fifths Exit policy gating + CEO override
 *  - Pillar 3 Expiration 70/30 distribution
 *  - 48h Diamond expiry warning enqueue semantics
 *  - High-balance personal-touch trigger threshold
 *  - Append-only audit trail with correlation_id propagation
 */
import {
  RecoveryEngine,
  RECOVERY_CONSTANTS,
  RecoveryDispatcher,
} from '../../services/recovery/src/recovery.service';
import { WalletSnapshot } from '../../services/recovery/src/recovery.types';
import { DIAMOND_TIER } from '../../services/core-api/src/config/governance.config';

function buildDispatcher(): RecoveryDispatcher & {
  cases: unknown[];
  warnings: WalletSnapshot[];
  personal: WalletSnapshot[];
} {
  const cases: unknown[] = [];
  const warnings: WalletSnapshot[] = [];
  const personal: WalletSnapshot[] = [];
  return {
    cases,
    warnings,
    personal,
    publishCase: (c) => { cases.push(c); },
    enqueue48hWarning: (s) => { warnings.push(s); },
    enqueuePersonalTouch: (s) => { personal.push(s); },
  };
}

function openStandardCase(engine: RecoveryEngine) {
  return engine.openCase({
    wallet_id: 'w_test_001',
    user_id: 'cu_test_001',
    remaining_balance_tokens: 10_000n,
    original_purchase_price_usd_cents: 130_000n, // ~1k CZT @ $1.30 * 100
    correlation_id: 'corr_test_001',
  });
}

describe('RecoveryEngine — case lifecycle', () => {
  it('opens a case with monotonic OPEN stage and empty audit trail', () => {
    const engine = new RecoveryEngine();
    const c = openStandardCase(engine);
    expect(c.stage).toBe('OPEN');
    expect(c.audit_trail).toHaveLength(0);
    expect(c.correlation_id).toBe('corr_test_001');
    expect(c.rule_applied_id).toBe('REDBOOK_RECOVERY_v1');
  });

  it('publishes new cases to the dispatcher', () => {
    const dispatcher = buildDispatcher();
    const engine = new RecoveryEngine(dispatcher);
    openStandardCase(engine);
    expect(dispatcher.cases).toHaveLength(1);
  });

  it('listOpenCases excludes RESOLVED and EXPIRATION_PROCESSED stages', () => {
    const engine = new RecoveryEngine();
    const a = openStandardCase(engine);
    const b = openStandardCase(engine);
    engine.handleExpiration(b.case_id, 'agent_a');
    const open = engine.listOpenCases();
    expect(open.map((c) => c.case_id)).toContain(a.case_id);
    expect(open.map((c) => c.case_id)).not.toContain(b.case_id);
  });
});

describe('RecoveryEngine — Pillar 1: Token Bridge', () => {
  it('computes 20% bonus tokens on remaining balance', () => {
    const engine = new RecoveryEngine();
    const c = openStandardCase(engine);
    const offer = engine.tokenBridgeOffer(c.case_id, 'agent_cs_001');
    expect(offer.bonus_pct).toBe(RECOVERY_CONSTANTS.TOKEN_BRIDGE_BONUS_PCT);
    // 20% of 10,000 = 2,000
    expect(offer.bonus_tokens).toBe(2_000n);
    expect(offer.requires_waiver_signature).toBe(true);
  });

  it('advances stage to TOKEN_BRIDGE_OFFERED and sets restriction flag', () => {
    const engine = new RecoveryEngine();
    const c = openStandardCase(engine);
    engine.tokenBridgeOffer(c.case_id, 'agent_cs_001');
    const after = engine.getCase(c.case_id)!;
    expect(after.stage).toBe('TOKEN_BRIDGE_OFFERED');
    expect(after.flags).toContain('RESTRICTION_WINDOW_ACTIVE');
    expect(after.audit_trail).toHaveLength(1);
    expect(after.audit_trail[0].action).toBe('TOKEN_BRIDGE_OFFER');
  });

  it('offer expires within the 24-hour TTL window', () => {
    const engine = new RecoveryEngine();
    const c = openStandardCase(engine);
    const offer = engine.tokenBridgeOffer(c.case_id, 'agent_cs_001');
    const ttlMs = new Date(offer.offer_expires_at_utc).getTime() - Date.now();
    const expectedMs =
      RECOVERY_CONSTANTS.TOKEN_BRIDGE_OFFER_TTL_HOURS * 60 * 60 * 1000;
    // Allow 2s of drift for test execution
    expect(ttlMs).toBeGreaterThan(expectedMs - 2_000);
    expect(ttlMs).toBeLessThanOrEqual(expectedMs);
  });

  it('records waiver-signature hash on acceptance and advances stage', () => {
    const engine = new RecoveryEngine();
    const c = openStandardCase(engine);
    engine.tokenBridgeOffer(c.case_id, 'agent_cs_001');
    const entry = engine.acceptTokenBridge(
      c.case_id,
      'agent_cs_001',
      'waiver_hash_abc',
    );
    expect(entry.action).toBe('TOKEN_BRIDGE_ACCEPT');
    expect(entry.metadata).toMatchObject({ waiver_signature_hash: 'waiver_hash_abc' });
    const after = engine.getCase(c.case_id)!;
    expect(after.stage).toBe('TOKEN_BRIDGE_ACCEPTED');
  });

  it('rejects acceptance from an invalid stage', () => {
    const engine = new RecoveryEngine();
    const c = openStandardCase(engine);
    expect(() =>
      engine.acceptTokenBridge(c.case_id, 'agent_cs_001', 'hash'),
    ).toThrow(/RECOVERY_INVALID_STAGE/);
  });
});

describe('RecoveryEngine — Pillar 2: Three-Fifths Exit (policy gated)', () => {
  it('returns POLICY_GATED when no CEO override is supplied', () => {
    const engine = new RecoveryEngine();
    const c = openStandardCase(engine);
    const out = engine.threeFifthsExit(c.case_id, 'agent_cs_001');
    expect(out.result_code).toBe('POLICY_GATED');
    expect(out.policy_gate_reference).toBe(
      RECOVERY_CONSTANTS.POLICY_GATE_REFERENCE,
    );
    expect(out.refund_percentage).toBe(0.6);
    expect(out.lock_hours).toBe(24);
    expect(out.processing_business_days).toEqual([7, 10]);
  });

  it('records the permanent flag on the case for policy gating', () => {
    const engine = new RecoveryEngine();
    const c = openStandardCase(engine);
    engine.threeFifthsExit(c.case_id, 'agent_cs_001');
    const after = engine.getCase(c.case_id)!;
    expect(after.flags).toContain(
      RECOVERY_CONSTANTS.THREE_FIFTHS_PERMANENT_FLAG,
    );
    expect(after.stage).toBe('THREE_FIFTHS_EXIT_POLICY_GATED');
  });

  it('returns OK when a CEO override context is provided', () => {
    const engine = new RecoveryEngine();
    const c = openStandardCase(engine);
    const out = engine.threeFifthsExit(c.case_id, 'agent_cs_001', {
      override_id: 'ovr_001',
      authorized_by: 'ceo_user',
      authorized_at_utc: new Date().toISOString(),
      reason_code: 'CEO_DIRECTIVE_2026-04-24',
    });
    expect(out.result_code).toBe('OK');
    expect(out.policy_gate_reference).toBeUndefined();
    const after = engine.getCase(c.case_id)!;
    expect(after.stage).toBe('THREE_FIFTHS_EXIT_OFFERED');
    expect(after.flags).toContain('BUY_SPEND_LOCK_ACTIVE');
  });

  it('audit trail captures the CEO override id when present', () => {
    const engine = new RecoveryEngine();
    const c = openStandardCase(engine);
    engine.threeFifthsExit(c.case_id, 'agent_cs_001', {
      override_id: 'ovr_002',
      authorized_by: 'ceo_user',
      authorized_at_utc: new Date().toISOString(),
      reason_code: 'CEO_DIRECTIVE',
    });
    const after = engine.getCase(c.case_id)!;
    const entry = after.audit_trail.find(
      (e) => e.action === 'THREE_FIFTHS_EXIT_REQUEST',
    );
    expect(entry).toBeDefined();
    expect(entry!.metadata).toMatchObject({ ceo_override_id: 'ovr_002' });
  });
});

describe('RecoveryEngine — Pillar 3: Expiration distribution', () => {
  it('splits expired tokens 70/30 creator vs platform mgmt', () => {
    const engine = new RecoveryEngine();
    const c = openStandardCase(engine); // 10,000 tokens
    const dist = engine.handleExpiration(c.case_id, 'agent_cs_001');
    // 70% of 10,000 = 7,000
    expect(dist.creator_bonus_pool_tokens).toBe(7_000n);
    expect(dist.platform_mgmt_fee_tokens).toBe(3_000n);
    expect(
      dist.creator_bonus_pool_tokens + dist.platform_mgmt_fee_tokens,
    ).toBe(dist.expired_tokens);
  });

  it('surfaces canonical DIAMOND_TIER extension and recovery fees', () => {
    const engine = new RecoveryEngine();
    const c = openStandardCase(engine);
    const dist = engine.handleExpiration(c.case_id, 'agent_cs_001');
    expect(dist.extension_fee_usd).toBe(DIAMOND_TIER.EXTENSION_FEE_14_DAY_USD);
    expect(dist.recovery_fee_usd).toBe(DIAMOND_TIER.RECOVERY_FEE_EXPIRED_USD);
  });

  it('advances stage to EXPIRATION_PROCESSED and appends audit', () => {
    const engine = new RecoveryEngine();
    const c = openStandardCase(engine);
    engine.handleExpiration(c.case_id, 'agent_cs_001');
    const after = engine.getCase(c.case_id)!;
    expect(after.stage).toBe('EXPIRATION_PROCESSED');
    expect(
      after.audit_trail.find((e) => e.action === 'EXPIRATION_DISTRIBUTE'),
    ).toBeDefined();
  });

  it('tolerates BigInt rounding without dropping residual tokens', () => {
    const engine = new RecoveryEngine();
    // 7 tokens → 70% = 4 (floor), residual 3
    const c = engine.openCase({
      wallet_id: 'w_odd',
      user_id: 'cu_odd',
      remaining_balance_tokens: 7n,
      original_purchase_price_usd_cents: 1_000n,
    });
    const dist = engine.handleExpiration(c.case_id, 'agent_cs_001');
    expect(
      dist.creator_bonus_pool_tokens + dist.platform_mgmt_fee_tokens,
    ).toBe(7n);
  });
});

describe('RecoveryEngine — 48h expiry warning', () => {
  function snap(overrides: Partial<WalletSnapshot> = {}): WalletSnapshot {
    return {
      wallet_id: 'w_warn',
      user_id: 'cu_warn',
      tier: 'VIP_DIAMOND',
      remaining_balance_tokens: 5_000n,
      remaining_balance_usd_cents: 65_000n,
      expires_at_utc: new Date(
        Date.now() + 36 * 60 * 60 * 1000,
      ).toISOString(),
      is_diamond: true,
      last_purchase_at_utc: new Date().toISOString(),
      ...overrides,
    };
  }

  it('flags Diamond wallets expiring within the 48h window', async () => {
    const engine = new RecoveryEngine();
    const result = await engine.send48HourWarning([snap()]);
    expect(result).toHaveLength(1);
  });

  it('excludes wallets expiring beyond the 48h window', async () => {
    const engine = new RecoveryEngine();
    const later = snap({
      expires_at_utc: new Date(
        Date.now() + 72 * 60 * 60 * 1000,
      ).toISOString(),
    });
    const result = await engine.send48HourWarning([later]);
    expect(result).toHaveLength(0);
  });

  it('excludes wallets that have zero remaining balance', async () => {
    const engine = new RecoveryEngine();
    const empty = snap({ remaining_balance_tokens: 0n });
    const result = await engine.send48HourWarning([empty]);
    expect(result).toHaveLength(0);
  });

  it('excludes non-Diamond wallets', async () => {
    const engine = new RecoveryEngine();
    const nonDiamond = snap({ is_diamond: false, tier: 'VIP_SILVER' });
    const result = await engine.send48HourWarning([nonDiamond]);
    expect(result).toHaveLength(0);
  });

  it('enqueues warnings via the dispatcher', async () => {
    const dispatcher = buildDispatcher();
    const engine = new RecoveryEngine(dispatcher);
    await engine.send48HourWarning([snap()]);
    expect(dispatcher.warnings).toHaveLength(1);
  });

  it('deduplicates duplicate wallet_id entries within a single call', async () => {
    const dispatcher = buildDispatcher();
    const engine = new RecoveryEngine(dispatcher);
    // Two snapshots with the same wallet_id — only one warning should be enqueued.
    const result = await engine.send48HourWarning([snap(), snap()]);
    expect(result).toHaveLength(1);
    expect(dispatcher.warnings).toHaveLength(1);
  });

  it('does not re-enqueue a warning for the same wallet on a repeated call (cross-call idempotency)', async () => {
    const dispatcher = buildDispatcher();
    const engine = new RecoveryEngine(dispatcher);
    const now = new Date();
    await engine.send48HourWarning([snap()], now);
    // Second call with the same wallet within the same window — must be suppressed.
    const secondResult = await engine.send48HourWarning([snap()], now);
    expect(secondResult).toHaveLength(0);
    expect(dispatcher.warnings).toHaveLength(1);
  });
});

describe('RecoveryEngine — high-balance personal-touch trigger', () => {
  it('triggers on balance > $10,000 USD equivalent', async () => {
    const dispatcher = buildDispatcher();
    const engine = new RecoveryEngine(dispatcher);
    const high: WalletSnapshot = {
      wallet_id: 'w_high',
      user_id: 'cu_high',
      tier: 'VIP_DIAMOND',
      remaining_balance_tokens: 80_000n,
      remaining_balance_usd_cents: 1_050_000n, // $10,500
      expires_at_utc: new Date().toISOString(),
      is_diamond: true,
      last_purchase_at_utc: new Date().toISOString(),
    };
    const out = await engine.triggerPersonalTouch([high]);
    expect(out).toHaveLength(1);
    expect(dispatcher.personal).toHaveLength(1);
  });

  it('does not trigger on balance <= $10,000', async () => {
    const engine = new RecoveryEngine();
    const below: WalletSnapshot = {
      wallet_id: 'w_low',
      user_id: 'cu_low',
      tier: 'VIP_DIAMOND',
      remaining_balance_tokens: 80_000n,
      remaining_balance_usd_cents: 1_000_000n, // exactly $10,000
      expires_at_utc: new Date().toISOString(),
      is_diamond: true,
      last_purchase_at_utc: new Date().toISOString(),
    };
    const out = await engine.triggerPersonalTouch([below]);
    expect(out).toHaveLength(0);
  });
});

describe('RecoveryEngine — audit trail invariants', () => {
  it('every audit row carries the case correlation_id and rule_applied_id', () => {
    const engine = new RecoveryEngine();
    const c = openStandardCase(engine);
    engine.tokenBridgeOffer(c.case_id, 'agent_cs_001');
    engine.acceptTokenBridge(c.case_id, 'agent_cs_001', 'waiver_h');
    const after = engine.getCase(c.case_id)!;
    expect(after.audit_trail.every((e) => e.correlation_id === 'corr_test_001')).toBe(true);
    expect(
      after.audit_trail.every((e) => e.rule_applied_id === 'REDBOOK_RECOVERY_v1'),
    ).toBe(true);
  });

  it('audit trail is append-only — earlier entries preserved after later advance', () => {
    const engine = new RecoveryEngine();
    const c = openStandardCase(engine);
    engine.tokenBridgeOffer(c.case_id, 'agent_cs_001');
    const afterOffer = engine.getCase(c.case_id)!;
    const snapshotLength = afterOffer.audit_trail.length;
    engine.acceptTokenBridge(c.case_id, 'agent_cs_001', 'waiver_h');
    const afterAccept = engine.getCase(c.case_id)!;
    expect(afterAccept.audit_trail.length).toBeGreaterThan(snapshotLength);
    expect(afterAccept.audit_trail[0].action).toBe('TOKEN_BRIDGE_OFFER');
  });
});
