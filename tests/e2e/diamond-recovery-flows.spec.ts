// PAYLOAD 8 — End-to-end test: Diamond recovery flows
// (Token Bridge + 3/5ths Exit + expiration + redistribution).

import { RecoveryEngine } from '../../services/recovery/src/recovery.service';
import {
  DiamondConciergePresenter,
  RecoveryPresenter,
} from '../../ui/view-models/diamond-concierge.presenter';

describe('PAYLOAD 8 — Token Bridge flow E2E', () => {
  it('produces 20% bonus offer, accepts on signed waiver, advances stage', () => {
    const engine = new RecoveryEngine();
    const c = engine.openCase({
      wallet_id: 'w-1',
      user_id: 'u-1',
      remaining_balance_tokens: 1000n,
      original_purchase_price_usd_cents: 12_000n,
    });

    const offer = engine.tokenBridgeOffer(c.case_id, 'agent-1');
    expect(offer.bonus_tokens).toBe(200n);
    expect(offer.bonus_pct).toBe(0.2);
    expect(offer.requires_waiver_signature).toBe(true);

    const accept = engine.acceptTokenBridge(c.case_id, 'agent-1', 'sha256:waiver');
    expect(accept.action).toBe('TOKEN_BRIDGE_ACCEPT');
    expect(engine.getCase(c.case_id)?.stage).toBe('TOKEN_BRIDGE_ACCEPTED');
  });
});

describe('PAYLOAD 8 — Three-Fifths Exit flow E2E', () => {
  it('returns POLICY_GATED without CEO override, OK with override', () => {
    const engine = new RecoveryEngine();
    const c = engine.openCase({
      wallet_id: 'w-2',
      user_id: 'u-2',
      remaining_balance_tokens: 600n,
      original_purchase_price_usd_cents: 10_000n,
    });

    const gated = engine.threeFifthsExit(c.case_id, 'agent-1');
    expect(gated.result_code).toBe('POLICY_GATED');
    expect(gated.policy_gate_reference).toBe('FIZ-002-REVISION-2026-04-11');
    expect(engine.getCase(c.case_id)?.stage).toBe('THREE_FIFTHS_EXIT_POLICY_GATED');

    const c2 = engine.openCase({
      wallet_id: 'w-3',
      user_id: 'u-3',
      remaining_balance_tokens: 600n,
      original_purchase_price_usd_cents: 10_000n,
    });
    const ok = engine.threeFifthsExit(c2.case_id, 'agent-1', {
      override_id: 'CEO_OVR_001',
      authorized_by: 'kbh',
      authorized_at_utc: '2026-04-25T12:00:00Z',
      reason_code: 'CEO_AUTHORIZED',
    });
    expect(ok.result_code).toBe('OK');
    expect(engine.getCase(c2.case_id)?.flags).toContain('BUY_SPEND_LOCK_ACTIVE');
  });
});

describe('PAYLOAD 8 — Expiration redistribution E2E', () => {
  it('splits 70% to creator pool / 30% to platform mgmt', () => {
    const engine = new RecoveryEngine();
    const c = engine.openCase({
      wallet_id: 'w-exp',
      user_id: 'u-exp',
      remaining_balance_tokens: 1000n,
      original_purchase_price_usd_cents: 8_000n,
    });
    const dist = engine.handleExpiration(c.case_id, 'agent-1');
    expect(dist.creator_bonus_pool_tokens).toBe(700n);
    expect(dist.platform_mgmt_fee_tokens).toBe(300n);
    expect(dist.extension_fee_usd).toBe(49);
    expect(dist.recovery_fee_usd).toBe(79);
    expect(engine.getCase(c.case_id)?.stage).toBe('EXPIRATION_PROCESSED');
  });
});

