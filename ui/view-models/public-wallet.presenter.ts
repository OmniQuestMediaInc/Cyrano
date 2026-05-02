// PAYLOAD 7 — Guest-facing presenter for /tokens, /wallet, /diamond/purchase.
// Composes the authoritative REDBOOK_RATE_CARDS, RECOVERY_ENGINE and
// DIAMOND_TIER governance constants into view-models without duplicating
// pricing logic in UI code.
//
// The presenter exposes two input channels for governance constants:
//   1. The caller passes the constants via GovernanceSnapshot — preserves
//      dependency inversion so the UI layer does not import the service
//      bootstrap graph.
//   2. Sensible defaults are provided that match the values frozen in
//      services/core-api/src/config/governance.config.ts (REDBOOK §3,
//      Diamond Tier, Recovery Engine). These are convenience defaults —
//      callers MUST pass the live governance snapshot in production so
//      the UI never drifts from the ledger.

import type {
  DiamondPurchaseQuoteCard,
  DiamondVelocityBandLabel,
  GuestTier,
  SafetyNetOfferCard,
  TokenBundleRateCard,
  TokenBundleRateRow,
  WalletBucket,
  WalletBucketRow,
  WalletThreeBucketView,
} from '../types/public-wallet-contracts';

export const PUBLIC_PRESENTER_RULE_ID = 'PUBLIC_WALLET_UI_v1';

export interface TeaseRegularRow {
  tokens: number;
  guest_usd: number;
  member_usd: number;
  creator_payout_per_token: number;
}
export interface DiamondVolumeTier {
  min_tokens: number;
  max_tokens: number;
  base_rate: number;
}
export interface DiamondVelocityMultipliers {
  DAYS_14: number;
  DAYS_30: number;
  DAYS_90: number;
  DAYS_180: number;
  DAYS_366: number;
}

export interface GovernanceSnapshot {
  tease_regular: readonly TeaseRegularRow[];
  diamond_volume_tiers: readonly DiamondVolumeTier[];
  diamond_velocity_multipliers: DiamondVelocityMultipliers;
  diamond_platform_floor_per_token_usd: number;
  diamond_expiry_days: number;
  extension_fee_usd: number;
  recovery_fee_usd: number;
  token_bridge_bonus_pct: number;
  three_fifths_refund_pct: number;
  three_fifths_lock_hours: number;
  expiry_warning_hours: number;
  extension_grant_days: number;
  ledger_spend_order: readonly WalletBucket[];
}

/**
 * Default governance snapshot — mirrors services/core-api/src/config/governance.config.ts.
 * Callers SHOULD pass a live snapshot in production; these defaults exist so
 * the UI layer can be unit-tested and bootstrapped without pulling the NestJS
 * app module into the test graph.
 */
export const DEFAULT_GOVERNANCE_SNAPSHOT: GovernanceSnapshot = {
  tease_regular: [
    { tokens: 150, guest_usd: 19.99, member_usd: 17.99, creator_payout_per_token: 0.075 },
    { tokens: 500, guest_usd: 59.99, member_usd: 53.99, creator_payout_per_token: 0.075 },
    { tokens: 1_000, guest_usd: 119.99, member_usd: 107.99, creator_payout_per_token: 0.075 },
    { tokens: 5_000, guest_usd: 549.99, member_usd: 494.99, creator_payout_per_token: 0.08 },
    { tokens: 10_000, guest_usd: 999.99, member_usd: 899.99, creator_payout_per_token: 0.082 },
  ],
  diamond_volume_tiers: [
    { min_tokens: 10_000, max_tokens: 27_499, base_rate: 0.095 },
    { min_tokens: 30_000, max_tokens: 57_499, base_rate: 0.088 },
    { min_tokens: 60_000, max_tokens: Number.MAX_SAFE_INTEGER, base_rate: 0.082 },
  ],
  diamond_velocity_multipliers: {
    DAYS_14: 1.0,
    DAYS_30: 1.0,
    DAYS_90: 1.08,
    DAYS_180: 1.12,
    DAYS_366: 1.15,
  },
  diamond_platform_floor_per_token_usd: 0.077,
  diamond_expiry_days: 14,
  extension_fee_usd: 49.0,
  recovery_fee_usd: 79.0,
  token_bridge_bonus_pct: 0.2,
  three_fifths_refund_pct: 0.6,
  three_fifths_lock_hours: 24,
  expiry_warning_hours: 48,
  extension_grant_days: 14,
  ledger_spend_order: ['purchased', 'membership', 'bonus'],
};

