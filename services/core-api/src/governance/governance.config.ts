// FIZ: PV-001 — DFSP Foundation Layer
// DFSP — Diamond Financial Security Platform™ (v1.1 LOCKED)
// All DFSP governance constants. Source of truth: DFSP Engineering Spec v1.0/v1.1/v1.1a.
// DO NOT hardcode any of these values in services — always read from this config.
import Decimal from 'decimal.js';

export const GovernanceConfig = {
  // ── Integrity Hold (DFSP v1.1a — formula LOCKED) ─────────────────────────
  DFSP_INTEGRITY_HOLD_FLOOR_CAD: new Decimal('100.00'),
  DFSP_INTEGRITY_HOLD_RATE: new Decimal('0.04'),
  DFSP_INTEGRITY_HOLD_CEILING_CAD: new Decimal('500.00'),

  // ── Purchase Window ───────────────────────────────────────────────────────
  DFSP_PURCHASE_WINDOW_OPEN_HOUR: 11,
  DFSP_PURCHASE_WINDOW_CLOSE_HOUR: 23,

  // ── Risk Scoring ──────────────────────────────────────────────────────────
  DFSP_RISK_SCORE_GREEN_MAX: 29,
  DFSP_RISK_SCORE_AMBER_MAX: 59,

  // ── Diamond Token ─────────────────────────────────────────────────────────
  DFSP_DIAMOND_TOKEN_THRESHOLD: 10000,

  // ── OTP ───────────────────────────────────────────────────────────────────
  DFSP_OTP_TTL_SECONDS: 900,
  DFSP_OTP_MAX_ATTEMPTS: 5,
  // DFSP-001 — Module 3 PlatformOtpService. Invariant #13 carve-out: bcrypt
  // (not SHA-256) for OtpEvent.code_hash per DFSP Engineering Spec v1.0.
  // SHA-256 is GPU-brute-forceable against the constrained OTP space on DB
  // breach; bcrypt's work factor defeats that attack. Invariant #13 still
  // applies to all other hash operations in all services.
  DFSP_OTP_BCRYPT_COST: 12,

  // ── Account Recovery & Expedited Access ───────────────────────────────────
  DFSP_ACCOUNT_RECOVERY_HOLD_HOURS: 48,
  DFSP_EXPEDITED_ACCESS_MIN_PRIOR_CONTRACTS: 2,

  // ── Contract Offer ────────────────────────────────────────────────────────
  DFSP_CONTRACT_OFFER_EXPIRY_HOURS: 24,

  // ── Voice Sample (DFSP Module 5) ─────────────────────────────────────────
  DFSP_VOICE_SAMPLE_MAX_COUNT: 3,
  DFSP_VOICE_SAMPLE_RETENTION_DAYS: 2555, // 7 years — financial record standard
  DFSP_VOICE_SAMPLE_MIN_DURATION_SECONDS: 3,

  // ── PROC-001: Webhook Hardening (FIZ) ────────────────────────────────────
  // CEO-AUTHORIZED-STAGED-2026-04-10 — webhook infrastructure only.
  // No ledger writes, no balance columns, no transaction execution.
  /** Maximum allowed drift (seconds) between processor timestamp and server clock. */
  WEBHOOK_REPLAY_WINDOW_SECONDS: 300, // 5 minutes
  /** TTL (seconds) for entries in the nonce / event_id dedup stores. */
  WEBHOOK_NONCE_STORE_TTL_SECONDS: 600, // 10 minutes

  // ── Flicker n'Flame Scoring (FFS) Payout Rates (FairPay/FairPlay™) ──────────
  // LOCKED by CEO 2026-04-16. Tech Debt Delta PAY-001 through PAY-005.
  // Performance-determined in real time by Flicker n'Flame Scoring (FFS) engine.
  // These five constants are NOT operator-configurable.
  // Any change requires CEO direction + FIZ commit.

  // Payout rate when FFS score is 0–33 (Cold band)
  RATE_COLD: new Decimal('0.075'),

  // Payout rate when FFS score is 34–60 (Warm band)
  RATE_WARM: new Decimal('0.080'),

  // Payout rate when FFS score is 61–85 (Hot band)
  RATE_HOT: new Decimal('0.085'),

  // Payout rate when FFS score is 86–100 (Inferno band)
  RATE_INFERNO: new Decimal('0.090'),

  // Diamond bulk floor: 10,000+ CZT purchase floors creator payout at
  // RATE_WARM ($0.080) regardless of live FFS score.
  // If FFS score warrants a higher rate, higher rate applies.
  // Floor is a minimum, not a cap.
  // Store diamond_floor_active: bool on purchase record at issuance.
  RATE_DIAMOND_FLOOR: new Decimal('0.080'),

  // Heat score band boundaries (inclusive)
  HEAT_BAND_COLD_MAX: 33, // 0–33 = Cold
  HEAT_BAND_WARM_MAX: 60, // 34–60 = Warm
  HEAT_BAND_HOT_MAX: 85, // 61–85 = Hot
  // 86–100 = Inferno

  // ── DFSP Concierge (CONCIERGE-CONFIG-001) ─────────────────────────────────
  // Operating hours evaluated in guest billing-address timezone.
  DFSP_CONCIERGE: {
    OPEN_HOUR: 11, // 11:00 AM guest billing-address TZ
    CLOSE_HOUR: 23, // 11:00 PM guest billing-address TZ
    LAST_BOOKING_HOUR: 22, // 10:30 PM last call
    LAST_BOOKING_MINUTE: 30,
  },

  // ── BIJOU Scheduler (BJ-002) + Admission (BJ-003) + Dwell (BJ-004) ───────
  // Canonical bijou scheduling + admission + dwell constants.
  // Revisions require BIJOU: commit.
  BIJOU: {
    MAX_CAPACITY: 24,
    SESSION_DURATION_MINUTES: 60,
    SCHEDULE_SLOT_MINUTES: 15,
    MAX_SESSIONS_PER_HOUR: 2,
    // BJ-003: Admission window + camera grace.
    ADMIT_ACCEPT_WINDOW_SECONDS: 10,
    CAMERA_GRACE_SECONDS: 30,
    // BJ-004: Dwell-credit algorithm. Creator/platform split 65/35.
    DWELL_CREDIT_INTERVAL_SECONDS: 60,
    DWELL_CREDIT_PER_INTERVAL: 5,
    BIJOU_CREATOR_SPLIT: 0.65,
  },

  // ── Creator Payout Rate Tiers (Mic Drop Strategy — FIZ) ──────────────────
  // CEO-AUTHORIZED 2026-04-26.
  // REASON: Implement founding creator rate guarantee + Day 61 floor upgrade.
  // IMPACT: Controls payout floor/ceiling written to creator_rate_tiers table.
  // CORRELATION_ID: CNZ-WORK-001-CREATOR-RATE-TIER

  // Founding creators: 7.5¢ floor from Day 1.
  CREATOR_RATE_FOUNDING_FLOOR: new Decimal('0.075'),
  // Founding creators: 9¢ ceiling from Day 1.
  CREATOR_RATE_FOUNDING_CEILING: new Decimal('0.090'),
  // Standard (non-founding) creators: 6.5¢ floor until Day 61.
  CREATOR_RATE_STANDARD_FLOOR: new Decimal('0.065'),
  // Standard (non-founding) creators: 8¢ ceiling until Day 61.
  CREATOR_RATE_STANDARD_CEILING: new Decimal('0.080'),
  // After Day 61, all creators share the founding floor/ceiling.
  CREATOR_RATE_DAY61_FLOOR: new Decimal('0.075'),
  CREATOR_RATE_DAY61_CEILING: new Decimal('0.090'),
  // Day 61 is the number of days after platform launch when the rate upgrade fires.
  CREATOR_RATE_DAY61_THRESHOLD: 61,

  // ── VelocityZone Payout Interpolation (FIZ) ──────────────────────────────
  // FFS score 0 → rate_floor_usd; FFS score 100 → rate_ceil_usd.
  // Per-event floor/ceiling are stored in velocityzone_events table.
  // The canonical default limits (operator may not exceed these via admin UI).
  VELOCITYZONE_RATE_FLOOR_MIN: new Decimal('0.075'),
  VELOCITYZONE_RATE_CEIL_MAX:  new Decimal('0.090'),
} as const;