describe('PAYLOAD 8 — Diamond Concierge UI presenter E2E', () => {
  it('builds command-center view from real recovery offers + telemetry', () => {
    const presenter = new DiamondConciergePresenter();
    const now = new Date('2026-04-25T12:00:00Z');
    const view = presenter.buildCommandCenterView({
      now_utc: now,
      open_wallets: [
        {
          wallet_id: 'w-1',
          user_id: 'u-1',
          remaining_tokens: 12_000n,
          remaining_usd_cents: BigInt(15_000 * 100),
          expires_at_utc: '2026-04-26T00:00:00Z',
          velocity_band: 'DAYS_14',
        },
        {
          wallet_id: 'w-2',
          user_id: 'u-2',
          remaining_tokens: 35_000n,
          remaining_usd_cents: BigInt(50_000 * 100),
          expires_at_utc: '2026-05-15T00:00:00Z',
          velocity_band: 'DAYS_30',
        },
      ],
      token_bridge_offers: [
        {
          case_id: 'rec_1',
          wallet_id: 'w-1',
          user_id: 'u-1',
          current_balance_tokens: 12_000n,
          bonus_tokens: 2_400n,
          bonus_pct: 0.2,
          restriction_window_hours: 24,
          requires_waiver_signature: true,
          offer_expires_at_utc: '2026-04-26T12:00:00Z',
          rule_applied_id: 'REDBOOK_RECOVERY_v1',
        },
      ],
      three_fifths_offers: [
        {
          case_id: 'rec_1',
          wallet_id: 'w-1',
          user_id: 'u-1',
          refund_percentage: 0.6,
          lock_hours: 24,
          processing_business_days: [7, 10],
          permanent_flag: 'AWARE_OF_POLICY_DECLINED_TWO_GOODWILL_OFFERS',
          policy_gated: true,
          policy_gate_reference: 'FIZ-002-REVISION-2026-04-11',
          rule_applied_id: 'REDBOOK_RECOVERY_v1',
        },
      ],
      gateguard_events: [
        {
          event_id: 'gg-1',
          actor_id: 'u-1',
          action: 'PURCHASE',
          decision: 'APPROVE',
          fraud_score: 8,
          welfare_score: 12,
          reason_codes: ['LOW_VELOCITY'],
          captured_at_utc: '2026-04-25T11:55:00Z',
        },
      ],
      welfare_cohort: {
        cohort_average_welfare_score: 22,
        cohort_average_fraud_score: 18,
        active_cooldowns: 2,
        active_hard_declines: 0,
        active_human_escalations: 1,
        trending_reason_codes: [{ reason_code: 'CHASE_LOSS', count: 4 }],
      },
      audit_window: [
        {
          event_id: 'aud-1',
          sequence_number: 100n,
          event_type: 'PURCHASE',
          correlation_id: 'corr-1',
          actor_id: 'u-1',
          occurred_at_utc: '2026-04-25T11:55:00Z',
          payload_hash: 'a'.repeat(64),
          hash_prior: '0'.repeat(64),
          hash_current: 'b'.repeat(64),
        },
      ],
    });

    expect(view.liquidity.open_diamond_wallets).toBe(2);
    expect(view.liquidity.expiring_within_48h).toBe(1);
    // Both wallets ($15k + $50k) exceed the $10k personal-touch threshold.
    expect(view.liquidity.high_balance_wallets).toBe(2);
    expect(view.warning_queue).toHaveLength(1);
    expect(view.personal_touch_queue.length).toBe(2);
    expect(view.open_token_bridge_cards).toHaveLength(1);
    expect(view.open_three_fifths_cards[0].policy_gated).toBe(true);
    expect(view.gateguard_feed[0].decision).toBe('APPROVE');
    expect(view.welfare_panel.active_cooldowns).toBe(2);
    expect(view.audit_chain_window).toHaveLength(1);
    expect(view.rule_applied_id).toBe('DIAMOND_CONCIERGE_UI_v1');
  });

  it('builds recovery command-center view with stage counts', () => {
    const presenter = new RecoveryPresenter();
    const view = presenter.buildRecoveryCommandCenterView({
      now_utc: new Date('2026-04-25T12:00:00Z'),
      cases: [
        {
          case_id: 'rec_1',
          wallet_id: 'w-1',
          user_id: 'u-1',
          stage: 'TOKEN_BRIDGE_OFFERED',
          opened_at_utc: '2026-04-24T12:00:00Z',
          remaining_balance_tokens: 1000n,
          original_purchase_price_usd_cents: 12_000n,
          flags: ['RESTRICTION_WINDOW_ACTIVE'],
        },
        {
          case_id: 'rec_2',
          wallet_id: 'w-2',
          user_id: 'u-2',
          stage: 'EXPIRATION_PROCESSED',
          opened_at_utc: '2026-04-23T12:00:00Z',
          remaining_balance_tokens: 0n,
          original_purchase_price_usd_cents: 5_000n,
          flags: [],
        },
      ],
      audit_window: [],
    });
    expect(view.cases_by_stage.TOKEN_BRIDGE_OFFERED).toBe(1);
    expect(view.cases_by_stage.EXPIRATION_PROCESSED).toBe(1);
    expect(view.open_cases).toHaveLength(1);
    expect(view.open_cases[0].case_id).toBe('rec_1');
  });
});
