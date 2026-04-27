// CRM: Guest-Heat intelligence layer — shared types
// Business Plan §B.4 / §B.3.5 — whale profiling, offer engine,
// gemstone system, Cyrano teleprompter, dual-flame pulse, forecasting,
// performance timer.

// ── Membership + loyalty ────────────────────────────────────────────────────

export type MembershipTier =
  | 'GUEST'
  | 'VIP'
  | 'VIP_SILVER'
  | 'VIP_SILVER_BULLET'
  | 'VIP_GOLD'
  | 'VIP_PLATINUM'
  | 'VIP_DIAMOND';

export type LoyaltyTier =
  | 'STANDARD'
  | 'RISING'
  | 'WARM'
  | 'HOT'
  | 'WHALE'
  | 'ULTRA_WHALE';

// ── Whale profile ───────────────────────────────────────────────────────────

/** Multi-window spend snapshot (all values in CZT tokens). */
export interface SpendWindows {
  spend_24h: number;
  spend_72h: number;
  spend_7d: number;
  spend_14d: number;
  spend_30d: number;
}

/** Preference vector — behavioural signals used for offer personalisation. */
export interface PreferenceVector {
  /** Tip frequency percentile vs. cohort (0..100). */
  tip_frequency_pct: number;
  /** Average tip size in CZT. */
  avg_tip_size_czt: number;
  /** Preferred session duration in minutes. */
  preferred_dwell_minutes: number;
  /** Preferred room heat tier at tip time. */
  preferred_ffs_tier: 'COLD' | 'WARM' | 'HOT' | 'INFERNO';
  /** Gemstone acceptance rate (0..1). */
  gemstone_accept_rate: number;
  /** Sensitivity to seasonal events. */
  seasonal_responsive: boolean;
}

/** Scored whale profile for a guest. */
export interface WhaleProfileRecord {
  profile_id: string;
  guest_id: string;
  loyalty_tier: LoyaltyTier;
  /** Composite whale score 0..100. */
  whale_score: number;
  spend: SpendWindows;
  preference_vector: PreferenceVector;
  /** ISO 3166-1 alpha-2 or CNZ region code. */
  geo_region?: string;
  correlation_id: string;
  reason_code: string;
  rule_applied_id: string;
  scored_at_utc: string;
}

// ── Offer engine ────────────────────────────────────────────────────────────

export type OfferType =
  | 'SPENDING_PATTERN'  // triggered by spend velocity analysis
  | 'GEO_PRICE'         // regional pricing shown to guest
  | 'LOYALTY_REWARD'    // loyalty tier milestone
  | 'SEASONAL';         // tied to a seasonal event

/** A personalised offer presented to a guest. */
export interface GuestOffer {
  offer_id: string;
  guest_id: string;
  session_id?: string;
  offer_type: OfferType;
  /** Description shown in the guest UI. */
  display_text: string;
  /** Value in CZT tokens. */
  value_czt: number;
  /** Regional price displayed (may differ from public feed). */
  regional_price_display?: string;
  /** Full public price for audit purposes. */
  public_price_czt?: number;
  expires_at_utc: string;
  correlation_id: string;
  reason_code: string;
  rule_applied_id: string;
  triggered_at_utc: string;
}

// ── Gemstone system ─────────────────────────────────────────────────────────

export type GemType = 'RUBY' | 'SAPPHIRE' | 'EMERALD' | 'DIAMOND' | 'AMETHYST' | 'TOPAZ';
export type GemVisibility = 'PUBLIC' | 'PRIVATE';
export type GemStatus = 'QUEUED' | 'SENT' | 'VIEWED' | 'DECLINED';

/** A gemstone award to queue for a guest. */
export interface GemstoneAwardRecord {
  gem_id: string;
  guest_id: string;
  session_id?: string;
  gem_type: GemType;
  /** Customisable erotic / romantic symbolism text. */
  symbolism: string;
  visibility: GemVisibility;
  status: GemStatus;
  /** Deliberate send delay in seconds — human-like pacing. */
  send_delay_sec: number;
  sent_at_utc?: string;
  correlation_id: string;
  reason_code: string;
  rule_applied_id: string;
  created_at_utc: string;
}

// ── Cyrano teleprompter ─────────────────────────────────────────────────────

/** Seasonal campaign identifiers. */
export type SeasonalCampaign =
  | 'VALENTINES'
  | 'PRIDE'
  | 'CARNAVAL'
  | 'HALLOWEEN'
  | 'OKTOBERFEST'
  | 'MARDI_GRAS'
  | 'DIWALI'
  | 'CHINESE_NEW_YEAR'
  | 'CINCO_DE_MAYO'
  | 'FOURTH_OF_JULY'
  | 'CHRISTMAS'
  | 'THANKSGIVING'
  | 'BIRTHDAY_WEEK'
  | 'PLATFORM_ANNIVERSARY';

