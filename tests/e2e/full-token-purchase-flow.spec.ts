/**
 * tests/e2e/full-token-purchase-flow.spec.ts
 * CYR: Token purchase → three-bucket allocation → GateGuard pre-process → ledger
 *
 * Closes ship-gate E2E-1 (PROGRAM_CONTROL/ship-gate-verifier.ts:341).
 * Hermetic — no Postgres, no NATS, no network. Exercises the canonical
 * constants and pure functions on the purchase path so any drift fails CI.
 */

import {
  LEDGER_SPEND_ORDER,
  REDBOOK_RATE_CARDS,
  DIAMOND_TIER,
} from '../../services/core-api/src/config/governance.config';
import { decide } from '../../services/core-api/src/gateguard/gateguard.service';
import {
  computeWelfareGuardianScore,
  DECISION_THRESHOLDS,
} from '../../services/core-api/src/gateguard/welfare-guardian.scorer';
import {
  DEFAULT_GOVERNANCE_SNAPSHOT,
  PublicWalletPresenter,
} from '../../ui/view-models/public-wallet.presenter';
import type { WalletThreeBucketView } from '../../ui/types/public-wallet-contracts';

describe('SM-01 — Token purchase + three-bucket allocation', () => {
  it('LEDGER_SPEND_ORDER is the canonical three-bucket order (purchased → membership → bonus)', () => {
    expect(LEDGER_SPEND_ORDER).toEqual(['purchased', 'membership', 'bonus']);
  });

  it('REDBOOK_RATE_CARDS exposes pricing constants used by the rate card', () => {
    const governanceSnapshot = PublicWalletPresenter.DEFAULT_GOVERNANCE_SNAPSHOT;

    expect(governanceSnapshot).toBeDefined();
    expect(governanceSnapshot.REDBOOK_RATE_CARDS).toEqual(REDBOOK_RATE_CARDS);
    expect(governanceSnapshot.DIAMOND_TIER.VELOCITY_MULTIPLIERS).toEqual(
      DIAMOND_TIER.VELOCITY_MULTIPLIERS,
    );
  });

  it('DIAMOND_TIER enforces the $0.077 platform floor', () => {
    expect(DIAMOND_TIER.PLATFORM_FLOOR_PER_TOKEN).toBe(0.077);
  });
});

describe('Config drift guard — presenter snapshot ↔ governance constants', () => {
  // The PublicWalletPresenter exposes a DEFAULT_GOVERNANCE_SNAPSHOT for
  // hermetic UI tests. In production the caller MUST pass a live snapshot
  // (per the presenter docstring), but the defaults still need to track
  // the canonical governance constants — otherwise the hermetic tests
  // green-light a UI that diverges from the ledger.

  it('ledger_spend_order matches LEDGER_SPEND_ORDER', () => {
    expect([...DEFAULT_GOVERNANCE_SNAPSHOT.ledger_spend_order]).toEqual([...LEDGER_SPEND_ORDER]);
  });

  it('diamond_platform_floor_per_token_usd matches DIAMOND_TIER.PLATFORM_FLOOR_PER_TOKEN', () => {
    expect(DEFAULT_GOVERNANCE_SNAPSHOT.diamond_platform_floor_per_token_usd).toBe(
      DIAMOND_TIER.PLATFORM_FLOOR_PER_TOKEN,
    );
  });

  it('diamond_velocity_multipliers match DIAMOND_TIER.VELOCITY_MULTIPLIERS for every band', () => {
    const bands = ['DAYS_14', 'DAYS_30', 'DAYS_90', 'DAYS_180', 'DAYS_366'] as const;
    for (const band of bands) {
      expect(DEFAULT_GOVERNANCE_SNAPSHOT.diamond_velocity_multipliers[band]).toBe(
        DIAMOND_TIER.VELOCITY_MULTIPLIERS[band],
      );
    }
  });

  it('diamond_volume_tiers match DIAMOND_TIER.VOLUME_TIERS on min_tokens + base_rate', () => {
    // max_tokens uses Infinity in governance.config and Number.MAX_SAFE_INTEGER
    // in the presenter snapshot — both serve as "no upper bound" sentinels and
    // are equivalent for runtime range checks. Compare the load-bearing fields.
    const govTiers = DIAMOND_TIER.VOLUME_TIERS;
    const snapTiers = DEFAULT_GOVERNANCE_SNAPSHOT.diamond_volume_tiers;
    expect(snapTiers.length).toBe(govTiers.length);
    for (let i = 0; i < govTiers.length; i++) {
      expect(snapTiers[i].min_tokens).toBe(govTiers[i].min_tokens);
      expect(snapTiers[i].base_rate).toBe(govTiers[i].base_rate);
    }
  });
});

