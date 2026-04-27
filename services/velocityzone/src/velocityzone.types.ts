// VelocityZone — shared types
// Business Plan §3 — time-window payout rate events keyed to FFS score.
// On every tip during an active VelocityZone event, the FFS score maps to
// an exact payout rate (7.5¢ floor → 9¢ ceiling). Rate is locked at tip time.

/** A VelocityZone event definition. */
export interface VelocityZoneEvent {
  event_id: string;
  name: string;
  /** ISO-8601 UTC start of the velocity window. */
  starts_at: string;
  /** ISO-8601 UTC end of the velocity window. */
  ends_at: string;
  /** Minimum payout rate in USD per CZT token (floor). Default: 0.075. */
  rate_floor_usd: number;
  /** Maximum payout rate in USD per CZT token (ceiling). Default: 0.090. */
  rate_ceiling_usd: number;
  /** Optional: restrict to specific creator IDs. Empty = all creators. */
  creator_ids: string[];
  status: VelocityZoneStatus;
  created_by: string;
  rule_applied_id: string;
  correlation_id: string;
  reason_code: string;
  created_at: string;
}

export type VelocityZoneStatus = 'SCHEDULED' | 'ACTIVE' | 'ENDED' | 'CANCELLED';

/** Rate lookup result for a tip during an active VelocityZone event. */
export interface VelocityZoneRateResult {
  /** Whether a VelocityZone event is currently active. */
  active: boolean;
  event_id?: string;
  /** FFS score at tip time (0-100). */
  ffs_score: number;
  /** Exact payout rate locked at tip time. */
  rate_usd: number;
  rule_applied_id: string;
}

/** Creator rate tier — founding / standard / post-day-61. */
export interface CreatorRateTier {
  tier_id: string;
  creator_id: string;
  /** Tier name: 'FOUNDING' | 'STANDARD' | 'POST_DAY_61'. */
  tier_name: string;
  /** Base rate floor (USD per CZT). */
  rate_floor_usd: number;
  /** Base rate ceiling (USD per CZT). */
  rate_ceiling_usd: number;
  effective_from: string;
  effective_to?: string;
  correlation_id: string;
  reason_code: string;
  rule_applied_id: string;
  created_at: string;
}

export const VELOCITYZONE_RULE_ID = 'VELOCITYZONE_v1';

/** Founding creator rate (Day 1 – Day 60). */
export const FOUNDING_RATE_FLOOR_USD   = 0.075;
export const FOUNDING_RATE_CEILING_USD = 0.090;

/** Standard creator rate (Day 1 – Day 60 for non-founding). */
export const STANDARD_RATE_FLOOR_USD   = 0.065;
export const STANDARD_RATE_CEILING_USD = 0.080;

/** Post-Day 61 rate floor (all creators). */
export const POST_DAY61_RATE_FLOOR_USD   = 0.075;
export const POST_DAY61_RATE_CEILING_USD = 0.090;
