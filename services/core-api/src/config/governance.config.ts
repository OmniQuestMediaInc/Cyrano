// WO: WO-016-B

/**
 * GovernanceConfigService
 * Canonical source for platform-wide governance constants.
 * Timezone authority: America/Toronto (WO-016-B).
 */
export class GovernanceConfigService {
  public readonly TIMEZONE = 'America/Toronto';

  // ── PROC-001: Webhook Hardening ───────────────────────────────────────────
  /** Maximum allowed drift (seconds) between webhook timestamp and server clock. */
  public readonly WEBHOOK_REPLAY_WINDOW_SECONDS = 300; // 5 minutes
  /** TTL (seconds) for entries in the in-process nonce store before cleanup. */
  public readonly WEBHOOK_NONCE_STORE_TTL_SECONDS = 600; // 10 minutes
  /** HMAC algorithm used for signature verification. */
  public readonly WEBHOOK_SIGNATURE_ALGO = 'sha256';
  /** Idempotency TTL in milliseconds (derived from WEBHOOK_NONCE_STORE_TTL_SECONDS). */
  public readonly WEBHOOK_IDEMPOTENCY_TTL_MS = 600_000; // 600s × 1000
  /** Processor event envelope schema version accepted by this service. */
  public readonly WEBHOOK_EVENT_SCHEMA_VERSION = 'v1';
  /** Webhook signing secret — read from environment, never hardcoded. */
  public get WEBHOOK_SIGNING_SECRET(): string {
    return process.env.WEBHOOK_SIGNING_SECRET ?? '';
  }
}

export const COMMISSION_DEFAULTS = {
  MODEL_TOKEN_VALUE_MIN: 0.065, // USD
  MODEL_TOKEN_VALUE_MAX: 0.08, // USD
  DEFAULT_STUDIO_AGENCY_FEE_PCT: 0.2, // 20%
  PLATFORM_SYSTEM_FEE_FLAT: 50.0,
  TIERED_PAYOUT_ENABLED_DEFAULT: false,
};

export enum StudioFeeType {
  MEMBERSHIP = 'MEMBERSHIP_FIXED',
  HOURLY_SERVICE = 'SERVICE_HOURLY',
  SESSION_SERVICE = 'SERVICE_SESSION',
  PLATFORM_USAGE_PCT = 'PLATFORM_PCT',
  PENALTY = 'FINANCIAL_PENALTY',
}

// ─── DIAMOND TIER PRICING ────────────────────────────────────────────────────
export const DIAMOND_TIER = {
  PAYOUT_RATE_PER_TOKEN: 0.075, // USD — standard minimum creator payout (cold-band rate, RATE_COLD); see GovernanceConfig.RATE_DIAMOND_FLOOR (0.080) for the 10K+ bulk Diamond floor
  PLATFORM_FLOOR_PER_TOKEN: 0.077, // USD — minimum platform price (wee profit)
  EXCHANGE_COST_DIAMOND_PCT: 0.0, // Diamond conversion is fee-free
  EXTENSION_FEE_14_DAY_USD: 49.0, // 14-day token expiry extension
  RECOVERY_FEE_EXPIRED_USD: 79.0, // Fee to recover already-expired balance
  EXPIRED_CREATOR_POOL_PCT: 0.7, // % of expired tokens to creator bonus pool
  EXPIRED_PLATFORM_MGMT_PCT: 0.3, // % retained by OQMI as management fee
  VIP_BASELINE_PER_1000: 0.12, // Comparison baseline shown in estimator
  // CANONICAL — 3-tier structure locked 2026-04-11.
  // Pricing Architecture v1.3 5-tier Concierge table is superseded by this.
  VOLUME_TIERS: [
    { min_tokens: 10000, max_tokens: 27499, base_rate: 0.095 },
    { min_tokens: 30000, max_tokens: 57499, base_rate: 0.088 },
    { min_tokens: 60000, max_tokens: Infinity, base_rate: 0.082 },
  ],
  VELOCITY_MULTIPLIERS: {
    DAYS_14: 1.0,
    DAYS_30: 1.0,
    DAYS_90: 1.08,
    DAYS_180: 1.12,
    DAYS_366: 1.15,
  },
} as const;