describe('SM-12 — GateGuard decision (every financial write)', () => {
  it('decide() returns one of APPROVE | COOLDOWN | HARD_DECLINE | HUMAN_ESCALATE', () => {
    const allowed = ['APPROVE', 'COOLDOWN', 'HARD_DECLINE', 'HUMAN_ESCALATE'];
    for (const fraud of [0, 25, 50, 75, 95]) {
      for (const welfare of [0, 25, 50, 75, 95]) {
        const result = decide(fraud, welfare);
        expect(allowed).toContain(result);
      }
    }
  });

  it('low fraud + low welfare → APPROVE', () => {
    expect(decide(10, 10)).toBe('APPROVE');
  });

  it('fraud or welfare ≥ 90 → HUMAN_ESCALATE (HARD_DECLINE_HCZ band)', () => {
    expect(decide(95, 0)).toBe('HUMAN_ESCALATE');
    expect(decide(0, 95)).toBe('HUMAN_ESCALATE');
  });
});

describe('SM-08 — Welfare Guardian thresholds 40 / 70 / 90', () => {
  it('DECISION_THRESHOLDS matches the verifier expectation', () => {
    expect(DECISION_THRESHOLDS.cooldownAt).toBe(40);
    expect(DECISION_THRESHOLDS.hardDeclineAt).toBe(70);
    expect(DECISION_THRESHOLDS.humanEscalateAt).toBe(90);
  });

  it('computeWelfareGuardianScore is a pure deterministic function', () => {
    const inputs = { hourly_velocity: 0.1, daily_spend_pct_of_p90: 0.2, friction_signals: 0 };
    const a = computeWelfareGuardianScore(inputs as never);
    const b = computeWelfareGuardianScore(inputs as never);
    expect(a).toEqual(b);
  });
});

describe('Wallet view-model — three-bucket presenter contract', () => {
  it('PublicWalletPresenter.buildWalletView produces a contract-shaped view', () => {
    const presenter = new PublicWalletPresenter();
    const view: WalletThreeBucketView = presenter.buildWalletView({
      wallet_id: 'wlt_test_1',
      user_id: 'usr_test_1',
      tier: 'GUEST',
      balances: { purchased:1000n, membership: 0n, bonus: 250n },
    });
    expect(view.buckets).toHaveLength(3);
    expect(view.buckets.map((b) => b.bucket)).toEqual(LEDGER_SPEND_ORDER);
    expect(view.buckets[0].spend_priority).toBe(1);
    expect(view.buckets[1].spend_priority).toBe(2);
    expect(view.buckets[2].spend_priority).toBe(3);
    expect(view.total_tokens).toBe('1250');
  });

  it('buildWalletView marks the top non-empty bucket as will_drain_next', () => {
    const presenter = new PublicWalletPresenter();
    const view = presenter.buildWalletView({
      wallet_id: 'wlt_test_2',
      user_id: 'usr_test_2',
      tier: 'MEMBER',
      balances: { purchased:0n, membership: 500n, bonus: 100n },
    });
    expect(view.buckets[0].will_drain_next).toBe(false); // purchased empty
    expect(view.buckets[1].will_drain_next).toBe(true); // membership drains next
    expect(view.buckets[2].will_drain_next).toBe(false); // bonus last
  });

  it('view bigint fields serialize as strings (JSON boundary)', () => {
    const presenter = new PublicWalletPresenter();
    const view = presenter.buildWalletView({
      wallet_id: 'wlt_test_3',
      user_id: 'usr_test_3',
      tier: 'DIAMOND',
      balances: { purchased:9_999_999_999n, membership: 0n, bonus: 0n },
    });
    expect(typeof view.total_tokens).toBe('string');
    expect(view.buckets.every((b) => typeof b.balance_tokens === 'string')).toBe(true);
  });
});
