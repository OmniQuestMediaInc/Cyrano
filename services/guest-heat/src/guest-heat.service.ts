// CRM: Guest-Heat — WhaleProfile scoring + OfferEngine
// Business Plan §B.4 — guest intelligence layer.
//
// Contract:
//   • WhaleProfileService: computes whale_score and loyalty_tier from
//     multi-window spend data; persists to whale_profiles via Prisma.
//   • OfferEngine: generates spending-pattern and geo-pricing offers;
//     emits on guest_heat.offer.triggered NATS topic.
//   • Geo-pricing: regional price shown to guest; full public price retained
//     in the offer record for audit.

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { PrismaService } from '../../core-api/src/prisma.service';
import { NATS_TOPICS } from '../../nats/topics.registry';
import {
  GEO_PRICE_MULTIPLIERS,
  GUEST_HEAT_RULE_ID,
  type GuestOffer,
  type LoyaltyTier,
  type PreferenceVector,
  type SpendWindows,
  type WhaleProfileRecord,
} from './guest-heat.types';

// ── Loyalty scoring thresholds ────────────────────────────────────────────────

const LOYALTY_THRESHOLDS: Array<{ min: number; tier: LoyaltyTier }> = [
  { min: 90, tier: 'ULTRA_WHALE' },
  { min: 70, tier: 'WHALE' },
  { min: 50, tier: 'HOT' },
  { min: 30, tier: 'WARM' },
  { min: 15, tier: 'RISING' },
  { min: 0,  tier: 'STANDARD' },
];

// ── Whale score computation ──────────────────────────────────────────────────

/**
 * Compute a normalised whale score (0..100) from multi-window spend data.
 * Heavier weight on shorter windows (recency bias).
 */
function computeWhaleScore(spend: SpendWindows): number {
  // Weighted sum — coefficients tuned to business plan B.4 §3.
  const raw =
    spend.spend_24h  * 0.35 +
    spend.spend_72h  * 0.25 +
    spend.spend_7d   * 0.20 +
    spend.spend_14d  * 0.12 +
    spend.spend_30d  * 0.08;

  // Normalise against a reference ceiling of 5 000 CZT/30d.
  const CEILING = 5_000;
  return Math.min(100, Math.round((raw / CEILING) * 100));
}

function deriveLoyaltyTier(whale_score: number): LoyaltyTier {
  for (const { min, tier } of LOYALTY_THRESHOLDS) {
    if (whale_score >= min) return tier;
  }
  return 'STANDARD';
}

// ── Offer expiry ─────────────────────────────────────────────────────────────

function offerExpiresAt(ttlMinutes: number): string {
  return new Date(Date.now() + ttlMinutes * 60_000).toISOString();
}

// ── WhaleProfileService ───────────────────────────────────────────────────────

@Injectable()
export class WhaleProfileService {
  private readonly logger = new Logger(WhaleProfileService.name);

  constructor(
    private readonly nats: NatsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Score a guest and persist the result to whale_profiles.
   * Emits GUEST_HEAT_WHALE_SCORED on NATS.
   * Returns the scored profile.
   */
  async scoreGuest(
    guest_id: string,
    spend: SpendWindows,
    preference_vector: PreferenceVector,
    geo_region?: string,
    correlation_id: string = randomUUID(),
  ): Promise<WhaleProfileRecord> {
    const whale_score = computeWhaleScore(spend);
    const loyalty_tier = deriveLoyaltyTier(whale_score);

    const profile: WhaleProfileRecord = {
      profile_id: randomUUID(),
      guest_id,
      loyalty_tier,
      whale_score,
      spend,
      preference_vector,
      geo_region,
      correlation_id,
      reason_code: 'WHALE_RESCORE',
      rule_applied_id: GUEST_HEAT_RULE_ID,
      scored_at_utc: new Date().toISOString(),
    };

    await this.prisma.whaleProfile.create({
      data: {
        guest_id,
        loyalty_tier,
        whale_score,
        spend_24h:  spend.spend_24h,
        spend_72h:  spend.spend_72h,
        spend_7d:   spend.spend_7d,
        spend_14d:  spend.spend_14d,
        spend_30d:  spend.spend_30d,
        preference_vector: preference_vector as unknown as object,
        geo_region,
        correlation_id,
        reason_code: 'WHALE_RESCORE',
        rule_applied_id: GUEST_HEAT_RULE_ID,
      },
    });

    this.nats.publish(NATS_TOPICS.GUEST_HEAT_WHALE_SCORED, {
      ...profile,
    } as unknown as Record<string, unknown>);

    this.logger.log('WhaleProfileService: guest scored', {
      guest_id,
      whale_score,
      loyalty_tier,
    });

    return profile;
  }

  /**
   * Retrieve the latest whale profile for a guest.
   */
  async getLatestProfile(guest_id: string): Promise<WhaleProfileRecord | null> {
    const row = await this.prisma.whaleProfile.findFirst({
      where: { guest_id },
      orderBy: { scored_at: 'desc' },
    });

    if (!row) return null;

    return {
      profile_id: row.id,
      guest_id: row.guest_id,
      loyalty_tier: row.loyalty_tier as LoyaltyTier,
      whale_score: Number(row.whale_score),
      spend: {
        spend_24h:  Number(row.spend_24h),
        spend_72h:  Number(row.spend_72h),
        spend_7d:   Number(row.spend_7d),
        spend_14d:  Number(row.spend_14d),
        spend_30d:  Number(row.spend_30d),
      },
      preference_vector: (row.preference_vector ?? {}) as unknown as PreferenceVector,
      geo_region: row.geo_region ?? undefined,
      correlation_id: row.correlation_id,
      reason_code: row.reason_code,
      rule_applied_id: row.rule_applied_id,
      scored_at_utc: row.scored_at.toISOString(),
    };
  }
}

// ── OfferEngine ───────────────────────────────────────────────────────────────

@Injectable()
export class OfferEngine {
  private readonly logger = new Logger(OfferEngine.name);

