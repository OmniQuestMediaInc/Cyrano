// CYR: CYR-SUB-001 — Subscription Types
// Cyrano portal subscription tier + portal definitions.
// Distinct from MembershipTier (ChatNow.Zone VIP tiers).

export type SubscriptionTier = 'SPARK' | 'FLAME' | 'INFERNO';

export type Portal =
  | 'MAIN'
  | 'INK_AND_STEEL'
  | 'LOTUS_BLOOM'
  | 'DESPERATE_HOUSEWIVES'
  | 'BARELY_LEGAL'
  | 'DARK_DESIRES';

export type BillingCycle = 'monthly' | 'annual';

export interface TierBenefits {
  tier: SubscriptionTier;
  limits: {
    /** -1 = unlimited */
    images: number;
    /** -1 = unlimited */
    messages: number;
    /** -1 = unlimited */
    videos: number;
  };
}

/**
 * Benefits matrix per subscription tier.
 * SPARK: entry-level limits.
 * FLAME: expanded limits.
 * INFERNO: unlimited access.
 */
export const TIER_BENEFITS: Record<SubscriptionTier, TierBenefits> = {
  SPARK: {
    tier: 'SPARK',
    limits: { images: 20, messages: 200, videos: 5 },
  },
  FLAME: {
    tier: 'FLAME',
    limits: { images: 100, messages: 1000, videos: 25 },
  },
  INFERNO: {
    tier: 'INFERNO',
    limits: { images: -1, messages: -1, videos: -1 },
  },
} as const;
