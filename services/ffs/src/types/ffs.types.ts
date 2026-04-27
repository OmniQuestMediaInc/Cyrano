// FFS — Flicker n'Flame Scoring: canonical types
// Business Plan B.4 — real-time composite heat score (0-100) for all room-level telemetry.
// Rule authority: FFS_ENGINE_v1 — see DOMAIN_GLOSSARY.md (Flicker n'Flame Scoring).

// ── Tier thresholds (canonical — locked in GovernanceConfig.HEAT_BAND_*)
// COLD 0-33 / WARM 34-60 / HOT 61-85 / INFERNO 86-100
export type FfsTier = 'COLD' | 'WARM' | 'HOT' | 'INFERNO';

export type LeaderboardCategory =
  | 'all'
  | 'standard'
  | 'dual_flame'
  | 'hot_and_ready'
  | 'new_flames';

// ── Full input frame — all signals fed into the composite score ───────────────
export interface FfsInput {
  // Identity
  session_id: string;
  creator_id: string;
  captured_at_utc: string;

  // ── Group 1: Financial / Social Engagement ─────────────────────────────────
  /** Total tips received in this session (cumulative). */
  tips_in_session: number;
  /** Rolling 60 s tip rate (tips/min). */
  tips_per_min: number;
  /** Rolling 60 s mean tip size (CZT tokens). */
  avg_tip_tokens: number;
  /** Messages/min in last 60 s. */
  chat_velocity_per_min: number;
  /** ❤️ reactions/min in last 60 s. */
  heart_reactions_per_min: number;
  /** Count of viewers in private or spy mode. */
  private_spy_count: number;
  /** Session runtime in minutes. */
  dwell_minutes: number;

  // ── Group 2: Biometric Signals (SenSync™ + vision-monitor) ────────────────
  /** Current BPM from SenSync™ wearable. 0 = signal absent / not paired. */
  heart_rate_bpm: number;
  /** Creator's individual resting baseline BPM (from calibration). */
  heart_rate_baseline_bpm: number;
  /** Gaze engagement score 0-1 from eye tracking hardware. */
  eye_tracking_score: number;
  /** Excitement level 0-1 derived from facial expression model. */
  facial_excitement_score: number;
  /** Optional SenSync™ BPM contribution (opt-in only; undefined if not consented or device unpaired). */
  sensync_bpm?: number;
  /**
   * Phase 3 — SenSync™ FFS quality boost in [10..25] points. Added directly to
   * the composite score on top of the heart_rate component when present.
   * Undefined when SenSync is not consented (BPM_TO_FFS scope) or unpaired.
   */
  sensync_boost_points?: number;

  // ── Group 3: Content / Behavioral Signals ─────────────────────────────────
  /** Content exposure level 0-1 (derived from vision-monitor). Advisory only. */
  skin_exposure_score: number;
  /** Movement intensity 0-1 from motion detection. */
  motion_score: number;
  /** Ratio 0-1 of vocal content vs background music (1 = fully vocal). */
  audio_vocal_ratio: number;

  // ── Group 4: Session Momentum ─────────────────────────────────────────────
  /** Heat score delta over the last 5 minutes. Range: -100..+100. */
  heat_trend_5min: number;
  /** Consecutive ticks where tier was WARM or above. */
  hot_streak_ticks: number;

  // ── Dual Flame ─────────────────────────────────────────────────────────────
  /** Whether this session is a Dual Flame paired broadcast. */
  is_dual_flame: boolean;
  /** Partner's current FFS score (0-100). Undefined if not dual flame. */
  dual_flame_partner_score?: number;
}

// ── Per-component breakdown ────────────────────────────────────────────────────
export interface FfsScoreComponents {
  /** Tip pressure — max 15. */
  tip_pressure: number;
  /** Chat velocity — max 8. */
  chat_velocity: number;
  /** Session dwell — max 5. */
  dwell: number;
  /** Heart reactions — max 8. */
  hearts: number;
  /** Private/spy viewer count — max 5. */
  private_spying: number;
  /** Heart rate elevation above baseline — max 12. */
  heart_rate: number;
  /** Eye-tracking engagement — max 6. */
  eye_tracking: number;
  /** Facial excitement — max 7. */
  facial_excitement: number;
  /** Skin exposure (advisory) — max 5. */
  skin_exposure: number;
  /** Motion intensity — max 5. */
  motion: number;
  /** Vocal audio ratio — max 5. */
  audio_vocal: number;
  /** 5-min momentum — max 10. */
  momentum: number;
  /** Hot streak bonus — max 9. */
  hot_streak: number;
}

// ── Full FFS score output ─────────────────────────────────────────────────────
export interface FfsScore {
  session_id: string;
  creator_id: string;
  /** Composite score 0-100 after anti-flicker and guardrails. */
  ffs_score: number;
  /** Resolved tier (anti-flicker applied). */
  ffs_tier: FfsTier;
  components: FfsScoreComponents;
  /** Per-creator learned multiplier — default 1.0, range 0.80-1.20. */
  adaptive_multiplier: number;
  /** Tier being evaluated for the 3-tick anti-flicker rule. */
  anti_flicker_pending_tier: FfsTier | null;
  /** Consecutive ticks consistent with the pending tier (0-2 before promotion). */
  anti_flicker_ticks: number;
  is_dual_flame: boolean;
  captured_at_utc: string;
  rule_applied_id: string;
}

// ── Leaderboard ───────────────────────────────────────────────────────────────
export interface LeaderboardEntry {
  session_id: string;
  creator_id: string;
  ffs_score: number;
  ffs_tier: FfsTier;
  /** 0-indexed rank in the filtered set. Rank 0 = coolest (lowest score). */
  rank: number;
  /** Row in the 10×10 grid. Row 0 = top row (coolest). */
  grid_row: number;
  /** Column in the 10×10 grid. */
  grid_col: number;
  is_dual_flame: boolean;
  is_hot_and_ready: boolean;
  is_new_flame: boolean;
  session_started_at: string;
}

export interface FfsLeaderboard {
  entries: LeaderboardEntry[];
  total: number;
  generated_at_utc: string;
  rule_applied_id: string;
}

// ── Adaptive weights (per-creator learned multipliers) ────────────────────────
export interface AdaptiveWeights {
  creator_id: string;
  /** Multiplier per component key — range 0.80-1.20, default 1.0. */
  weights: Record<string, number>;
  tip_events_seen: number;
  last_updated_at: string;
}

// ── In-memory session state ───────────────────────────────────────────────────
export interface SessionLiveState {
  currentScore: FfsScore;
  sessionStartedAt: Date;
  isDualFlame: boolean;
}

// ── Anti-flicker state (per session) ─────────────────────────────────────────
export interface AntiFlickerState {
  confirmedTier: FfsTier;
  pendingTier: FfsTier;
  /** Ticks elapsed since pendingTier was first seen. Resets on confirm. */
  ticks: number;
}

// ── SenSync™ FFS boost (additive — separate from heart_rate component) ───────
// Applied only when consent is active AND `sensync_bpm` is present on the
// input frame. Floor expresses "presence reward" for being on the SenSync
// rail at all; ceiling tracks HR elevation above the creator's baseline.
// The boost is added after the existing component sum (and after early-phase /
// dual-flame bonuses) and before the final clamp to 0–100.
export const SENSYNC_FFS_BOOST_MIN = 10;
export const SENSYNC_FFS_BOOST_MAX = 25;