// ─── SHOW_THEATRE VENUE PRICING ───────────────────────────────────────────────
// Venue admission + multiplier constants for the SHOW_THEATRE venue (legacy
// "ShowZone Theatre"). All values are denominated in CZT — there is no
// separate ShowToken / SZT token type (retired by Single CZT Token Economy
// v1; see services/showzone/RETIRED.md). Constant name retained because it is
// read by services/bijou/PassPricingService and migrating it is a larger
// follow-up not covered by this branch.
export const SHOWZONE_PRICING = {
  PASS_BASE_CZT_TOKENS: 100, // Base pass price in CZT
  MIN_SEATS_TO_GO_LIVE: 20, // Auto-cancel if fewer seats sold at T-1hr
  PAYOUT_RATE_PER_CZT: 0.08, // Creator payout per CZT
  CZT_PRICE_USD: 0.13, // CZT USD price (for display/estimates)
  PHASE2_CAPACITY_PCT: 0.25, // Phase 2 Uber Private = 25% of Phase 1 count
  PHASE2_PRICE_MULTIPLIERS: {
    TIER_1: 1.3, // +30% over Phase 1 pass
    TIER_2: 1.5, // +50%
    TIER_3: 1.8, // +80%
  },
  DAY_MULTIPLIERS: {
    MON: 0.85,
    TUE: 0.85,
    WED: 0.95,
    THU: 1.0,
    FRI: 1.2,
    SAT: 1.3,
    SUN: 1.1,
  },
  TIME_MULTIPLIERS: {
    // Hour ranges in America/Toronto (24h)
    AFTERNOON: { from: 12, to: 17, multiplier: 0.9 },
    PRIME: { from: 19, to: 23, multiplier: 1.15 },
    LATE_NIGHT: { from: 23, to: 26, multiplier: 1.1 }, // 26 = 02:00 next day
    OFF_PEAK: { from: 0, to: 12, multiplier: 0.8 },
  },
  CREATOR_TIER_MULTIPLIERS: {
    NEW: 0.85, // < 50 registered fans
    RISING: 1.0, // 50–199 fans
    ESTABLISHED: 1.15, // 200–999 fans
    STAR: 1.35, // 1000+ fans
  },
  ADVANCE_PURCHASE_MULTIPLIERS: {
    SAME_DAY: 1.0, // 0 days ahead
    ONE_TO_THREE: 0.95, // 1–3 days ahead (early bird)
    FOUR_TO_SEVEN: 0.9, // 4–7 days ahead
    EIGHT_PLUS: 0.85, // 8+ days ahead
  },
} as const;

// ─── BIJOU PLAY.ZONE PRICING ──────────────────────────────────────────────────
export const BIJOU_PRICING = {
  ADMISSION_CZT_TOKENS_BASE: 240, // Base admission in CZT
  CREATOR_SPLIT_PCT: 0.85, // 85% to performing creator
  OQMI_SPLIT_PCT: 0.15, // 15% to OmniQuest Media Inc.
  PAYOUT_RATE_PER_CZT: 0.09, // Creator payout per CZT (Bijou rate)
  CZT_PRICE_USD: 0.13, // CZT USD price
  MIN_SEATS_TO_GO_LIVE: 8, // Auto-cancel threshold at T-1hr
  MAX_PARTICIPANTS: 24, // Hard SFU cap (VIPs only; host is +1)
  WRISTBAND_DURATION_HOURS: 72, // Same as ShowZone wristband
  SHOW_DURATION_MAX_MINS: 60,
  STANDBY_ACCEPT_WINDOW_SEC: 10, // VIP has 10s to claim an opened seat
  CAMERA_GRACE_PERIOD_SEC: 30, // Grace before warning screen
  CAMERA_WARNING_PERIOD_SEC: 30, // Warning countdown before ejection
  MIN_ADVANCE_BOOKING_HOURS: 72, // Must book 72hrs before show
  MAX_SCHEDULED_AT_ONE_TIME: 10,
  VELOCITY_RULES: {
    MAX_SHOWS_PER_24H: 1,
    CONSECUTIVE_CAP: 3, // After 3 consecutive shows → 2-day break
    TWO_BACK_TO_BACK_BREAK_DAYS: 1, // After 2 back-to-back → 1-day break
  },
  DAY_MULTIPLIERS: {
    // Same structure as ShowZone
    MON: 0.9,
    TUE: 0.9,
    WED: 1.0,
    THU: 1.05,
    FRI: 1.2,
    SAT: 1.25,
    SUN: 1.1,
  },
} as const;

