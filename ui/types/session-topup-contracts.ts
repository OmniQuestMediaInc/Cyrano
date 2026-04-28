// Screen 04 — Session Top-Up & Recovery (VIP Member) UI contracts.
// Rendered on /vip/session/topup.
// State machine: granted → minutes-decrementing → expired → top-up-purchased → resumed

/** Canonical membership tiers (DOMAIN_GLOSSARY §Membership). */
export type MembershipTier =
  | 'GUEST'
  | 'VIP'
  | 'VIP_SILVER'
  | 'VIP_GOLD'
  | 'VIP_PLATINUM'
  | 'VIP_DIAMOND';

/** Session lifecycle states for a Cyrano VIP session. */
export type CyranoSessionState =
  | 'granted'
  | 'minutes-decrementing'
  | 'expired'
  | 'top-up-purchased'
  | 'resumed';

/** Category of top-up SKU. */
export type TopUpSkuType = 'time' | 'voice' | 'narrative';

/** One purchasable top-up option. */
export interface TopUpSku {
  sku_id: string;
  sku_type: TopUpSkuType;
  label: string;
  description: string;
  /** Additional minutes granted when this SKU is purchased. */
  minutes_granted: number;
  /** Price in ChatZoneTokens (CZT). */
  price_czt: number;
  /** Platform recommendation flag — surfaces this SKU at the top of the list. */
  is_recommended: boolean;
}

/** One row in the three-bucket wallet selector. */
export interface TopUpWalletBucketRow {
  /** 'purchased' | 'membership' | 'bonus' — mirrors public-wallet-contracts WalletBucket. */
  bucket: 'purchased' | 'membership' | 'bonus';
  balance_tokens: string; // bigint as string
  spend_priority: number; // 1-based; LEDGER_SPEND_ORDER canonical
  label: string;
  will_drain_next: boolean;
}

/** Inputs to the Session Top-Up & Recovery page render function. */
export interface SessionTopUpPageInputs {
  vip_id: string;
  session_id: string;
  /** Current position in the session lifecycle state machine. */
  session_state: CyranoSessionState;
  /** Minutes remaining in the current session grant (0 when expired). */
  remaining_minutes: number;
  /**
   * Opaque serialised context snapshot to be restored on resume.
   * Null when no restorable context is available.
   */
  context_snapshot: string | null;
  /** Recommended top-up SKUs (time + voice + narrative buckets). */
  recommended_skus: TopUpSku[];
  /** Three-bucket wallet for the purchase selector. */
  wallet_buckets: TopUpWalletBucketRow[];
  /** Pre-selected SKU (from deep-link or NATS push). Null = none selected. */
  selected_sku_id: string | null;
  /** Pre-selected wallet bucket. Null = none selected. */
  selected_bucket: TopUpWalletBucketRow['bucket'] | null;
}

/** Shape returned by renderSessionTopUpPage. */
export interface SessionTopUpPageView {
  vip_id: string;
  session_id: string;
  session_state: CyranoSessionState;
  remaining_minutes: number;
  is_expired: boolean;
  can_resume: boolean;
  recommended_skus: TopUpSku[];
  wallet_buckets: TopUpWalletBucketRow[];
  selected_sku_id: string | null;
  selected_bucket: TopUpWalletBucketRow['bucket'] | null;
  context_restorable: boolean;
}
