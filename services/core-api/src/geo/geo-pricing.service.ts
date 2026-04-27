// services/core-api/src/geo/geo-pricing.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { GEO_PRICING } from '../config/governance.config';

export type GeoTier = 'LOW' | 'MED' | 'HIGH';

export interface GeoResolution {
  country_code: string;
  tier: GeoTier;
  multiplier: number;
  display_tokens: number; // Token amount shown in chat for this VIP
  base_tokens: number; // Creator's set price (HIGH tier = 1.0x)
  rule_applied_id: string;
}

export interface ChatTipEvent {
  vip_display_name: string;
  action_name: string;
  display_tokens: number;
  geo_tier: GeoTier;
  creator_payout_tokens: number;
  raw_tokens_paid: number;
}

@Injectable()
export class GeoPricingService {
  private readonly logger = new Logger(GeoPricingService.name);
  private readonly RULE_ID = 'GEO_PRICING_v1';

  resolveGeoTier(country_code: string): GeoTier {
    const map = GEO_PRICING.COUNTRY_TIER_MAP as Record<string, string>;
    const tier = map[country_code.toUpperCase()] ?? map['DEFAULT'];
    return (tier as GeoTier) ?? 'HIGH';
  }

  applyTierMultiplier(base_token_price: number, tier: GeoTier): number {
    const tiers = GEO_PRICING.TIERS;
    let multiplier: number;
    if (tier === 'LOW') multiplier = tiers.LOW.multiplier_min;
    else if (tier === 'MED') multiplier = tiers.MED.multiplier_min;
    else multiplier = 1.0;

    // Never return less than 1 token — floor at 1
    return Math.max(1, Math.round(base_token_price * multiplier));
  }

  resolveForVip(params: {
    country_code: string;
    base_token_price: number; // Creator's HIGH-tier set price
    action_name: string;
    vip_display_name: string;
    creator_payout_tokens: number;
  }): GeoResolution {
    const tier = this.resolveGeoTier(params.country_code);
    const display_tokens = this.applyTierMultiplier(params.base_token_price, tier);
    const tiers = GEO_PRICING.TIERS;
    const multiplier =
      tier === 'LOW' ? tiers.LOW.multiplier_min : tier === 'MED' ? tiers.MED.multiplier_min : 1.0;

    this.logger.log('GeoPricingService: resolved geo tier', {
      country_code: params.country_code,
      tier,
      base_token_price: params.base_token_price,
      display_tokens,
      rule_applied_id: this.RULE_ID,
    });

    return {
      country_code: params.country_code,
      tier,
      multiplier,
      display_tokens,
      base_tokens: params.base_token_price,
      rule_applied_id: this.RULE_ID,
    };
  }

  /**
   * Builds the NATS chat stream event payload for a geo-priced tip.
   * The display_tokens value is what appears in chat — not the raw ledger amount.
   * Creator payout is always based on base_tokens (HIGH tier 1.0x price).
   */
  buildChatTipEvent(params: {
    vip_display_name: string;
    country_code: string;
    action_name: string;
    base_token_price: number;
    creator_payout_tokens: number;
  }): ChatTipEvent {
    const resolution = this.resolveForVip({
      country_code: params.country_code,
      base_token_price: params.base_token_price,
      action_name: params.action_name,
      vip_display_name: params.vip_display_name,
      creator_payout_tokens: params.creator_payout_tokens,
    });

    return {
      vip_display_name: params.vip_display_name,
      action_name: params.action_name,
      display_tokens: resolution.display_tokens,
      geo_tier: resolution.tier,
      creator_payout_tokens: params.creator_payout_tokens,
      raw_tokens_paid: params.base_token_price,
    };
  }
}
