/**
 * tests/e2e/ui-presenters.spec.ts
 * CYR: UI presenters — every presenter class produces a contract-shaped view
 *
 * Closes ship-gate E2E-1. Verifies the @alpha-frozen presenter contracts
 * for /admin/diamond, /admin/recovery, /creator/control, /wallet, and
 * confirms the slot-machine presenter is fully retired (throws on call).
 * Hermetic — pure TypeScript, no I/O.
 */

import { PublicWalletPresenter } from '../../ui/view-models/public-wallet.presenter';
import { CreatorControlPresenter } from '../../ui/view-models/creator-control.presenter';
import {
  DiamondConciergePresenter,
  RecoveryPresenter,
} from '../../ui/view-models/diamond-concierge.presenter';
import {
  presentCreatorGamificationDashboard,
  RETIRED_GAME_TYPES,
} from '../../ui/view-models/gamification.presenter';
import { renderSlotMachine } from '../../ui/components/slot-machine';
import { SEO } from '../../ui/config/seo';
import type {
  CreatorCommandCenterView,
} from '../../ui/types/creator-panel-contracts';
import type {
  DiamondCommandCenterView,
  RecoveryCommandCenterView,
} from '../../ui/types/admin-diamond-contracts';
import type {
  WalletThreeBucketView,
} from '../../ui/types/public-wallet-contracts';

describe('PublicWalletPresenter — /wallet, /tokens, /diamond/purchase', () => {
  const presenter = new PublicWalletPresenter();

  it('builds a TokenBundleRateCard for guests', () => {
    const card = presenter.buildTokenBundleRateCard({
      tier: 'GUEST',
    });
    expect(card.tier).toBe('GUEST');
    expect(Array.isArray(card.rows)).toBe(true);
    expect(card.rows.length).toBeGreaterThan(0);
    expect(card.rule_applied_id).toBeTruthy();
  });

  it('builds a DiamondPurchaseQuoteCard with a velocity band', () => {
    const card = presenter.buildDiamondQuote({
      tokens: 50_000,
      velocity_days: 30,
    });
    expect(card.velocity_band).toBe('DAYS_30');
    expect(typeof card.platform_floor_applied).toBe('boolean');
    expect(card.platform_floor_per_token_usd).toBe(0.077);
  });

  it('builds a WalletThreeBucketView with three buckets in canonical order', () => {
    const view: WalletThreeBucketView = presenter.buildWalletView({
      wallet_id: 'wlt_p1',
      user_id: 'usr_p1',
      tier: 'MEMBER',
      balances: { purchased: 100n, membership: 200n, bonus: 50n },
    });
    expect(view.buckets.map((b) => b.bucket)).toEqual(['purchased', 'membership', 'bonus']);
    expect(view.total_tokens).toBe('350');
  });
});

describe('CreatorControlPresenter — /creator/control', () => {
  const presenter = new CreatorControlPresenter();

  it('builds a CreatorCommandCenterView with all required sub-panels', () => {
    const view: CreatorCommandCenterView = presenter.buildCommandCenterView({
      creator_id: 'crt_p1',
      display_name: 'Presenter Test',
      obs_ready: true,
      chat_aggregator_ready: true,
      active_session_id: 'sess_p1',
      latest_heat: {
        session_id: 'sess_p1',
        creator_id: 'crt_p1',
        tier: 'WARM',
        score: 50,
        components: { tipper_pressure: 20, velocity: 20, vip_presence: 10 },
        captured_at_utc: new Date().toISOString(),
      },
      latest_nudge: null,
      broadcast_windows: [],
      cyrano_suggestions: [],
      cyrano_personas: [],
      cyrano_latency_sla_ms: 2000,
      creator_base_payout_rate_per_token_usd: 0.075,
    });
    expect(view.creator_id).toBe('crt_p1');
    expect(view.heat_meter).not.toBeNull();
    expect(view.session_monitoring).toBeDefined();
    expect(view.broadcast_timing).toBeDefined();
    expect(view.cyrano_panel).toBeDefined();
    expect(view.payout_rate).toBeDefined();
    expect(view.rule_applied_id).toBeTruthy();
  });
});

describe('DiamondConciergePresenter — /admin/diamond', () => {
  const presenter = new DiamondConciergePresenter();

  it('builds a DiamondCommandCenterView with empty inputs', () => {
    const view: DiamondCommandCenterView = presenter.buildCommandCenterView({
      open_wallets: [],
      gateguard_events: [],
      welfare_cohort: {
        cohort_average_welfare_score: 0,
        cohort_average_fraud_score: 0,
        active_cooldowns: 0,
        active_hard_declines: 0,
        active_human_escalations: 0,
        trending_reason_codes: [],
      },
      audit_window: [],
      token_bridge_offers: [],
      three_fifths_offers: [],
    });
    expect(view.liquidity).toBeDefined();
    expect(view.warning_queue).toEqual([]);
    expect(view.personal_touch_queue).toEqual([]);
    expect(view.gateguard_feed).toEqual([]);
    expect(view.welfare_panel).toBeDefined();
    expect(view.audit_chain_window).toEqual([]);
    expect(view.rule_applied_id).toBeTruthy();
  });
});

