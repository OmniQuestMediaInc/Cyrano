// PAYLOAD 8 — Unit tests for Payload-7 UI presenters.

import { DiamondConciergePresenter } from '../../ui/view-models/diamond-concierge.presenter';
import { CreatorControlPresenter } from '../../ui/view-models/creator-control.presenter';
import {
  PublicWalletPresenter,
  DEFAULT_GOVERNANCE_SNAPSHOT,
} from '../../ui/view-models/public-wallet.presenter';
import { renderDiamondPage } from '../../ui/app/admin/diamond/page';
import { renderRecoveryPage } from '../../ui/app/admin/recovery/page';
import { renderCreatorControlPage } from '../../ui/app/creator/control/page';
import { renderTokensPage } from '../../ui/app/tokens/page';
import { renderDiamondPurchasePage } from '../../ui/app/diamond/purchase/page';
import { renderWalletPage } from '../../ui/app/wallet/page';
import { collectTestIds, findByTestId } from '../../ui/components/render-plan';
import { THEME, paletteFor, heatColorFor } from '../../ui/config/theme';
import { resolveBuildConfig } from '../../ui/config/build-config';
import { SEO } from '../../ui/config/seo';
import {
  contrastTextFor,
  heatTierAriaLabel,
  resolveBreakpoint,
} from '../../ui/config/accessibility';