  constructor(private readonly nats: NatsService) {}

  /**
   * Generate a spending-pattern offer for a guest based on their
   * whale profile.
   * Emits GUEST_HEAT_OFFER_TRIGGERED on NATS.
   */
  generateSpendingPatternOffer(
    guest_id: string,
    profile: WhaleProfileRecord,
    session_id?: string,
  ): GuestOffer {
    const base_value_czt = this.computeOfferValue(profile);
    const regional = this.applyGeoPrice(base_value_czt, profile.geo_region);

    const offer: GuestOffer = {
      offer_id: randomUUID(),
      guest_id,
      session_id,
      offer_type: 'SPENDING_PATTERN',
      display_text: this.buildSpendingPatternText(profile, regional.display),
      value_czt: base_value_czt,
      regional_price_display: regional.display,
      public_price_czt: base_value_czt,
      expires_at_utc: offerExpiresAt(30), // 30-minute offer window
      correlation_id: randomUUID(),
      reason_code: 'SPENDING_PATTERN_OFFER',
      rule_applied_id: GUEST_HEAT_RULE_ID,
      triggered_at_utc: new Date().toISOString(),
    };

    this.emitOffer(offer);
    return offer;
  }

  /**
   * Generate a geo-pricing offer.
   * Regional price is shown to the guest; full price retained for audit.
   */
  generateGeoPriceOffer(
    guest_id: string,
    base_value_czt: number,
    geo_region: string,
    session_id?: string,
  ): GuestOffer {
    const regional = this.applyGeoPrice(base_value_czt, geo_region);

    const offer: GuestOffer = {
      offer_id: randomUUID(),
      guest_id,
      session_id,
      offer_type: 'GEO_PRICE',
      display_text: `Special regional rate: ${regional.display} CZT`,
      value_czt: regional.adjusted,
      regional_price_display: regional.display,
      public_price_czt: base_value_czt,
      expires_at_utc: offerExpiresAt(60),
      correlation_id: randomUUID(),
      reason_code: 'GEO_PRICE_OFFER',
      rule_applied_id: GUEST_HEAT_RULE_ID,
      triggered_at_utc: new Date().toISOString(),
    };

    this.emitOffer(offer);
    return offer;
  }

  /**
   * Generate a loyalty-milestone reward offer.
   */
  generateLoyaltyRewardOffer(
    guest_id: string,
    profile: WhaleProfileRecord,
    session_id?: string,
  ): GuestOffer {
    const bonus_czt = Math.round(profile.spend.spend_30d * 0.05); // 5% bonus

    const offer: GuestOffer = {
      offer_id: randomUUID(),
      guest_id,
      session_id,
      offer_type: 'LOYALTY_REWARD',
      display_text: `Loyalty reward: ${bonus_czt} CZT bonus for your ${profile.loyalty_tier} status!`,
      value_czt: bonus_czt,
      expires_at_utc: offerExpiresAt(1440), // 24 hours
      correlation_id: randomUUID(),
      reason_code: 'LOYALTY_REWARD_OFFER',
      rule_applied_id: GUEST_HEAT_RULE_ID,
      triggered_at_utc: new Date().toISOString(),
    };

    this.emitOffer(offer);
    return offer;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private computeOfferValue(profile: WhaleProfileRecord): number {
    // Offer value scales with whale tier — WHALE+ gets premium offers.
    const base = profile.preference_vector.avg_tip_size_czt;
    const multiplier =
      profile.loyalty_tier === 'ULTRA_WHALE' ? 3.0 :
      profile.loyalty_tier === 'WHALE'       ? 2.0 :
      profile.loyalty_tier === 'HOT'         ? 1.5 :
      profile.loyalty_tier === 'WARM'        ? 1.2 :
      1.0;
    return Math.max(1, Math.round(base * multiplier));
  }

  private applyGeoPrice(
    base_czt: number,
    geo_region?: string,
  ): { adjusted: number; display: string } {
    // geo_region may be undefined or a code not in the table — default to 1.0.
    const multiplier: number = GEO_PRICE_MULTIPLIERS[geo_region ?? ''] ?? 1.0;
    const adjusted = Math.max(1, Math.round(base_czt * multiplier));
    const display = `${adjusted}`;
    return { adjusted, display };
  }

  private buildSpendingPatternText(
    profile: WhaleProfileRecord,
    display: string,
  ): string {
    return (
      `Based on your activity, here's an exclusive ${display} CZT offer ` +
      `for you, ${profile.loyalty_tier} member.`
    );
  }

  private emitOffer(offer: GuestOffer): void {
    this.nats.publish(NATS_TOPICS.GUEST_HEAT_OFFER_TRIGGERED, {
      ...offer,
    } as unknown as Record<string, unknown>);

    this.logger.log('OfferEngine: offer triggered', {
      offer_id: offer.offer_id,
      offer_type: offer.offer_type,
      guest_id: offer.guest_id,
    });
  }
}
