// FIZ: PAYLOAD-001 — REDBOOK rate card integration tests
// Asserts bundle pricing, Diamond quotes, and Room-Heat payout resolution
// all read cleanly through the canonical governance constants.

import { RedbookRateCardService } from '../../services/ledger';
import {
  REDBOOK_RATE_CARDS,
  DIAMOND_TIER,
} from '../../services/core-api/src/config/governance.config';
import { GovernanceConfig } from '../../services/core-api/src/governance/governance.config';

const svc = new RedbookRateCardService();

describe('RedbookRateCardService — Tease Regular bundles', () => {
  it.each(REDBOOK_RATE_CARDS.TEASE_REGULAR.map((r) => r.tokens))(
    'quotes guest price for %i-token bundle',
    (tokens) => {
      const quote = svc.quoteTeaseRegular(tokens, 'guest');
      const row = REDBOOK_RATE_CARDS.TEASE_REGULAR.find((r) => r.tokens === tokens)!;
      expect(quote.priceUsd).toBe(row.guest_usd);
      expect(quote.creatorPayoutPerToken).toBe(row.creator_payout_per_token);
      expect(quote.unitPriceUsd).toBeCloseTo(row.guest_usd / tokens, 6);
    },
  );

  it('applies member pricing to creator users', () => {
    const tokens = REDBOOK_RATE_CARDS.TEASE_REGULAR[2].tokens;
    const expected = REDBOOK_RATE_CARDS.TEASE_REGULAR[2].member_usd;
    const quote = svc.quoteTeaseRegular(tokens, 'creator');
    expect(quote.priceUsd).toBe(expected);
  });

  it('throws on an unknown bundle size', () => {
    expect(() => svc.quoteTeaseRegular(777, 'guest')).toThrow(/bundle not found/);
  });
});

describe('RedbookRateCardService — Diamond Tier', () => {
  it.each(DIAMOND_TIER.VOLUME_TIERS)('resolves the $min_tokens bracket', (bracket) => {
    const quote = svc.quoteDiamond(bracket.min_tokens, 14);
    expect(quote.baseRate).toBe(bracket.base_rate);
    expect(quote.velocityMultiplier).toBe(DIAMOND_TIER.VELOCITY_MULTIPLIERS.DAYS_14);
  });

  it('applies the 180-day velocity multiplier', () => {
    const quote = svc.quoteDiamond(30_000, 180);
    expect(quote.velocityMultiplier).toBe(DIAMOND_TIER.VELOCITY_MULTIPLIERS.DAYS_180);
    expect(quote.effectivePayoutPerToken).toBeCloseTo(
      quote.baseRate * DIAMOND_TIER.VELOCITY_MULTIPLIERS.DAYS_180,
      6,
    );
  });

  it('refuses volumes below the Diamond entry threshold', () => {
    expect(() => svc.quoteDiamond(5_000, 14)).toThrow(/below entry threshold/);
  });
});

describe('RedbookRateCardService — FFS payout resolution', () => {
  it('returns Cold rate for heat score 0', () => {
    const rate = svc.resolveCreatorPayoutRate({ heatScore: 0, diamondFloorActive: false });
    expect(rate.level).toBe('cold');
    expect(rate.ratePerToken).toBe(GovernanceConfig.RATE_COLD.toNumber());
    expect(rate.appliedFloor).toBe(false);
  });

  it('returns Inferno rate at heat 86+', () => {
    const rate = svc.resolveCreatorPayoutRate({ heatScore: 95, diamondFloorActive: false });
    expect(rate.level).toBe('inferno');
    expect(rate.ratePerToken).toBe(GovernanceConfig.RATE_INFERNO.toNumber());
  });

  it('applies the Diamond floor when live rate is below $0.080', () => {
    const rate = svc.resolveCreatorPayoutRate({ heatScore: 10, diamondFloorActive: true });
    expect(rate.appliedFloor).toBe(true);
    expect(rate.ratePerToken).toBe(GovernanceConfig.RATE_DIAMOND_FLOOR.toNumber());
  });

  it('prefers live rate over Diamond floor when live rate is higher', () => {
    const rate = svc.resolveCreatorPayoutRate({ heatScore: 100, diamondFloorActive: true });
    expect(rate.appliedFloor).toBe(false);
    expect(rate.ratePerToken).toBe(GovernanceConfig.RATE_INFERNO.toNumber());
  });
});