// ─── GEO-ADAPTIVE PRICING ─────────────────────────────────────────────────────
export const GEO_PRICING = {
  TIERS: {
    LOW: { multiplier_min: 0.33, multiplier_max: 0.5, display_label: 'LOW' },
    MED: { multiplier_min: 0.6, multiplier_max: 0.8, display_label: 'MED' },
    HIGH: { multiplier: 1.0, display_label: 'HIGH' },
  },
  // ISO 3166-1 alpha-2 country codes → tier assignment
  // VERSIONED: any change to this map requires FIZ: commit + governance approval
  COUNTRY_TIER_MAP: {
    // LOW tier — developing economy purchasing power
    CO: 'LOW',
    UA: 'LOW',
    MX: 'LOW',
    PH: 'LOW',
    ID: 'LOW',
    VN: 'LOW',
    NG: 'LOW',
    PK: 'LOW',
    BD: 'LOW',
    EG: 'LOW',
    KE: 'LOW',
    ET: 'LOW',
    GH: 'LOW',
    TZ: 'LOW',
    UZ: 'LOW',
    // MED tier — mid-range purchasing power
    BR: 'MED',
    AR: 'MED',
    PL: 'MED',
    RO: 'MED',
    TR: 'MED',
    ZA: 'MED',
    MY: 'MED',
    TH: 'MED',
    CL: 'MED',
    CO_PLUS: 'MED',
    HU: 'MED',
    RS: 'MED',
    HR: 'MED',
    SK: 'MED',
    BG: 'MED',
    // HIGH tier — all others default to HIGH (full price)
    DEFAULT: 'HIGH',
  },
} as const;

// ─── WRISTBAND MECHANICS (SHARED) ─────────────────────────────────────────────
export const WRISTBAND = {
  SHOWZONE_DURATION_HOURS: 72,
  BIJOU_DURATION_HOURS: 72,
  // Bonus token evaporation distribution
  EVAPORATION_CREATOR_POOL_PCT: 0.7,
  EVAPORATION_PLATFORM_PCT: 0.3,
  // Minimum dwell time for bonus pool eligibility (per creator, per session)
  DWELL_MIN_ELIGIBILITY_SEC: 20,
  // Wristbands are venue-exclusive. A ShowZone wristband cannot admit to Bijou
  // and vice versa. This is enforced at admission gate level.
  VENUE_EXCLUSIVITY: true,
} as const;

