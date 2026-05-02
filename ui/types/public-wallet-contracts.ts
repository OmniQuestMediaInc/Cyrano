// PAYLOAD 7 — Guest-facing UI contracts (token bundle rate cards, Diamond
// purchase flow, wallet three-bucket display, expiration safety net).
// Source of truth: REDBOOK_RATE_CARDS + DIAMOND_TIER + RECOVERY_ENGINE
// in services/core-api/src/config/governance.config.ts. These UI types
// mirror but do not import the service constants — the presenter layer
// is responsible for translating governance constants into view models.
//
// @alpha-frozen — wireframe binding target for Grok handoff
// (docs/UX_INTEGRATION_BRIEF.md §1). Field additions require a versioned
// migration; field removals require CEO sign-off. GuestTier is a
// presenter-layer simplification of MembershipTier — see brief §5.

export type GuestTier = 'GUEST' | 'MEMBER' | 'DIAMOND';

export type WalletBucket = 'purchased' | 'membership' | 'bonus';

/** One row of the token bundle rate card (Tease Regular). */
export interface TokenBundleRateRow {
  tokens: number;
  display_price_usd: number;
  guest_price_usd: number;
  member_price_usd: number;
  discount_for_members_pct: number | null;
  per_token_usd: number;
  creator_payout_per_token: number;
  /**
   * Bundle tier identifier. Single CZT Token Economy v1: only TEASE_REGULAR
   * is valid. The TEASE_SHOWZONE variant has been removed end-to-end.
   */
  bundle_tier: 'TEASE_REGULAR';
  is_promoted: boolean; // highlight row on the rate card
  reason_code: 'REDBOOK_SECTION_3';
}

/** Full rate card rendered on the guest-facing /tokens page. */
export interface TokenBundleRateCard {
  tier: GuestTier;
  rows: TokenBundleRateRow[];
  generated_at_utc: string;
  rule_applied_id: string;
}

/** Diamond Tier quote card rendered on /diamond/purchase. */
export interface DiamondPurchaseQuoteCard {
  tokens: number;
  velocity_days: number;
  velocity_band: DiamondVelocityBandLabel;
  base_rate_usd: number;
  velocity_multiplier: number;
  platform_rate_usd: number;
  platform_floor_applied: boolean;
  platform_floor_per_token_usd: number;
  usd_total_cents: string; // bigint as string
  expires_at_utc: string;
  extension_fee_usd: number;
  recovery_fee_usd: number;
  rule_applied_id: string;
}

export type DiamondVelocityBandLabel = 'DAYS_14' | 'DAYS_30' | 'DAYS_90' | 'DAYS_180' | 'DAYS_366';

/** Expiration safety net card for /wallet/safety-net. */
export interface SafetyNetOfferCard {
  wallet_id: string;
  expires_at_utc: string;
  hours_until_expiry: number;
  remaining_tokens: string; // bigint as string
  extension_fee_usd: number;
  extension_grant_days: number;
  recovery_fee_usd: number;
  has_token_bridge_eligible: boolean;
  token_bridge_bonus_pct: number;
  three_fifths_refund_pct: number;
  three_fifths_lock_hours: number;
  rule_applied_id: string;
}

/** Deterministic spend order row on the wallet three-bucket UI. */
export interface WalletBucketRow {
  bucket: WalletBucket;
  balance_tokens: string; // bigint as string
  spend_priority: number; // 1-based (matches LEDGER_SPEND_ORDER)
  label: string; // localized display name
  description: string;
  will_drain_next: boolean; // true for the top non-empty bucket
}

/** Aggregate wallet view for /wallet. */
export interface WalletThreeBucketView {
  wallet_id: string;
  user_id: string;
  tier: GuestTier;
  buckets: WalletBucketRow[];
  total_tokens: string; // bigint as string
  safety_net: SafetyNetOfferCard | null;
  generated_at_utc: string;
  rule_applied_id: string;
}