export class PublicWalletPresenter {
  private readonly RULE_ID = PUBLIC_PRESENTER_RULE_ID;

  /** Token bundle rate card for /tokens. */
  buildTokenBundleRateCard(args: {
    tier: GuestTier;
    now_utc?: Date;
    governance?: GovernanceSnapshot;
    promoted_bundle_tokens?: number; // optional — highlight a specific row
  }): TokenBundleRateCard {
    const gov = args.governance ?? DEFAULT_GOVERNANCE_SNAPSHOT;
    const now = args.now_utc ?? new Date();
    const promoted = args.promoted_bundle_tokens ?? null;

    const rows: TokenBundleRateRow[] = gov.tease_regular.map((r) => {
      const display =
        args.tier === 'MEMBER' || args.tier === 'DIAMOND' ? r.member_usd : r.guest_usd;
      const discount_for_members_pct = this.pctDiscount(r.guest_usd, r.member_usd);
      return {
        tokens: r.tokens,
        display_price_usd: display,
        guest_price_usd: r.guest_usd,
        member_price_usd: r.member_usd,
        discount_for_members_pct,
        per_token_usd: Math.round((display / r.tokens) * 10_000) / 10_000,
        creator_payout_per_token: r.creator_payout_per_token,
        bundle_tier: 'TEASE_REGULAR',
        is_promoted: promoted !== null && r.tokens === promoted,
        reason_code: 'REDBOOK_SECTION_3',
      };
    });

    return {
      tier: args.tier,
      rows,
      generated_at_utc: now.toISOString(),
      rule_applied_id: this.RULE_ID,
    };
  }

  /**
   * Diamond Tier purchase quote card.
   * Mirrors DiamondConciergeService.quotePrice but stays in the UI presenter
   * layer so the guest-facing estimator can run without an API round-trip.
   * Authoritative finalisation MUST still go through the service layer before
   * any money moves — this quote is an informational display.
   */
  buildDiamondQuote(args: {
    tokens: number;
    velocity_days: number;
    now_utc?: Date;
    governance?: GovernanceSnapshot;
  }): DiamondPurchaseQuoteCard {
    const gov = args.governance ?? DEFAULT_GOVERNANCE_SNAPSHOT;
    const now = args.now_utc ?? new Date();

    if (!Number.isFinite(args.tokens) || args.tokens < gov.diamond_volume_tiers[0].min_tokens) {
      throw new Error(
        `DIAMOND_MIN_VOLUME_NOT_MET: minimum ${gov.diamond_volume_tiers[0].min_tokens} tokens`,
      );
    }
    if (!Number.isFinite(args.velocity_days) || args.velocity_days < 14) {
      throw new Error('DIAMOND_MIN_VELOCITY_NOT_MET: minimum 14 days');
    }

    const tier = gov.diamond_volume_tiers.find(
      (t) => args.tokens >= t.min_tokens && args.tokens <= t.max_tokens,
    );
    if (!tier) {
      throw new Error(`DIAMOND_VOLUME_TIER_UNRESOLVED: tokens=${args.tokens}`);
    }

    const band = this.resolveVelocityBand(args.velocity_days);
    const multiplier = gov.diamond_velocity_multipliers[band];
    let effective = Math.round(tier.base_rate * multiplier * 1_000_000) / 1_000_000;
    const floor = gov.diamond_platform_floor_per_token_usd;
    const platform_floor_applied = effective < floor;
    if (platform_floor_applied) effective = floor;

    const cents_per_token = Math.round(effective * 100 * 1_000_000) / 1_000_000;
    const usd_total_cents = BigInt(Math.round(cents_per_token * args.tokens));
    const expires_at_utc = new Date(
      now.getTime() + gov.diamond_expiry_days * 24 * 60 * 60 * 1000,
    ).toISOString();

    return {
      tokens: args.tokens,
      velocity_days: args.velocity_days,
      velocity_band: band,
      base_rate_usd: tier.base_rate,
      velocity_multiplier: multiplier,
      platform_rate_usd: effective,
      platform_floor_applied,
      platform_floor_per_token_usd: floor,
      usd_total_cents: usd_total_cents.toString(),
      expires_at_utc,
      extension_fee_usd: gov.extension_fee_usd,
      recovery_fee_usd: gov.recovery_fee_usd,
      rule_applied_id: 'DIAMOND_CONCIERGE_v1',
    };
  }

