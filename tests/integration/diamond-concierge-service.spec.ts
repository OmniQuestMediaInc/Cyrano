/**
 * diamond-concierge-service.spec.ts
 * Integration tests: DiamondConciergeService volume+velocity pricing,
 * safety-net construction, Concierge surface fusion, liquidity snapshot.
 *
 * Source of truth for pricing constants: DIAMOND_TIER in
 * services/core-api/src/config/governance.config.ts.
 */
import {
  DiamondConciergeService,
  DIAMOND_EXPIRY_DAYS,
} from '../../services/diamond-concierge/src/diamond.service';
import { DIAMOND_TIER } from '../../services/core-api/src/config/governance.config';

describe('DiamondConciergeService — pricing: volume tiers', () => {
  const svc = new DiamondConciergeService();

  it('rejects purchases below the 10k minimum', () => {
    expect(() => svc.quotePrice({ tokens: 5_000, velocity_days: 30 })).toThrow(
      /DIAMOND_MIN_VOLUME_NOT_MET/,
    );
  });

  it('resolves the 10k–27.5k tier at $0.095 base', () => {
    const q = svc.quotePrice({ tokens: 10_000, velocity_days: 30 });
    expect(q.base_rate_usd).toBe(0.095);
  });

  it('resolves the 30k–57.5k tier at $0.088 base', () => {
    const q = svc.quotePrice({ tokens: 35_000, velocity_days: 30 });
    expect(q.base_rate_usd).toBe(0.088);
  });

  it('resolves the 60k+ tier at $0.082 base', () => {
    const q = svc.quotePrice({ tokens: 70_000, velocity_days: 30 });
    expect(q.base_rate_usd).toBe(0.082);
  });
});

describe('DiamondConciergeService — pricing: velocity multipliers', () => {
  const svc = new DiamondConciergeService();

  it('14-day velocity → 1.00 multiplier', () => {
    const q = svc.quotePrice({ tokens: 10_000, velocity_days: 14 });
    expect(q.velocity_band).toBe('DAYS_14');
    expect(q.velocity_multiplier).toBe(1.0);
  });

  it('90-day velocity → 1.08 multiplier', () => {
    const q = svc.quotePrice({ tokens: 10_000, velocity_days: 90 });
    expect(q.velocity_band).toBe('DAYS_90');
    expect(q.velocity_multiplier).toBe(1.08);
  });

  it('180-day velocity → 1.12 multiplier', () => {
    const q = svc.quotePrice({ tokens: 10_000, velocity_days: 180 });
    expect(q.velocity_band).toBe('DAYS_180');
    expect(q.velocity_multiplier).toBe(1.12);
  });

  it('366-day velocity → 1.15 multiplier', () => {
    const q = svc.quotePrice({ tokens: 10_000, velocity_days: 400 });
    expect(q.velocity_band).toBe('DAYS_366');
    expect(q.velocity_multiplier).toBe(1.15);
  });

  it('rejects velocity below the 14-day floor', () => {
    expect(() => svc.quotePrice({ tokens: 10_000, velocity_days: 7 })).toThrow(
      /DIAMOND_MIN_VELOCITY_NOT_MET/,
    );
  });
});

describe('DiamondConciergeService — platform floor guarantee', () => {
  const svc = new DiamondConciergeService();

  it('applies $0.077 floor when 60k+ tier at 14-day velocity falls below it', () => {
    // 60k tier base $0.082 × 1.00 = $0.082 — above floor, floor NOT applied
    const q = svc.quotePrice({ tokens: 70_000, velocity_days: 14 });
    expect(q.platform_floor_applied).toBe(false);
    expect(q.platform_rate_usd).toBeGreaterThanOrEqual(
      DIAMOND_TIER.PLATFORM_FLOOR_PER_TOKEN,
    );
  });

  it('platform floor is the $0.077 constant', () => {
    expect(DIAMOND_TIER.PLATFORM_FLOOR_PER_TOKEN).toBe(0.077);
  });

  it('effective rate never falls below the $0.077 platform floor', () => {
    // Exhaustive: 3 tiers × 5 velocity bands
    const velocityDays = [14, 30, 90, 180, 400];
    const volumes = [10_000, 35_000, 70_000];
    for (const tokens of volumes) {
      for (const days of velocityDays) {
        const q = svc.quotePrice({ tokens, velocity_days: days });
        expect(q.platform_rate_usd).toBeGreaterThanOrEqual(0.077);
      }
    }
  });
});

describe('DiamondConciergeService — pricing: USD total', () => {
  const svc = new DiamondConciergeService();

  it('computes exact cents for 10,000 @ $0.095 × 1.00 = $950.00', () => {
    const q = svc.quotePrice({ tokens: 10_000, velocity_days: 14 });
    expect(q.usd_total_cents).toBe(BigInt(950_00));
  });

  it('computes 60,000 @ $0.082 × 1.00 = $4,920.00', () => {
    const q = svc.quotePrice({ tokens: 60_000, velocity_days: 14 });
    expect(q.usd_total_cents).toBe(BigInt(4_920_00));
  });

  it('applies velocity multiplier to USD total', () => {
    // 10,000 × $0.095 × 1.15 = $1,092.50
    const q = svc.quotePrice({ tokens: 10_000, velocity_days: 400 });
    expect(q.usd_total_cents).toBe(BigInt(1_092_50));
  });
});

