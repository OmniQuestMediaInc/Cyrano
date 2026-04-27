// FIZ: PAYLOAD-001 — REDBOOK Rate Card service
// Pure lookup layer over REDBOOK_RATE_CARDS + DIAMOND_TIER (governance.config).
// No hardcoded prices — every value resolves through the governance constant.

import {
  DIAMOND_TIER,
  REDBOOK_RATE_CARDS,
} from '../core-api/src/config/governance.config';
import type { HeatLevel, UserType, RateCardTier } from './types';
import { GovernanceConfig } from '../core-api/src/governance/governance.config';

export interface BundleQuote {
  tier: RateCardTier;
  tokens: number;
  priceUsd: number;
  creatorPayoutPerToken: number;
  platformMarginPerToken: number;
  unitPriceUsd: number;
}

export interface DiamondQuote {
  tokens: number;
  baseRate: number;       // USD/token from volume bracket
  velocityMultiplier: number;
  effectivePayoutPerToken: number;
  totalUsd: number;
  volumeBracket: { minTokens: number; maxTokens: number };
}

/**
 * Maps a Room-Heat score (0–100) to the canonical creator payout rate band.
 * Bands are LOCKED in GovernanceConfig (PAY-001…005) — never redefine locally.
 */
function resolveHeatRate(heatScore: number): { level: HeatLevel; ratePerToken: number } {
  if (heatScore >= GovernanceConfig.HEAT_BAND_HOT_MAX + 1) {
    return { level: 'inferno', ratePerToken: GovernanceConfig.RATE_INFERNO.toNumber() };
  }
  if (heatScore >= GovernanceConfig.HEAT_BAND_WARM_MAX + 1) {
    return { level: 'hot', ratePerToken: GovernanceConfig.RATE_HOT.toNumber() };
  }
  if (heatScore >= GovernanceConfig.HEAT_BAND_COLD_MAX + 1) {
    return { level: 'warm', ratePerToken: GovernanceConfig.RATE_WARM.toNumber() };
  }
  return { level: 'cold', ratePerToken: GovernanceConfig.RATE_COLD.toNumber() };
}

export class RedbookRateCardService {
  /**
   * Resolve a Tease Regular bundle quote for a guest/member purchase flow.
   * Member pricing applies whenever userType is not `guest`.
   */
  quoteTeaseRegular(tokens: number, userType: UserType): BundleQuote {
    const row = REDBOOK_RATE_CARDS.TEASE_REGULAR.find((r) => r.tokens === tokens);
    if (!row) {
      throw new Error(
        `REDBOOK bundle not found for ${tokens} tokens — valid sizes: ` +
          REDBOOK_RATE_CARDS.TEASE_REGULAR.map((r) => r.tokens).join(', '),
      );
    }
    const priceUsd = userType === 'guest' ? row.guest_usd : row.member_usd;
    const unit = priceUsd / row.tokens;
    return {
      tier: 'tease_regular',
      tokens: row.tokens,
      priceUsd,
      creatorPayoutPerToken: row.creator_payout_per_token,
      platformMarginPerToken: unit - row.creator_payout_per_token,
      unitPriceUsd: unit,
    };
  }

  /**
   * Resolve a Diamond Tier quote using volume + velocity lookup.
   * Volume bracket + velocity multiplier come from DIAMOND_TIER (governance).
   */
  quoteDiamond(tokens: number, lifespanDays: number): DiamondQuote {
    const bracket = DIAMOND_TIER.VOLUME_TIERS.find(
      (t) => tokens >= t.min_tokens && tokens <= t.max_tokens,
    );
    if (!bracket) {
      throw new Error(
        `Diamond volume ${tokens} is below entry threshold ${DIAMOND_TIER.VOLUME_TIERS[0].min_tokens}`,
      );
    }
    const velocity = this.resolveVelocity(lifespanDays);
    const effective = bracket.base_rate * velocity;
    return {
      tokens,
      baseRate: bracket.base_rate,
      velocityMultiplier: velocity,
      effectivePayoutPerToken: effective,
      totalUsd: effective * tokens,
      volumeBracket: { minTokens: bracket.min_tokens, maxTokens: bracket.max_tokens },
    };
  }

  /**
   * Resolve the live creator payout rate for a session close.
   * Room-Heat wins unless the Diamond floor ($0.080) is higher.
   */
  resolveCreatorPayoutRate(args: {
    heatScore: number;
    diamondFloorActive: boolean;
  }): { level: HeatLevel; ratePerToken: number; appliedFloor: boolean } {
    const live = resolveHeatRate(args.heatScore);
    const floor = GovernanceConfig.RATE_DIAMOND_FLOOR.toNumber();
    if (args.diamondFloorActive && live.ratePerToken < floor) {
      return { level: live.level, ratePerToken: floor, appliedFloor: true };
    }
    return { ...live, appliedFloor: false };
  }

  /**
   * All Tease Regular bundle sizes for display/catalog.
   * NOTE: ShowZone Premium bundles + ShowZone pass pricing have been removed
   * with the Single CZT Token Economy spec. SHOW_THEATRE venue admission
   * pricing now resolves through services/bijou/PassPricingService against
   * the venue-pricing constant (still denominated in CZT).
   */
  listTeaseRegularBundles(): ReadonlyArray<{ tokens: number; guest_usd: number; member_usd: number }> {
    return REDBOOK_RATE_CARDS.TEASE_REGULAR;
  }

  private resolveVelocity(lifespanDays: number): number {
    const v = DIAMOND_TIER.VELOCITY_MULTIPLIERS;
    if (lifespanDays >= 366) return v.DAYS_366;
    if (lifespanDays >= 180) return v.DAYS_180;
    if (lifespanDays >= 90) return v.DAYS_90;
    if (lifespanDays >= 30) return v.DAYS_30;
    return v.DAYS_14;
  }
}
