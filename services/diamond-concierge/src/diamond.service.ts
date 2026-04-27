// PAYLOAD 2 — Diamond Concierge VIP Service
// Implements REDBOOK §4 Diamond Tier protocol:
//   • Volume + Velocity pricing with platform floor at $0.077 / token
//   • 14-day expiry + safety net
//   • Security + Fraud + Hospitality surface (Concierge)
// No ledger writes. Pricing is quote-only — execution belongs to the
// purchase pipeline in core-api.

import { Injectable, Logger } from '@nestjs/common';
import Decimal from 'decimal.js';
import { DIAMOND_TIER } from '../../core-api/src/config/governance.config';

export const DIAMOND_RULE_ID = 'DIAMOND_CONCIERGE_v1';

// 14-day expiry per REDBOOK §4 (distinct from the 45-day standard wallet
// expiry in MEMBERSHIP.TOKEN_EXPIRY_DAYS — Diamond purchases have a shorter
// live-fire window paired with the safety-net extension path).
export const DIAMOND_EXPIRY_DAYS = 14;

export type VelocityBand = 'DAYS_14' | 'DAYS_30' | 'DAYS_90' | 'DAYS_180' | 'DAYS_366';

export interface PricingQuote {
  tokens: number;
  velocity_days: number;
  velocity_band: VelocityBand;
  base_rate_usd: number;       // resolved volume-tier rate
  velocity_multiplier: number; // resolved from VELOCITY_MULTIPLIERS
  platform_rate_usd: number;   // effective after multiplier
  platform_floor_applied: boolean;
  usd_total_cents: bigint;
  expires_at_utc: string;
  rule_applied_id: string;
}

export interface SafetyNetMetadata {
  extension_fee_usd: number;
  recovery_fee_usd: number;
  creator_pool_pct: number;
  platform_mgmt_pct: number;
  expires_at_utc: string;
  rule_applied_id: string;
}

export interface ConciergeSurface {
  user_id: string;
  tier_permitted: boolean;
  fraud_risk_signals: string[];
  security_signals: string[];
  hospitality_signals: string[];
  rule_applied_id: string;
}

export interface LiquiditySnapshot {
  open_diamond_wallets: number;
  total_remaining_tokens: string;    // bigint as string
  total_remaining_usd_cents: string; // bigint as string
  expiring_within_48h: number;
  high_balance_wallets: number;      // > $10k USD equivalent
  rule_applied_id: string;
}

export interface DiamondLiquidityInput {
  open_wallets: Array<{
    wallet_id: string;
    remaining_tokens: bigint;
    remaining_usd_cents: bigint;
    expires_at_utc: string;
  }>;
  high_balance_threshold_usd_cents?: bigint;
}

@Injectable()
export class DiamondConciergeService {
  private readonly logger = new Logger(DiamondConciergeService.name);
  private readonly RULE_ID = DIAMOND_RULE_ID;