describe('THEME + accessibility primitives', () => {
  it('defaults to dark mode (adult-platform standard)', () => {
    expect(THEME.default_mode).toBe('dark');
  });

  it('resolves heat-tier colors', () => {
    expect(heatColorFor('INFERNO')).toMatch(/^#/);
    expect(heatColorFor('COLD')).not.toBe(heatColorFor('INFERNO'));
  });

  it('resolveBreakpoint maps known viewports', () => {
    expect(resolveBreakpoint(320)).toBe('mobile');
    expect(resolveBreakpoint(800)).toBe('tablet');
    expect(resolveBreakpoint(1366)).toBe('desktop');
    expect(resolveBreakpoint(1920)).toBe('wide');
  });

  it('contrastTextFor returns the inverse text for bright surfaces', () => {
    const text = contrastTextFor('#ffffff', 'light');
    expect(text).toBe(paletteFor('light').text_inverse);
  });

  it('heatTierAriaLabel produces a screen-reader friendly string', () => {
    expect(heatTierAriaLabel('HOT', 70)).toContain('Room heat hot');
  });
});

describe('Build config + SEO', () => {
  it('local config disables telemetry; production enables it', () => {
    expect(resolveBuildConfig('local').enable_telemetry).toBe(false);
    expect(resolveBuildConfig('production').enable_telemetry).toBe(true);
  });

  it('admin / wallet routes are noindex,nofollow', () => {
    expect(SEO.admin_diamond.robots).toBe('noindex,nofollow');
    expect(SEO.admin_recovery.robots).toBe('noindex,nofollow');
    expect(SEO.wallet.robots).toBe('noindex,nofollow');
    expect(SEO.creator_control.robots).toBe('noindex,nofollow');
  });

  it('public routes are index,follow', () => {
    expect(SEO.tokens.robots).toBe('index,follow');
    expect(SEO.diamond_purchase.robots).toBe('index,follow');
    expect(SEO.home.robots).toBe('index,follow');
  });
});

describe('PublicWalletPresenter — token bundles', () => {
  it('emits Tease Regular rows for a guest', () => {
    const card = new PublicWalletPresenter().buildTokenBundleRateCard({
      tier: 'GUEST',
      now_utc: new Date('2026-04-25T00:00:00Z'),
    });
    expect(card.rows).toHaveLength(5);
    expect(card.rows[0].display_price_usd).toBe(card.rows[0].guest_price_usd);
  });

  it('emits Tease Regular at member price for members', () => {
    const card = new PublicWalletPresenter().buildTokenBundleRateCard({
      tier: 'MEMBER',
    });
    expect(card.rows[0].display_price_usd).toBe(card.rows[0].member_price_usd);
    expect(card.rows[0].discount_for_members_pct).not.toBeNull();
  });

  it('marks the promoted bundle row', () => {
    const card = new PublicWalletPresenter().buildTokenBundleRateCard({
      tier: 'GUEST',
      promoted_bundle_tokens: 5_000,
    });
    const promoted = card.rows.find((r) => r.is_promoted);
    expect(promoted?.tokens).toBe(5_000);
  });
});

describe('PublicWalletPresenter — Diamond quote', () => {
  it('rejects volume below 10k', () => {
    expect(() =>
      new PublicWalletPresenter().buildDiamondQuote({
        tokens: 5_000,
        velocity_days: 30,
      }),
    ).toThrow(/DIAMOND_MIN_VOLUME_NOT_MET/);
  });

  it('applies the platform floor at 0.077 when multiplied below it', () => {
    const q = new PublicWalletPresenter().buildDiamondQuote({
      tokens: 60_000,
      velocity_days: 366,
      now_utc: new Date('2026-04-25T00:00:00Z'),
    });
    // 0.082 * 0.85 = 0.0697 → below 0.077 floor
    expect(q.platform_floor_applied).toBe(true);
    expect(q.platform_rate_usd).toBe(0.077);
  });

  it('does NOT apply floor when effective rate above 0.077', () => {
    const q = new PublicWalletPresenter().buildDiamondQuote({
      tokens: 10_000,
      velocity_days: 14,
    });
    expect(q.platform_floor_applied).toBe(false);
    expect(q.platform_rate_usd).toBeGreaterThan(0.077);
  });
});

describe('PublicWalletPresenter — wallet view', () => {
  it('marks the first non-empty bucket as draining next', () => {
    const v = new PublicWalletPresenter().buildWalletView({
      wallet_id: 'w-1',
      user_id: 'u-1',
      tier: 'GUEST',
      balances: { purchased: 0n, membership: 100n, bonus: 50n },
    });
    const draining = v.buckets.find((b) => b.will_drain_next);
    expect(draining?.bucket).toBe('membership');
  });

  it('preserves canonical spend order', () => {
    const v = new PublicWalletPresenter().buildWalletView({
      wallet_id: 'w-2',
      user_id: 'u-2',
      tier: 'MEMBER',
      balances: { purchased: 10n, membership: 20n, bonus: 30n },
    });
    expect(v.buckets.map((b) => b.bucket)).toEqual(['purchased', 'membership', 'bonus']);
    expect(v.total_tokens).toBe('60');
  });
});

describe('DiamondConciergePresenter — full page render', () => {
  it('produces a page tree with stable test ids', () => {
    const render = renderDiamondPage({
      now_utc: new Date('2026-04-25T12:00:00Z'),
      open_wallets: [],
      token_bridge_offers: [],
      three_fifths_offers: [],
      gateguard_events: [],
      welfare_cohort: {
        cohort_average_welfare_score: 20,
        cohort_average_fraud_score: 15,
        active_cooldowns: 0,
        active_hard_declines: 0,
        active_human_escalations: 0,
        trending_reason_codes: [],
      },
      audit_window: [],
    });
    const ids = collectTestIds(render.tree);
    expect(ids).toContain('admin-diamond-page');
    expect(ids).toContain('admin-diamond-kpi-strip');
    expect(ids).toContain('admin-diamond-liquidity');
    expect(ids).toContain('admin-diamond-warning-queue');
    expect(ids).toContain('admin-diamond-personal-touch');
    expect(ids).toContain('admin-diamond-token-bridge');
    expect(ids).toContain('admin-diamond-three-fifths');
    expect(ids).toContain('admin-diamond-gateguard-feed');
    expect(ids).toContain('admin-diamond-welfare-panel');
    expect(ids).toContain('admin-diamond-audit-chain');
  });

  it('renders the recovery page with stage counts', () => {
    const render = renderRecoveryPage({
      cases: [],
      audit_window: [],
    });
    expect(findByTestId(render.tree, 'admin-recovery-stage-counts')).toBeDefined();
    expect(findByTestId(render.tree, 'admin-recovery-open-cases')).toBeDefined();
    expect(findByTestId(render.tree, 'admin-recovery-audit-trail')).toBeDefined();
  });

  it('renders the creator control page with all panels', () => {
    const render = renderCreatorControlPage({
      creator_id: 'creator-1',
      display_name: 'Creator One',
      obs_ready: true,
      chat_aggregator_ready: false,
      active_session_id: null,
      latest_heat: null,
      latest_nudge: null,
      broadcast_windows: [],
      cyrano_suggestions: [],
      cyrano_personas: [],
      cyrano_latency_sla_ms: 2000,
      creator_base_payout_rate_per_token_usd: 0.075,
    });
    expect(findByTestId(render.tree, 'creator-control-page')).toBeDefined();
    expect(findByTestId(render.tree, 'creator-control-heat-meter')).toBeDefined();
    expect(findByTestId(render.tree, 'creator-control-cyrano-panel')).toBeDefined();
    expect(findByTestId(render.tree, 'creator-control-broadcast-timing')).toBeDefined();
    expect(findByTestId(render.tree, 'creator-control-persona-switcher')).toBeDefined();
  });

  it('renders the public token bundles page', () => {
    const render = renderTokensPage({ tier: 'GUEST' });
    expect(findByTestId(render.tree, 'tokens-page')).toBeDefined();
    expect(findByTestId(render.tree, 'tokens-tease-regular')).toBeDefined();
  });

  it('renders the Diamond purchase page', () => {
    const render = renderDiamondPurchasePage({
      tokens: 10_000,
      velocity_days: 30,
      now_utc: new Date('2026-04-25T00:00:00Z'),
    });
    expect(findByTestId(render.tree, 'diamond-purchase-page')).toBeDefined();
    expect(findByTestId(render.tree, 'diamond-quote-card')).toBeDefined();
    expect(findByTestId(render.tree, 'diamond-purchase-confirm')).toBeDefined();
  });

  it('renders the wallet page with three buckets', () => {
    const render = renderWalletPage({
      wallet_id: 'w-1',
      user_id: 'u-1',
      tier: 'GUEST',
      balances: { purchased: 100n, membership: 0n, bonus: 50n },
    });
    expect(findByTestId(render.tree, 'wallet-page')).toBeDefined();
    expect(findByTestId(render.tree, 'wallet-bucket-purchased')).toBeDefined();
    expect(findByTestId(render.tree, 'wallet-bucket-membership')).toBeDefined();
    expect(findByTestId(render.tree, 'wallet-bucket-bonus')).toBeDefined();
  });
});

describe('CreatorControlPresenter — payout scaling', () => {
  it('applies +10% scaling at INFERNO tier', () => {
    const view = new CreatorControlPresenter().buildPayoutRate(
      'creator-1',
      0.075,
      'INFERNO',
      new Date('2026-04-25T00:00:00Z'),
    );
    expect(view.scaling_pct_applied).toBe(10);
    // 0.075 * 1.10 = 0.0825 → within REDBOOK band.
    expect(view.current_rate_per_token_usd).toBeCloseTo(0.0825, 4);
  });

  it('clamps to REDBOOK ceiling at high base + scaling', () => {
    const view = new CreatorControlPresenter().buildPayoutRate(
      'creator-1',
      0.085,
      'INFERNO',
      new Date('2026-04-25T00:00:00Z'),
    );
    // 0.085 * 1.10 = 0.0935 → clamped to 0.090
    expect(view.current_rate_per_token_usd).toBeLessThanOrEqual(view.redbook_ceiling_per_token_usd);
  });
});

describe('Governance snapshot defaults pin to canonical values', () => {
  it('REDBOOK §3 Tease Regular bundles intact', () => {
    expect(DEFAULT_GOVERNANCE_SNAPSHOT.tease_regular[0]).toMatchObject({
      tokens: 150,
      guest_usd: 19.99,
      member_usd: 17.99,
    });
  });

  it('Diamond platform floor is $0.077', () => {
    expect(DEFAULT_GOVERNANCE_SNAPSHOT.diamond_platform_floor_per_token_usd).toBe(0.077);
  });

  it('Recovery: 20% Token Bridge bonus + 60% 3/5ths refund', () => {
    expect(DEFAULT_GOVERNANCE_SNAPSHOT.token_bridge_bonus_pct).toBe(0.2);
    expect(DEFAULT_GOVERNANCE_SNAPSHOT.three_fifths_refund_pct).toBe(0.6);
  });

  it('LEDGER_SPEND_ORDER is purchased → membership → bonus', () => {
    expect(DEFAULT_GOVERNANCE_SNAPSHOT.ledger_spend_order).toEqual([
      'purchased',
      'membership',
      'bonus',
    ]);
  });
});
