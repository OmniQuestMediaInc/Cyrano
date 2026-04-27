// CRM: Fan Fervor Score (FFS) — per-guest engagement score
// Business Plan §B.4 — guest intelligence layer.
//
// Outputs ffs_score (0–100) and ffs_tier (COLD/WARM/HOT/INFERNO).
// Formula: configurable weighted sum of engagement signals.
// SenSync™ (HeartSync biometric relay, canonical code identifier: HeartSync)
//   adds +10–25 points when the guest has granted biometric consent.
// Consumers: payout engine, UI effects, Cyrano, GateGuard Welfare Score,
//   VelocityZone.

// ── Tiers (mirror room-heat canonical thresholds) ─────────────────────────────
// COLD 0-33 / WARM 34-60 / HOT 61-85 / INFERNO 86-100

export type FfsTier = 'COLD' | 'WARM' | 'HOT' | 'INFERNO';

// ── FFS input frame ───────────────────────────────────────────────────────────

export interface FfsInput {
  // Identity
  guest_id: string;
  session_id: string;
  captured_at_utc: string;

  // ── Group 1: Tip engagement ───────────────────────────────────────────────
  /** Cumulative tips placed by this guest in the session (CZT tokens). */
  tips_czt_in_session: number;
  /** Rolling 60 s tip rate (tips/min). */
  tip_velocity_per_min: number;

  // ── Group 2: Social engagement ─────────────────────────────────────────────
  /** Messages sent by the guest in the session. */
  chat_messages_in_session: number;
  /** ❤️ reactions sent by the guest in the session. */
  heart_reactions_in_session: number;

  // ── Group 3: Session depth ─────────────────────────────────────────────────
  /** Session runtime in minutes. */
  dwell_minutes: number;
  /** Count of private/exclusive mode requests initiated by this guest. */
  private_request_count: number;

  // ── Group 4: Long-term loyalty baseline ───────────────────────────────────
  /** Whale score 0–100 from the guest's latest WhaleProfile. 0 if unavailable. */
  whale_score: number;

  // ── Group 5: SenSync™ / HeartSync biometric ───────────────────────────────
  /** Guest has granted explicit HeartSync biometric consent for this session. */
  heartsync_opted_in: boolean;
  /** Current BPM from HeartSync band. 0 if signal absent or not opted in. */
  heartsync_bpm: number;
  /** Guest's resting baseline BPM from calibration. 0 if unavailable. */
  heartsync_baseline_bpm: number;

  // ── Audit ─────────────────────────────────────────────────────────────────
  correlation_id: string;
}

// ── FFS result ────────────────────────────────────────────────────────────────

export interface FfsResult {
  ffs_id: string;
  guest_id: string;
  session_id: string;
  /** Composite Fan Fervor Score 0–100. */
  ffs_score: number;
  /** Resolved tier. */
  ffs_tier: FfsTier;
  /** Raw base score before SenSync™ boost (0–100). */
  base_score: number;
  /** Points added by the SenSync™/HeartSync boost (0 if not opted in). */
  heartsync_boost: number;
  correlation_id: string;
  rule_applied_id: string;
  scored_at_utc: string;
}

// ── Weight ceilings — configurable; must sum to 100 ──────────────────────────
// These ceilings define the maximum BASE score (0–100).
// The SenSync™/HeartSync boost (+10–25 pts) is additive on top of the base
// score; the final ffs_score is clamped to 0–100 in the service layer.
// Changing these is a governance event (bump FFS_RULE_ID).

export const FFS_WEIGHT_CEILINGS = {
  /** Cumulative session tip volume (CZT). Max 25 pts. */
  tips_czt:         25,
  /** Rolling tip velocity (tips/min). Max 20 pts. */
  tip_velocity:     20,
  /** Chat messages + heart reactions combined. Max 15 pts. */
  chat_engagement:  15,
  /** Session dwell depth. Max 5 pts. */
  dwell:             5,
  /** Private/exclusive request count. Max 10 pts. */
  private_requests: 10,
  /** Long-term whale score baseline. Max 25 pts. */
  whale_score:      25,
} as const;  // intentional: sum = 100

// ── Normalisation reference maxima (linear: value / max × ceiling) ────────────

export const FFS_INPUT_MAX = {
  tips_czt_in_session:       500,   // 500 CZT = full tip pressure
  tip_velocity_per_min:        2,   // ≥2 tips/min = full velocity
  chat_messages_in_session:   30,   // ≥30 messages = full chat signal
  heart_reactions_in_session:  10,  // ≥10 reactions = full engagement
  dwell_minutes:               60,  // ≥60 min = full dwell
  private_request_count:        5,  // ≥5 requests = full private signal
  heartsync_bpm_delta:         40,  // ≥40 BPM above baseline = max boost
} as const;

// ── SenSync™ / HeartSync boost bounds ────────────────────────────────────────

export const FFS_HEARTSYNC_BOOST_MIN =  10;  // pts — any elevation when opted in
export const FFS_HEARTSYNC_BOOST_MAX =  25;  // pts — maximum at full BPM elevation

// ── Tier thresholds (canonical — mirrors room-heat DOMAIN_GLOSSARY.md) ────────

export const FFS_TIER_THRESHOLDS: ReadonlyArray<{ min: number; tier: FfsTier }> = [
  { min: 86, tier: 'INFERNO' },
  { min: 61, tier: 'HOT' },
  { min: 34, tier: 'WARM' },
  { min:  0, tier: 'COLD' },
];

// ── Rule ID ───────────────────────────────────────────────────────────────────

export const FFS_RULE_ID = 'FAN_FERVOR_SCORE_v1';