  /**
   * Volume + Velocity pricing with the platform floor guarantee.
   * Spec: REDBOOK §4 (locked 2026-04-11 — 3-tier volume table).
   *   • Volume tier resolves base_rate from DIAMOND_TIER.VOLUME_TIERS
   *   • Velocity multiplier resolves from VELOCITY_MULTIPLIERS
   *   • Effective rate = base_rate × velocity_multiplier
   *   • If effective < PLATFORM_FLOOR_PER_TOKEN ($0.077), floor applies
   */
  quotePrice(params: { tokens: number; velocity_days: number }): PricingQuote {
    const { tokens, velocity_days } = params;

    if (!Number.isFinite(tokens) || tokens < DIAMOND_TIER.VOLUME_TIERS[0].min_tokens) {
      throw new Error(
        `DIAMOND_MIN_VOLUME_NOT_MET: minimum ${DIAMOND_TIER.VOLUME_TIERS[0].min_tokens} tokens`,
      );
    }
    if (!Number.isFinite(velocity_days) || velocity_days < 14) {
      throw new Error('DIAMOND_MIN_VELOCITY_NOT_MET: minimum 14 days');
    }

    const tier = DIAMOND_TIER.VOLUME_TIERS.find(
      (t) => tokens >= t.min_tokens && tokens <= t.max_tokens,
    );
    if (!tier) {
      throw new Error(`DIAMOND_VOLUME_TIER_UNRESOLVED: tokens=${tokens}`);
    }

    const band = this.resolveVelocityBand(velocity_days);
    const multiplier = DIAMOND_TIER.VELOCITY_MULTIPLIERS[band];

    let effective = new Decimal(tier.base_rate).mul(multiplier);
    const floor = new Decimal(DIAMOND_TIER.PLATFORM_FLOOR_PER_TOKEN);
    const platform_floor_applied = effective.lessThan(floor);
    if (platform_floor_applied) {
      effective = floor;
    }

    const cents_per_token = effective.mul(100);
    const usd_total_cents = BigInt(
      cents_per_token.mul(tokens).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toFixed(0),
    );

    const expires_at_utc = new Date(
      Date.now() + DIAMOND_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    this.logger.log('DiamondConciergeService: pricing quote computed', {
      tokens,
      velocity_days,
      velocity_band: band,
      base_rate: tier.base_rate,
      velocity_multiplier: multiplier,
      effective_rate: effective.toString(),
      platform_floor_applied,
      usd_total_cents: usd_total_cents.toString(),
      rule_applied_id: this.RULE_ID,
    });

    return {
      tokens,
      velocity_days,
      velocity_band: band,
      base_rate_usd: tier.base_rate,
      velocity_multiplier: multiplier,
      platform_rate_usd: effective.toNumber(),
      platform_floor_applied,
      usd_total_cents,
      expires_at_utc,
      rule_applied_id: this.RULE_ID,
    };
  }

  /** 14-day expiry + safety-net fee schedule for a Diamond purchase. */
  buildSafetyNet(purchase_at_utc = new Date()): SafetyNetMetadata {
    const expires_at_utc = new Date(
      purchase_at_utc.getTime() + DIAMOND_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    return {
      extension_fee_usd: DIAMOND_TIER.EXTENSION_FEE_14_DAY_USD,
      recovery_fee_usd: DIAMOND_TIER.RECOVERY_FEE_EXPIRED_USD,
      creator_pool_pct: DIAMOND_TIER.EXPIRED_CREATOR_POOL_PCT,
      platform_mgmt_pct: DIAMOND_TIER.EXPIRED_PLATFORM_MGMT_PCT,
      expires_at_utc,
      rule_applied_id: this.RULE_ID,
    };
  }

  /**
   * Concierge surface — fuses Security, Fraud, and Hospitality signals for
   * a given Diamond guest. This is a deterministic read-model — the input
   * signal arrays come from upstream services (risk-engine, safety,
   * creator/hospitality).
   */
  fuseConciergeSurface(params: {
    user_id: string;
    tier: string;
    fraud_risk_signals: string[];
    security_signals: string[];
    hospitality_signals: string[];
  }): ConciergeSurface {
    const tier_permitted = params.tier === 'VIP_DIAMOND';
    return {
      user_id: params.user_id,
      tier_permitted,
      fraud_risk_signals: [...params.fraud_risk_signals],
      security_signals: [...params.security_signals],
      hospitality_signals: [...params.hospitality_signals],
      rule_applied_id: this.RULE_ID,
    };
  }

  /** Aggregates liquidity data for the CS Recovery Dashboard Diamond panel. */
  liquiditySnapshot(input?: DiamondLiquidityInput): LiquiditySnapshot {
    const wallets = input?.open_wallets ?? [];
    const threshold =
      input?.high_balance_threshold_usd_cents ?? BigInt(10_000 * 100);
    const now = Date.now();
    const fortyEightHoursMs = 48 * 60 * 60 * 1000;

    let totalTokens = 0n;
    let totalCents = 0n;
    let expiringSoon = 0;
    let highBalance = 0;

    for (const w of wallets) {
      totalTokens += w.remaining_tokens;
      totalCents += w.remaining_usd_cents;
      const expiresAt = new Date(w.expires_at_utc).getTime();
      if (expiresAt > now && expiresAt <= now + fortyEightHoursMs) {
        expiringSoon += 1;
      }
      if (w.remaining_usd_cents > threshold) {
        highBalance += 1;
      }
    }

    return {
      open_diamond_wallets: wallets.length,
      total_remaining_tokens: totalTokens.toString(),
      total_remaining_usd_cents: totalCents.toString(),
      expiring_within_48h: expiringSoon,
      high_balance_wallets: highBalance,
      rule_applied_id: this.RULE_ID,
    };
  }

  private resolveVelocityBand(days: number): VelocityBand {
    if (days >= 366) return 'DAYS_366';
    if (days >= 180) return 'DAYS_180';
    if (days >= 90) return 'DAYS_90';
    if (days >= 30) return 'DAYS_30';
    return 'DAYS_14';
  }
}