// ─── MEMBERSHIP TIERS ─────────────────────────────────────────────────────────
export const MEMBERSHIP = {
  // CANONICAL — locked 2026-04-11. 5-tier repo structure is authoritative.
  // Pricing doc names (Day Pass / Annual Pass / OmniPass·Plus / Diamond)
  // refer to PASS PRODUCTS, not membership tiers.
  // Pass product eligibility by tier documented in DOMAIN_GLOSSARY.md.
  TIERS: ['VIP', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'] as const,
  BUNDLE_TENURE_GATE_WEEKS: 5, // Limited menu for first 5 weeks
  BUNDLE_CAPS: {
    VIP: { initial: 1000, expanded: 1000, risk_quote_above: 0 },
    SILVER: { initial: 1000, expanded: 5000, risk_quote_above: 5000 },
    GOLD: { initial: 1000, expanded: 7500, risk_quote_above: 7500 },
    PLATINUM: { initial: 1000, expanded: 8000, risk_quote_above: 8000 },
    DIAMOND: { initial: 1000, expanded: null, risk_quote_above: 0 }, // Concierge only
  },
  TOKEN_EXPIRY_DAYS: 45, // Standard token window
  TOKEN_EXPIRY_BUFFER_DAYS: 1, // T+1 logic for America/Toronto boundary
  DURATION_BONUS_TIERS: [
    { paid_months: 3, bonus_months: 1, loyalty_multiplier: 1.0 },
    { paid_months: 6, bonus_months: 2, loyalty_multiplier: 1.2 },
    { paid_months: 12, bonus_months: 3, loyalty_multiplier: 1.5 },
  ],
  // MEMB-002: ADR-003 bonus month matrix for subscription billing intervals.
  DURATION_BONUS: {
    QUARTERLY: { commitment_months: 3, bonus_months: 1 },
    SEMI_ANNUAL: { commitment_months: 6, bonus_months: 2 },
    ANNUAL: { commitment_months: 12, bonus_months: 3 },
  },
  // MEMB-003: Monthly CZT stipend per membership tier.
  // Revisable via GOV: commit only. Values in CZT units.
  STIPEND_CZT: {
    GUEST: 0,
    VIP: 0,
    VIP_SILVER: 100,
    VIP_GOLD: 175,
    VIP_PLATINUM: 250,
    VIP_DIAMOND: 500,
  },
} as const;

// ─── TOKEN EXTENSION ──────────────────────────────────────────────────────────
export const TOKEN_EXTENSION = {
  // Option A: pay extension fee on expired tokens — no new token purchase
  OPTION_A_FEE_PCT: 0.2, // fee = 20% of expired volume at 1K-bundle rate
  OPTION_A_LIFESPAN_DAYS: 46, // 45 + 1

  // Option B: buy 2500 new tokens at VIP rate — 25% of expired volume forfeited
  OPTION_B_TOKEN_PURCHASE: 2500,
  OPTION_B_FORFEITURE_PCT: 0.25,
  OPTION_B_LIFESPAN_DAYS: 46, // 45 + 1

  // Option C: buy 5000 new tokens at VIP rate — 20% of expired volume forfeited
  OPTION_C_TOKEN_PURCHASE: 5000,
  OPTION_C_FORFEITURE_PCT: 0.2,
  OPTION_C_LIFESPAN_DAYS: 91, // 90 + 1
} as const;

// ─── PRIVATE CALL (PrivateCall Feature) ───────────────────────────────────────
export const PRIVATE_CALL = {
  BLOCK_DURATIONS_MINS: [6, 12, 24],
  // Per-minute premium rate must be at least this % above equivalent block rate
  PER_MINUTE_PREMIUM_MIN_PCT: 0.2,
  MIN_ADVANCE_BOOKING_HOURS: 1, // Platform minimum; creator can set higher
  READY_CONFIRM_WINDOW_MIN_BEFORE: 5, // Push notification sent 5 mins before
  AUTO_CANCEL_NO_CONFIRM_SEC: 90, // Cancel if no creator confirmed at T+90s
  CREATOR_NO_SHOW_STRIKE_THRESHOLD: 3, // Triggers review flag
} as const;

// ─── GAMIFICATION ─────────────────────────────────────────────────────────────
export const GAMIFICATION = {
  TOKEN_TIERS: [25, 45, 60], // Low / Mid / High token price options
  GAME_TYPES: ['SPIN_WHEEL', 'SLOT_MACHINE', 'DICE'] as const,
  DICE_RANGE: { min: 2, max: 12 }, // Sum of 2d6
  PHASE2_SEAT_CAPACITY_WINDOW: 0.25, // Phase 2 = 25% of Phase 1 attendee count
} as const;

// ─── GZ SCHEDULING — GuestZone Operations Scheduling Config ─────────────────
export const GZ_SCHEDULING = {
  // ── Rolling Two-Week Cycle ──────────────────────────────────────────────
  PERIOD_LENGTH_DAYS: 14,
  BLOCK_CUTOFF_DAYS_BEFORE: 21, // B-Lock closes 21 days before period start
  FINAL_LOCK_DAYS_BEFORE: 14, // Schedule locked 14 days before period start
  BLOCK_REMINDER_DAYS: [24, 22], // Automated reminders sent at these intervals

  // ── ZoneBot 1-2-3 Rule ─────────────────────────────────────────────────
  ZONEBOT_MAX_LOTTERY_POSITIONS: 3, // Positions 1, 2, 3
  ZONEBOT_CONFIRMATION_HOURS: 16, // 16-hour confirmation clock
  ZONEBOT_SUPPRESSION_CYCLES: 2, // Awarded staff suppressed for 2 subsequent cycles

  // ── Ontario ESA 2026 Compliance ────────────────────────────────────────
  SHIFT_NOTICE_HOURS: 96, // 96 hours notice for schedules
  SHIFT_CHANGE_NOTICE_HOURS: 24, // 24 hours notice for changes
  MAX_CONSECUTIVE_DAYS: 6, // No 7-day streaks (min 1 day off per 7)
  MIN_CONSECUTIVE_DAYS_OFF_FT: 2, // Full-time: 2 consecutive days off
  MIN_CONSECUTIVE_DAYS_OFF_PT: 3, // Part-time Edge: 3 consecutive days off
  MAX_DAILY_HOURS: 8, // Standard 8-hour day
  MAX_WEEKLY_HOURS_STANDARD: 44, // Ontario ESA standard
  MAX_WEEKLY_HOURS_EXCESS: 48, // With excess hours agreement
  MIN_VACATION_DAYS_ANNUAL: 10, // 2 weeks minimum (FT)

  // ── Stat Holiday Pay ───────────────────────────────────────────────────
  STAT_HOLIDAY_PAY_MULTIPLIER: 1.5, // 1.5x Premium Pay
  STAT_HOLIDAY_INCLUDES_PUBLIC_PAY: true,

  // ── Transit Safety ─────────────────────────────────────────────────────
  TRANSIT_UNSAFE_START_HOUR: 0, // Midnight
  TRANSIT_UNSAFE_END_HOUR: 6.25, // 6:15 AM — no shifts start/end in this window

  // ── Waterfall Shift Blocks (GuestZone) ─────────────────────────────────
  SHIFTS: {
    A: {
      code: 'A',
      label: 'Morning',
      start: '07:00',
      end: '15:45',
      duration_hours: 8.75,
      meal_break_start: '11:30',
      meal_break_mins: 30,
    },
    B: {
      code: 'B',
      label: 'Swing',
      start: '15:15',
      end: '00:00',
      duration_hours: 8.75,
      meal_break_start: '19:30',
      meal_break_mins: 30,
    },
    C: {
      code: 'C',
      label: 'Night',
      start: '23:30',
      end: '08:15',
      duration_hours: 8.75,
      meal_break_start: '03:00',
      meal_break_mins: 30,
    },
  },

  // ── Minimum Coverage Baselines ─────────────────────────────────────────
  GZ_MIN_AGENTS_PER_SHIFT: 3, // 3-GZSA baseline during peak traffic
  GZ_DIALPAD_LICENSES: 4, // 4 Dialpad licenses, 1 "Safety Seat" open
  GZ_CROSSOVER_MINS: 15, // 15-minute staggered crossover

  // ── Departmental Hours ─────────────────────────────────────────────────
  DEPARTMENTS: {
    GUESTZONE: { hours_24_7: true },
    FINANCE: { start: '09:00', end: '21:00', days: 'DAILY' },
    TECH: { hours_24_7: true },
    LEGAL: { start: '09:00', end: '20:00', days: 'MON_FRI', on_call_24_7: true },
    MAINTENANCE: { start: '07:00', end: '22:00', days: 'DAILY' },
    RECEPTION: { start: '08:00', end: '17:00', days: 'DAILY' },
  },
} as const;

// ─── PLATFORM GLOBAL (CEO-DECISIONS-2026-04-12) ───────────────────────────────
export const PLATFORM_GLOBAL = {
  CURRENCY: 'USD', // ISO 4217 — current trading currency
  MARKETPLACE_FEE_PCT: 0.18, // 18% — locked CEO 2026-04-12 (revised from 12.5%)
  // Applied to: digital merchandise, physical merchandise, digital content vault downloads,
  // post-embargo PPV/catalog recording sales.
  // NOT applied to: performance recordings purchased pre/during/post-show (within 24hr).
} as const;

// ─── MERCHANDISE CONFIG (CEO-DECISIONS-2026-04-12) ────────────────────────────
export const MERCHANDISE_CONFIG = {
  ACCEPTED_TOKEN_TYPE: 'CZT', // Only CZT accepted — ShowTokens removed
  CREATOR_PAYOUT_PER_TOKEN_USD: 0.075, // $0.075 USD per ChatToken — locked 2026-04-12
  DISPUTE_HOLD_TRIGGER: 'IMMEDIATE', // Hold applied on ticket creation
  DISPUTE_CREATOR_WINDOW_HOURS: 72, // 72h (3 business days) to resolve
  DISPUTE_REMINDER_HOURS: [0, 24], // Reminders at ticket creation and 24h
  REFUND_ORIGINAL_CARD_ONLY: true, // No alternate card — no exceptions
} as const;

// ─── PERFORMANCE RECORDING (CEO-DECISIONS-2026-04-12) ─────────────────────────
export const PERFORMANCE_RECORDING = {
  POST_SHOW_PURCHASE_WINDOW_HOURS: 24, // Last-call window after show ends
  EMBARGO_DAYS: 10, // Suppression period after post-show window
  CATALOG_RELEASE_DAY: 11, // Day 11 — available in creator PPV/merch catalog
  DM_ON_SHOW_START: true, // DM sent to all attendees at show start
  DM_ON_SHOW_END: true, // DM sent to non-purchasers at show end
} as const;

// ─── CONCIERGE APPOINTMENT (CEO-DECISIONS-2026-04-12) ─────────────────────────
export const CONCIERGE_APPT = {
  OPEN_HOUR: 11, // 11:00 AM billing-address TZ
  CUTOFF_HOUR: 22, // 10:00 PM — no new appointments after this hour
  CUTOFF_MINUTE: 30, // Combined: 10:30 PM hard cutoff for new appointments
  // Guests with existing appointments booked before cutoff may still execute
  // purchase up to DFSP_PURCHASE_WINDOW_CLOSE_HOUR (23:00).
} as const;

// ─── FAN CLUB (CEO-DECISIONS-2026-04-12-B) ────────────────────────────────────
export const FAN_CLUB = {
  ACCEPTED_TOKEN_TYPE: 'CZT', // ShowTokens not accepted
  BILLING_CYCLES: ['MONTHLY', 'ANNUAL'] as const,
  ANNUAL_DISCOUNT_PCT: null, // TBD — pending CEO confirmation
  // Fan club fee applies PLATFORM_GLOBAL.MARKETPLACE_FEE_PCT (18%) — no separate constant.
} as const;

// ─── ZONE MAP (MEMB-001 — Zone Access Enforcement) ───────────────────────────
// Defines which membership tiers may access which zones.
// ShowZonePass overrides tier gate for SHOW_THEATRE and BIJOU only.
// Tier rank order (lowest → highest): GUEST → VIP → VIP_SILVER → VIP_GOLD → VIP_PLATINUM → VIP_DIAMOND
export const ZONE_MAP = {
  CHAT_ZONE: ['GUEST', 'VIP', 'VIP_SILVER', 'VIP_GOLD', 'VIP_PLATINUM', 'VIP_DIAMOND'] as const,
  SHOW_THEATRE: ['VIP_SILVER', 'VIP_GOLD', 'VIP_PLATINUM', 'VIP_DIAMOND'] as const,
  BIJOU: ['VIP_PLATINUM', 'VIP_DIAMOND'] as const,
  PRIVATE_CALL: ['VIP_PLATINUM', 'VIP_DIAMOND'] as const,
  DIAMOND_CONCIERGE: ['VIP_DIAMOND'] as const,
  // CYRANO Layer 2 — standalone role-play platform.
  // Spec maps "OmniPass+ and Diamond" to the upper-VIP pair. OmniPass·Plus is a
  // pass-product name (see MEMBERSHIP.TIERS comment) that aligns with the
  // VIP_PLATINUM membership tier in the canonical 5-tier set.
  CYRANO_LAYER2: ['VIP_PLATINUM', 'VIP_DIAMOND'] as const,
} as const;

// Zones where a ShowZonePass can override tier-based denial
export const SHOW_ZONE_PASS_OVERRIDE_ZONES = ['SHOW_THEATRE', 'BIJOU'] as const;

// Canonical membership tiers for zone access (ordered lowest → highest)
export const ZONE_ACCESS_TIERS = [
  'GUEST',
  'VIP',
  'VIP_SILVER',
  'VIP_GOLD',
  'VIP_PLATINUM',
  'VIP_DIAMOND',
] as const;
export type ZoneAccessTier = (typeof ZONE_ACCESS_TIERS)[number];
export type ZoneAccessZone = keyof typeof ZONE_MAP;

// ─── CREATOR SAAS (CEO-DECISIONS-2026-04-12-B) ────────────────────────────────
export const CREATOR_SAAS = {
  TIERS_ACTIVE: false, // Master kill switch — admin toggles on
  FREE_TIER_ENABLED: true,
  TIER_1_MONTHLY_USD: 19.95,
  TIER_2_MONTHLY_USD: 24.95,
  TIER_3_MONTHLY_USD: 49.95,
  BILLING_CYCLES: ['MONTHLY', 'ANNUAL'] as const,
  ANNUAL_DISCOUNT_PCT: null, // TBD — pending CEO confirmation
  // Build and ship. INACTIVE at launch. Admin-side activation only.
} as const;

// ─── OBS (OBS-001 — OBS Bridge + Chat Aggregator + Persona Engine) ───────────
// Canonical constants for the OBS bridge layer and persona engine.
// Revisions require OBS: commit.
export const OBS = {
  CHAT_JITTER_MIN_MS: 150,
  CHAT_JITTER_MAX_MS: 450,
  // Bill 149 (Ontario) disclosure prefix for AI-generated creator responses.
  // Applied to every CREATOR_AUTO=true persona output before publish.
  BILL_149_DISCLOSURE_PREFIX: 'This message was generated with AI assistance. ',
} as const;

// ─── REDBOOK RATE CARDS (Canonical Ledger — Payload 1) ───────────────────────
// Source of truth for all CZT bundle pricing and creator payout rates consumed
// by services/ledger/. Values LOCKED per REDBOOK Section 3 + Diamond Tier
// pricing table. NEVER hardcode prices in service code — always read from this
// constant. FIZ: commit required for any change.
//
// NOTE (Single CZT Token Economy v1): TEASE_SHOWZONE bundles have been removed.
// All purchases use CZT and a single bundle ladder. SHOW_THEATRE venue
// admission pricing is resolved through services/bijou/PassPricingService
// against SHOWZONE_PRICING (venue pricing constant, still denominated in CZT).
export const REDBOOK_RATE_CARDS = {
  // Tease Phase regular bundles (guest-facing purchase rail).
  TEASE_REGULAR: [
    { tokens: 150, guest_usd: 19.99, member_usd: 17.99, creator_payout_per_token: 0.075 },
    { tokens: 500, guest_usd: 59.99, member_usd: 53.99, creator_payout_per_token: 0.075 },
    { tokens: 1_000, guest_usd: 119.99, member_usd: 107.99, creator_payout_per_token: 0.075 },
    { tokens: 5_000, guest_usd: 549.99, member_usd: 494.99, creator_payout_per_token: 0.08 },
    { tokens: 10_000, guest_usd: 999.99, member_usd: 899.99, creator_payout_per_token: 0.082 },
  ] as const,

  // Diamond Tier floor — matches DIAMOND_TIER volume brackets above.
  // Represented here as the (min,max,rate,velocity) matrix pre-joined for O(1) lookup.
  DIAMOND_FLOOR_PER_TOKEN_MIN: 0.077,
  DIAMOND_FLOOR_PER_TOKEN_MAX: 0.12,

  // VIP comparison baseline shown in estimators and Diamond quote flow.
  VIP_BASELINE_PER_TOKEN: 0.12,
} as const;

// ─── RECOVERY ENGINE — Unified Customer Service (REDBOOK §5) ─────────────────
// Drives Recovery Engine workflows in services/ledger/recovery.service.ts.
// Revisions require REDBOOK: commit + CEO sign-off.
export const RECOVERY_ENGINE = {
  // Diamond tokens expire 14 days from issuance (unless extended).
  DIAMOND_EXPIRY_DAYS: 14,

  // Automated warning fires this many hours before expiry.
  EXPIRY_WARNING_HOURS: 48,

  // Extension fee in USD — applied before expiry to push horizon +14 days.
  EXTENSION_FEE_USD: 49.0,
  EXTENSION_GRANT_DAYS: 14,

  // Recovery fee in USD — applied after expiry to restore lapsed balance.
  RECOVERY_FEE_USD: 79.0,

  // Expired token redistribution (when neither extension nor recovery is exercised).
  EXPIRED_CREATOR_POOL_PCT: 0.7, // 70% → Creator Bonus Pool
  EXPIRED_PLATFORM_PCT: 0.3, // 30% → Platform (OQMI mgmt fee)

  // Token Bridge — goodwill reinstatement.
  // Grants a 20% bonus credit + waives the recovery fee on a single future lapse.
  TOKEN_BRIDGE_BONUS_PCT: 0.2,
  TOKEN_BRIDGE_WAIVER_LIMIT: 1, // Waiver applies to one lapse per 365 days.

  // 3/5ths Exit — partial refund with 24h cool-off.
  // Refunds 60% of current purchased-bucket balance and locks both buy + spend
  // for 24 hours. Name reflects the three-of-five split (60% refund / 40% retained).
  THREE_FIFTHS_REFUND_PCT: 0.6,
  THREE_FIFTHS_LOCK_HOURS: 24,
} as const;

// ─── LEDGER SPEND ORDER (FIZ-003 — Three-Bucket Wallet) ──────────────────────
// Authoritative drain order for every debit against a canonical wallet.
// System-enforced; user cannot choose which bucket funds a spend.
export const LEDGER_SPEND_ORDER = ['purchased', 'membership', 'bonus'] as const;
export type LedgerBucket = (typeof LEDGER_SPEND_ORDER)[number];

// ─── MICRO-GIFTS (Payload #13 — CNZ × RRR Integration) ──────────────────────
// Cross-system micro-gift catalogue. Every gift is purchasable in two
// currencies:
//   • CZT tokens (debited via LedgerService inside CNZ)
//   • RRR points (burned via RedRoomRewards /api/v1/burn/gift)
// Point price = ceil(token_value / RRR_POINT_USD_VALUE) × (1 + commission).
// The commission is the operator margin RRR collects on cross-redemption.
export const RRR_GIFT_COMMISSION_PCT = 0.25;

/** USD value of a single RRR point — used for token↔point parity calc. */
export const RRR_POINT_USD_VALUE = 0.01;

/** USD value of a single CZT token used for gift parity quoting. */
export const GIFT_TOKEN_USD_VALUE = 0.08;

export interface MicroGiftDef {
  /** Stable canonical id — sent to RRR as `giftId`. */
  gift_id: string;
  display_name: string;
  emoji: string;
  /** Price in CZT tokens when paid via wallet. */
  token_value: number;
}

export const MICRO_GIFTS: readonly MicroGiftDef[] = [
  { gift_id: 'rose', display_name: 'Rose', emoji: '🌹', token_value: 5 },
  { gift_id: 'heart', display_name: 'Heart', emoji: '💗', token_value: 10 },
  { gift_id: 'star', display_name: 'Star', emoji: '⭐', token_value: 15 },
  { gift_id: 'fire', display_name: 'Fire', emoji: '🔥', token_value: 25 },
  { gift_id: 'champagne', display_name: 'Champagne', emoji: '🍾', token_value: 50 },
  { gift_id: 'diamond', display_name: 'Diamond', emoji: '💎', token_value: 100 },
  { gift_id: 'crown', display_name: 'Crown', emoji: '👑', token_value: 250 },
  { gift_id: 'rocket', display_name: 'Rocket', emoji: '🚀', token_value: 500 },
] as const;

/**
 * Compute the RRR points price for a gift, applying the cross-redemption
 * commission. Rounded up so the operator never quotes below the floor.
 */
export function rrrPointsPriceFor(gift: MicroGiftDef): number {
  const tokenUsd = gift.token_value * GIFT_TOKEN_USD_VALUE;
  const baseRrrPoints = tokenUsd / RRR_POINT_USD_VALUE;
  return Math.ceil(baseRrrPoints * (1 + RRR_GIFT_COMMISSION_PCT));
}

/** Lookup helper. Returns undefined if `gift_id` is not in the catalogue. */
export function findMicroGift(gift_id: string): MicroGiftDef | undefined {
  return MICRO_GIFTS.find((g) => g.gift_id === gift_id);
}

// ─── PROMOTION ENGINE (PROMO-001) ────────────────────────────────────────────
// CEO-AUTHORIZED 2026-04-27.
// REASON: Launch promotion — 70% discount on first subscription period.
// IMPACT: Controls promo code validation and subscription period calculation.
// CORRELATION_ID: CNZ-WORK-001-PROMO-001
export const PROMOTION = {
  LAUNCH70_CODE: 'LAUNCH70',
  LAUNCH70_DISCOUNT_PCT: 70,
  LAUNCH70_EXPIRES_AT: new Date('2026-07-31T23:59:59Z'),
  LAUNCH70_MAX_USES: 5000,
  // Months granted for ANNUAL billing interval under the launch promo.
  LAUNCH70_ANNUAL_MONTHS: 12,
  // Months granted for all other billing intervals under the launch promo.
  LAUNCH70_STANDARD_MONTHS: 1,
} as const;

// ─── BENEFIT LIMITS BY TIER ───────────────────────────────────────────────────
// Per-month caps enforced by BenefitsGuard. -1 = unlimited.
export const BENEFIT_LIMITS: Record<string, { images: number; voiceMin: number }> = {
  GUEST:        { images: 0,   voiceMin: 0   },
  VIP:          { images: 5,   voiceMin: 0   },
  VIP_SILVER:   { images: 20,  voiceMin: 30  },
  VIP_GOLD:     { images: 50,  voiceMin: 60  },
  VIP_PLATINUM: { images: 100, voiceMin: 120 },
  VIP_DIAMOND:  { images: -1,  voiceMin: -1  },
} as const;
