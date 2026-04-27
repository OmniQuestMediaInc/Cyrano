// services/bijou/src/pass-pricing.service.ts
import { Injectable } from '@nestjs/common';
import { BIJOU_PRICING, SHOWZONE_PRICING, GEO_PRICING } from
  '../../../services/core-api/src/config/governance.config';

export type VenueType = 'SHOWZONE' | 'BIJOU';
export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
export type CreatorTier = 'NEW' | 'RISING' | 'ESTABLISHED' | 'STAR';
export type AdvanceWindow = 'SAME_DAY' | 'ONE_TO_THREE' | 'FOUR_TO_SEVEN' | 'EIGHT_PLUS';
export type GeoTier = 'LOW' | 'MED' | 'HIGH';

export interface PassPriceInput {
  venue: VenueType;
  day_of_week: DayOfWeek;
  show_start_hour_toronto: number;  // 0–23 in America/Toronto
  creator_tier: CreatorTier;        // Used for ShowZone pricing; ignored for Bijou
  days_until_show: number;
  vip_geo_tier: GeoTier;
}

export interface PassPriceResult {
  base_tokens: number;
  day_multiplier: number;
  time_multiplier: number;
  creator_tier_multiplier: number;
  advance_multiplier: number;
  geo_multiplier: number;
  composite_multiplier: number;
  final_tokens: number;             // Rounded to nearest 10
  final_usd_estimate: number;
  multiplier_breakdown: Record<string, number>;
}

@Injectable()
export class PassPricingService {

  computePassPrice(input: PassPriceInput): PassPriceResult {
    const config = input.venue === 'BIJOU' ? BIJOU_PRICING : SHOWZONE_PRICING;

    const base = (config as typeof BIJOU_PRICING).ADMISSION_CZT_TOKENS_BASE ?? (SHOWZONE_PRICING as typeof SHOWZONE_PRICING).PASS_BASE_CZT_TOKENS;
    const day_multiplier = config.DAY_MULTIPLIERS[input.day_of_week];
    const time_multiplier = this.resolveTimeMultiplier(input.show_start_hour_toronto, input.venue);
    const creator_tier_multiplier = input.venue === 'SHOWZONE'
      ? SHOWZONE_PRICING.CREATOR_TIER_MULTIPLIERS[input.creator_tier]
      : 1.00; // Bijou has no creator-tier multiplier
    const advance_multiplier = input.venue === 'SHOWZONE'
      ? this.resolveAdvanceMultiplier(input.days_until_show)
      : 1.00; // Bijou advance window not currently multiplied
    const geo_multiplier = this.resolveGeoMultiplier(input.vip_geo_tier);

    const composite = day_multiplier * time_multiplier * creator_tier_multiplier * advance_multiplier;
    // Geo multiplier is display-layer only — does not change creator payout calculation
    const final_tokens_raw = base * composite;
    const final_tokens = Math.round(final_tokens_raw / 10) * 10;
    const czt_price_usd = (config as typeof BIJOU_PRICING).CZT_PRICE_USD ?? SHOWZONE_PRICING.CZT_PRICE_USD;
    const final_usd_estimate = final_tokens * czt_price_usd;

    return {
      base_tokens: base,
      day_multiplier,
      time_multiplier,
      creator_tier_multiplier,
      advance_multiplier,
      geo_multiplier,
      composite_multiplier: parseFloat(composite.toFixed(4)),
      final_tokens,
      final_usd_estimate: parseFloat(final_usd_estimate.toFixed(2)),
      multiplier_breakdown: {
        day:          day_multiplier,
        time:         time_multiplier,
        creator_tier: creator_tier_multiplier,
        advance:      advance_multiplier,
        geo_display:  geo_multiplier,
        composite,
      },
    };
  }

  private resolveTimeMultiplier(hour: number, venue: VenueType): number {
    if (venue === 'BIJOU') return 1.00; // Bijou does not apply time-of-day multiplier
    const t = SHOWZONE_PRICING.TIME_MULTIPLIERS;
    if (hour >= t.PRIME.from && hour < t.PRIME.to) return t.PRIME.multiplier;
    if (hour >= t.LATE_NIGHT.from || hour < (t.LATE_NIGHT.to - 24)) return t.LATE_NIGHT.multiplier;
    if (hour >= t.AFTERNOON.from && hour < t.AFTERNOON.to) return t.AFTERNOON.multiplier;
    return t.OFF_PEAK.multiplier;
  }

  private resolveAdvanceMultiplier(days_until_show: number): number {
    const a = SHOWZONE_PRICING.ADVANCE_PURCHASE_MULTIPLIERS;
    if (days_until_show === 0) return a.SAME_DAY;
    if (days_until_show <= 3)  return a.ONE_TO_THREE;
    if (days_until_show <= 7)  return a.FOUR_TO_SEVEN;
    return a.EIGHT_PLUS;
  }

  private resolveGeoMultiplier(tier: GeoTier): number {
    // Geo multiplier is a DISPLAY layer only — used for chat token display translation.
    // It does NOT affect the ledger debit amount or creator payout.
    const t = GEO_PRICING.TIERS;
    if (tier === 'LOW') return t.LOW.multiplier_min;
    if (tier === 'MED') return t.MED.multiplier_min;
    return 1.00;
  }
}
