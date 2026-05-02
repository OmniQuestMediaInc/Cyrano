// PAYLOAD K+M — UI contracts for the guest-facing Rewards Dashboard + Diamond
// Concierge surface. Mirrors the service DTOs so the presenter can bind without
// re-deriving field names.
//
// @alpha-frozen — wireframe binding target for Grok handoff
// (docs/UX_INTEGRATION_BRIEF.md §1). Field additions require a versioned
// migration; field removals require CEO sign-off.

// ─── Rewards Dashboard ─────────────────────────────────────────────────────────

export type EarningAction =
  | 'DAILY_LOGIN'
  | 'MESSAGE_SENT'
  | 'IMAGE_GENERATED'
  | 'VOICE_CALL'
  | 'REFERRAL'
  | 'HOUSE_MODEL_CHAT'
  | 'PORTAL_SWITCH';

export type BurnReward = 'EXTRA_IMAGES' | 'TEMP_INFERNO' | 'CUSTOM_TWIN';

export interface RrrPointsEntryViewModel {
  id: string;
  amount: number;
  action: string;
  description: string;
  created_at_utc: string;
}

export interface BurnShopItem {
  reward: BurnReward;
  label: string;
  description: string;
  cost_points: number;
  expires_in_days: number | null;
}

export interface ActiveGrantViewModel {
  grant_id: string;
  reward_type: BurnReward;
  points_burned: number;
  expires_at_utc: string | null;
}

/** Top-level view model for /rewards dashboard page. */
export interface RewardsDashboardView {
  user_id: string;
  balance: number;
  history: RrrPointsEntryViewModel[];
  burn_shop: BurnShopItem[];
  active_grants: ActiveGrantViewModel[];
  cross_portal_enabled: boolean;
  captured_at_utc: string;
}

// ─── Diamond Concierge ────────────────────────────────────────────────────────

export type ConciergeSessionStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface ConciergeSessionViewModel {
  id: string;
  request_summary: string; // first 120 chars of request
  status: ConciergeSessionStatus;
  priority: string;
  created_at_utc: string;
}

/** View model for the Diamond Concierge portal page. */
export interface DiamondConciergeDashboardView {
  user_id: string;
  tier_permitted: boolean;
  sessions: ConciergeSessionViewModel[];
  captured_at_utc: string;
}