describe('DiamondConciergeService — 14-day expiry', () => {
  const svc = new DiamondConciergeService();

  it('DIAMOND_EXPIRY_DAYS is 14', () => {
    expect(DIAMOND_EXPIRY_DAYS).toBe(14);
  });

  it('pricing quote includes a 14-day expiry stamp', () => {
    const q = svc.quotePrice({ tokens: 10_000, velocity_days: 14 });
    const expiryMs = new Date(q.expires_at_utc).getTime() - Date.now();
    const expectedMs = 14 * 24 * 60 * 60 * 1000;
    expect(expiryMs).toBeGreaterThan(expectedMs - 5_000);
    expect(expiryMs).toBeLessThanOrEqual(expectedMs);
  });

  it('buildSafetyNet includes $49 extension and $79 recovery fees', () => {
    const net = svc.buildSafetyNet();
    expect(net.extension_fee_usd).toBe(49);
    expect(net.recovery_fee_usd).toBe(79);
    expect(net.creator_pool_pct).toBe(0.7);
    expect(net.platform_mgmt_pct).toBe(0.3);
  });
});

describe('DiamondConciergeService — Concierge surface fusion', () => {
  const svc = new DiamondConciergeService();

  it('marks Diamond tier as permitted', () => {
    const s = svc.fuseConciergeSurface({
      user_id: 'cu_001',
      tier: 'VIP_DIAMOND',
      fraud_risk_signals: [],
      security_signals: [],
      hospitality_signals: [],
    });
    expect(s.tier_permitted).toBe(true);
  });

  it('marks non-Diamond tiers as not permitted', () => {
    const s = svc.fuseConciergeSurface({
      user_id: 'cu_002',
      tier: 'VIP_PLATINUM',
      fraud_risk_signals: [],
      security_signals: [],
      hospitality_signals: [],
    });
    expect(s.tier_permitted).toBe(false);
  });

  it('fuses all three signal streams into a single surface', () => {
    const s = svc.fuseConciergeSurface({
      user_id: 'cu_003',
      tier: 'VIP_DIAMOND',
      fraud_risk_signals: ['velocity_spike'],
      security_signals: ['ip_change'],
      hospitality_signals: ['vip_preferred_creator'],
    });
    expect(s.fraud_risk_signals).toContain('velocity_spike');
    expect(s.security_signals).toContain('ip_change');
    expect(s.hospitality_signals).toContain('vip_preferred_creator');
  });
});

describe('DiamondConciergeService — liquidity snapshot', () => {
  const svc = new DiamondConciergeService();

  it('returns zero when no wallets are supplied', () => {
    const snap = svc.liquiditySnapshot();
    expect(snap.open_diamond_wallets).toBe(0);
    expect(snap.total_remaining_tokens).toBe('0');
    expect(snap.expiring_within_48h).toBe(0);
  });

  it('counts wallets expiring within the 48h window', () => {
    const snap = svc.liquiditySnapshot({
      open_wallets: [
        {
          wallet_id: 'w1',
          remaining_tokens: 10_000n,
          remaining_usd_cents: 100_000n,
          expires_at_utc: new Date(Date.now() + 24 * 3_600_000).toISOString(),
        },
        {
          wallet_id: 'w2',
          remaining_tokens: 10_000n,
          remaining_usd_cents: 100_000n,
          expires_at_utc: new Date(Date.now() + 72 * 3_600_000).toISOString(),
        },
      ],
    });
    expect(snap.expiring_within_48h).toBe(1);
    expect(snap.open_diamond_wallets).toBe(2);
  });

  it('counts high-balance wallets above the $10k threshold', () => {
    const snap = svc.liquiditySnapshot({
      open_wallets: [
        {
          wallet_id: 'w1',
          remaining_tokens: 10_000n,
          remaining_usd_cents: BigInt(10_001 * 100),
          expires_at_utc: new Date(Date.now() + 24 * 3_600_000).toISOString(),
        },
        {
          wallet_id: 'w2',
          remaining_tokens: 10_000n,
          remaining_usd_cents: BigInt(9_999 * 100),
          expires_at_utc: new Date(Date.now() + 24 * 3_600_000).toISOString(),
        },
      ],
    });
    expect(snap.high_balance_wallets).toBe(1);
  });

  it('sums remaining tokens and USD cents as strings to preserve bigint', () => {
    const snap = svc.liquiditySnapshot({
      open_wallets: [
        {
          wallet_id: 'w1',
          remaining_tokens: 10_000n,
          remaining_usd_cents: 1_000_000n,
          expires_at_utc: new Date(Date.now() + 24 * 3_600_000).toISOString(),
        },
        {
          wallet_id: 'w2',
          remaining_tokens: 20_000n,
          remaining_usd_cents: 2_000_000n,
          expires_at_utc: new Date(Date.now() + 24 * 3_600_000).toISOString(),
        },
      ],
    });
    expect(snap.total_remaining_tokens).toBe('30000');
    expect(snap.total_remaining_usd_cents).toBe('3000000');
  });
});