/** One step in a serial suggestion chain. */
export interface TeleprompterStep {
  step_index: number;
  suggestion: string;
  /** Optional beat/pause duration in seconds before the next step. */
  beat_sec?: number;
}

/** State of a teleprompter chain for a session. */
export interface TeleprompterChainState {
  chain_id: string;
  session_id: string;
  creator_id: string;
  campaign: SeasonalCampaign;
  steps: TeleprompterStep[];
  current_step_index: number;
  started_at_utc: string;
  last_advanced_at_utc?: string;
  completed: boolean;
  rule_applied_id: string;
}

// ── Dual Flame Pulse ────────────────────────────────────────────────────────

/** Dual Flame Pulse event — fires when two VIP+ guests are simultaneously
 *  active in the same room with elevated heat tier. */
export interface DualFlamePulseEvent {
  event_id: string;
  session_id: string;
  creator_id: string;
  /** The two guest IDs whose co-presence triggered the pulse. */
  guest_a_id: string;
  guest_b_id: string;
  ffs_tier: 'HOT' | 'INFERNO';
  triggered_at_utc: string;
  rule_applied_id: string;
}

// ── Predictive forecasting ──────────────────────────────────────────────────

export type ForecastSignal =
  | 'WEATHER_HOT'   // regional temperature spike
  | 'WEATHER_COLD'
  | 'HOLIDAY'       // statutory / cultural holiday
  | 'SEASONAL_PEAK' // season-wide uplift
  | 'WEEKEND';

/** Spend forecast for a room / time window. */
export interface SpendForecast {
  forecast_id: string;
  session_id: string;
  creator_id: string;
  /** UTC start of the forecast window. */
  window_start_utc: string;
  /** UTC end of the forecast window. */
  window_end_utc: string;
  /** Expected spend in CZT tokens. */
  expected_spend_czt: number;
  /** 0..100 confidence score. */
  confidence: number;
  signals: ForecastSignal[];
  rule_applied_id: string;
  generated_at_utc: string;
}

// ── Performance timer ───────────────────────────────────────────────────────

export type PerfTimerState = 'GREEN' | 'YELLOW' | 'RED';

/** Immutable performance timer audit record. */
export interface PerfTimerAudit {
  audit_id: string;
  session_id: string;
  creator_id: string;
  state: PerfTimerState;
  /** Elapsed seconds since session start when this state transition occurred. */
  elapsed_sec: number;
  /** Revenue earned in CZT tokens at transition time. */
  revenue_at_transition_czt: number;
  transition_reason: string;
  correlation_id: string;
  rule_applied_id: string;
  recorded_at_utc: string;
}

// ── Rule ID ──────────────────────────────────────────────────────────────────

export const GUEST_HEAT_RULE_ID = 'GUEST_HEAT_v1';

// ── Perf timer thresholds ────────────────────────────────────────────────────

/** Session duration thresholds for performance timer state transitions. */
export const PERF_TIMER = {
  YELLOW_THRESHOLD_MIN: 20,  // GREEN → YELLOW after 20 minutes
  RED_THRESHOLD_MIN:    40,  // YELLOW → RED after 40 minutes
} as const;

// ── Gemstone default symbolisms ──────────────────────────────────────────────

export const DEFAULT_SYMBOLISM: Record<GemType, string> = {
  RUBY:     'A ruby — symbol of passion and desire.',
  SAPPHIRE: 'A sapphire — symbol of trust and devotion.',
  EMERALD:  'An emerald — symbol of growth and intimacy.',
  DIAMOND:  'A diamond — symbol of ultimate connection.',
  AMETHYST: 'An amethyst — symbol of sensual mystery.',
  TOPAZ:    'A golden topaz — symbol of warmth and surrender.',
};

// ── Geo-pricing ──────────────────────────────────────────────────────────────

/** Regional price multiplier by CNZ region code. */
export const GEO_PRICE_MULTIPLIERS: Record<string, number> = {
  NA:  1.00, // North America — base rate
  EU:  0.92, // Europe
  UK:  0.95, // United Kingdom
  AU:  0.88, // Australia / Oceania
  LA:  0.72, // Latin America
  IN:  0.55, // India
  SEA: 0.65, // South-East Asia
  MEA: 0.70, // Middle East / Africa
};