  /** Expiration safety-net offer card for /wallet/safety-net. */
  buildSafetyNetOffer(args: {
    wallet_id: string;
    expires_at_utc: string;
    remaining_tokens: bigint;
    has_token_bridge_eligible: boolean;
    now_utc?: Date;
    governance?: GovernanceSnapshot;
  }): SafetyNetOfferCard {
    const gov = args.governance ?? DEFAULT_GOVERNANCE_SNAPSHOT;
    const now = args.now_utc ?? new Date();
    const expiresMs = new Date(args.expires_at_utc).getTime();
    const hours_until_expiry = Math.max(
      0,
      Math.round(((expiresMs - now.getTime()) / (60 * 60 * 1000)) * 10) / 10,
    );
    return {
      wallet_id: args.wallet_id,
      expires_at_utc: args.expires_at_utc,
      hours_until_expiry,
      remaining_tokens: args.remaining_tokens.toString(),
      extension_fee_usd: gov.extension_fee_usd,
      extension_grant_days: gov.extension_grant_days,
      recovery_fee_usd: gov.recovery_fee_usd,
      has_token_bridge_eligible: args.has_token_bridge_eligible,
      token_bridge_bonus_pct: gov.token_bridge_bonus_pct,
      three_fifths_refund_pct: gov.three_fifths_refund_pct,
      three_fifths_lock_hours: gov.three_fifths_lock_hours,
      rule_applied_id: 'REDBOOK_RECOVERY_v1',
    };
  }

  /** Three-bucket wallet view for /wallet. */
  buildWalletView(args: {
    wallet_id: string;
    user_id: string;
    tier: GuestTier;
    balances: Record<WalletBucket, bigint>;
    safety_net?: SafetyNetOfferCard | null;
    now_utc?: Date;
    governance?: GovernanceSnapshot;
  }): WalletThreeBucketView {
    const gov = args.governance ?? DEFAULT_GOVERNANCE_SNAPSHOT;
    const now = args.now_utc ?? new Date();
    const spend_order = gov.ledger_spend_order;
    let total = 0n;
    const labels: Record<WalletBucket, { label: string; description: string }> = {
      purchased: {
        label: 'Purchased',
        description: 'Tokens bought via Tease Regular / Diamond bundles. Drained first.',
      },
      membership: {
        label: 'Membership',
        description: 'Monthly stipend granted by active membership tier. Drained second.',
      },
      bonus: {
        label: 'Bonus',
        description: 'Goodwill + promotional credits (Token Bridge, rewards). Drained last.',
      },
    };

    const buckets: WalletBucketRow[] = spend_order.map((bucket, idx) => {
      const balance = args.balances[bucket] ?? 0n;
      total += balance;
      return {
        bucket,
        balance_tokens: balance.toString(),
        spend_priority: idx + 1,
        label: labels[bucket].label,
        description: labels[bucket].description,
        will_drain_next: false,
      };
    });
    const firstNonEmpty = buckets.find((b) => BigInt(b.balance_tokens) > 0n);
    if (firstNonEmpty) firstNonEmpty.will_drain_next = true;

    return {
      wallet_id: args.wallet_id,
      user_id: args.user_id,
      tier: args.tier,
      buckets,
      total_tokens: total.toString(),
      safety_net: args.safety_net ?? null,
      generated_at_utc: now.toISOString(),
      rule_applied_id: this.RULE_ID,
    };
  }

  private pctDiscount(guest: number, member: number): number | null {
    if (guest <= 0) return null;
    const raw = (guest - member) / guest;
    if (raw <= 0) return null;
    return Math.round(raw * 1_000) / 10; // 0.10 → 10.0
  }

  private resolveVelocityBand(days: number): DiamondVelocityBandLabel {
    if (days >= 366) return 'DAYS_366';
    if (days >= 180) return 'DAYS_180';
    if (days >= 90) return 'DAYS_90';
    if (days >= 30) return 'DAYS_30';
    return 'DAYS_14';
  }
}