describe('RecoveryPresenter — /admin/recovery', () => {
  const presenter = new RecoveryPresenter();

  it('builds a RecoveryCommandCenterView with empty inputs', () => {
    const view: RecoveryCommandCenterView = presenter.buildRecoveryCommandCenterView({
      cases: [],
      audit_window: [],
    });
    expect(view.cases_by_stage).toBeDefined();
    expect(view.open_cases).toEqual([]);
    expect(view.audit_trail_window).toEqual([]);
    expect(view.rule_applied_id).toBeTruthy();
  });
});

describe('Gamification dashboard — slot machine never surfaces in UI', () => {
  // Defends against regressions where SLOT_MACHINE re-enters via the
  // backend GAMIFICATION.GAME_TYPES constant or via a creator-config row.
  // The presenter's RETIRED_GAME_TYPES filter is the single chokepoint.

  it('RETIRED_GAME_TYPES includes SLOT_MACHINE', () => {
    expect(RETIRED_GAME_TYPES).toContain('SLOT_MACHINE');
  });

  it('dashboard cards never contain a SLOT_MACHINE entry, even when configs include one', () => {
    const dashboard = presentCreatorGamificationDashboard({
      creator_id: 'crt_retired_1',
      pools: [
        {
          pool_id: 'pool_slot',
          creator_id: 'crt_retired_1',
          name: 'Retired Slot Pool',
          scoped_game_type: 'SLOT_MACHINE',
          version: 'v1',
          rule_applied_id: 'TEST',
          created_at_utc: new Date().toISOString(),
          is_active: true,
          entries: [],
        },
        {
          pool_id: 'pool_wheel',
          creator_id: 'crt_retired_1',
          name: 'Wheel Pool',
          scoped_game_type: 'SPIN_WHEEL',
          version: 'v1',
          rule_applied_id: 'TEST',
          created_at_utc: new Date().toISOString(),
          is_active: true,
          entries: [],
        },
      ],
      configs: [
        {
          config_id: 'cfg_slot',
          creator_id: 'crt_retired_1',
          game_type: 'SLOT_MACHINE',
          token_tiers: [25],
          prize_pool_id: 'pool_slot',
          cooldown_seconds_override: null,
          enabled: true,
          accepts_rrr_burn: false,
          version: 'v1',
          rule_applied_id: 'TEST',
        } as never,
      ],
      analytics: {
        creator_id: 'crt_retired_1',
        window_days: 30,
        per_game: [],
        generated_at_utc: new Date().toISOString(),
      } as never,
      rrr_burn_globally_enabled: false,
    });

    const slotCards = dashboard.cards.filter((c) => c.game_type === 'SLOT_MACHINE');
    expect(slotCards).toHaveLength(0);
    const slotPools = dashboard.pools.filter((p) => p.scoped_game_type === 'SLOT_MACHINE');
    expect(slotPools).toHaveLength(0);
  });

  it('SEO copy for /creator/gamification does not mention Slot Machine', () => {
    const meta = SEO.creator_gamification;
    expect(meta).toBeDefined();
    expect(meta.description.toLowerCase()).not.toContain('slot');
    expect(meta.keywords.map((k) => k.toLowerCase())).not.toContain('slots');
    expect(meta.keywords.map((k) => k.toLowerCase())).not.toContain('slot machine');
  });
});

describe('Slot machine — RETIRED throw-stub', () => {
  it('renderSlotMachine throws with the canonical retirement message', () => {
    expect(() =>
      renderSlotMachine({
        creator_id: 'crt_retired',
        entries: [],
        selected_token_tier: 1,
        selected_payment: 'CZT',
        ready: true,
        cooldown_message: null,
      }),
    ).toThrow(/RETIRED/);
  });

  it('the retirement message references the UX_INTEGRATION_BRIEF', () => {
    try {
      renderSlotMachine({
        creator_id: 'crt_retired',
        entries: [],
        selected_token_tier: 1,
        selected_payment: 'CZT',
        ready: true,
        cooldown_message: null,
      });
      fail('expected slot machine renderer to throw');
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain('UX_INTEGRATION_BRIEF.md');
      expect(msg).toMatch(/Wheel of Fortune|Wheel|Dice/i);
    }
  });
});
