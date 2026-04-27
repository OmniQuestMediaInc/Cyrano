// FFS — Flicker n'Flame Scoring Engine: core service
// Business Plan B.4 — real-time composite FFS score (0-100) emitted via NATS every 5–10 seconds.
//
// Doctrine:
//   - Deterministic. Same inputs → same raw score. Adaptive weights are the
//     only source of per-creator variance.
//   - Anti-flicker (3-tick rule): tier transitions take effect only after
//     three consecutive ticks agree on the new tier.
//   - Early-phase generosity: 10 % boost for the first five minutes.
//   - Adaptive learning: component multipliers shift ±2 %/−0.5 % per tip event.
//   - Guardrails: score is clamped to 0-100; multipliers to 0.80-1.20.
//   - Leaderboard: 10×10 grid, coolest slot at top (index 0).
//   - Dual Flame: partner score contributes up to 5 bonus pts.
//   - No ledger or payment mutations. No PII logged.
//   - SenSync™ BPM takes precedence over heart_rate_bpm when consent is granted and device is paired.

import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { GovernanceConfig } from '../../core-api/src/governance/governance.config';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { PrismaService } from '../../core-api/src/prisma.service';
import { NATS_TOPICS } from '../../nats/topics.registry';
import {
  SENSYNC_FFS_BOOST_MAX,
  SENSYNC_FFS_BOOST_MIN,
} from './types/ffs.types';
import type {
  AdaptiveWeights,
  AntiFlickerState,
  FfsInput,
  FfsLeaderboard,
  FfsScore,
  FfsScoreComponents,
  FfsTier,
  LeaderboardCategory,
  SessionLiveState,
} from './types/ffs.types';

export const FFS_RULE_ID = 'FFS_ENGINE_v1';

// ── Tier thresholds — derived from GovernanceConfig.HEAT_BAND_* canonical constants ──
// See governance.config.ts. Do NOT hardcode these values here.
const TIER_THRESHOLDS: ReadonlyArray<{ min: number; tier: FfsTier }> = [
  { min: GovernanceConfig.HEAT_BAND_HOT_MAX + 1, tier: 'INFERNO' },
  { min: GovernanceConfig.HEAT_BAND_WARM_MAX + 1, tier: 'HOT' },
  { min: GovernanceConfig.HEAT_BAND_COLD_MAX + 1, tier: 'WARM' },
  { min: 0, tier: 'COLD' },
];

// ── Component weight ceilings (sum of all ceilings = 100) ────────────────────
const WEIGHT_CEILINGS = {
  tip_pressure:      15,
  chat_velocity:      8,
  dwell:              5,
  hearts:             8,
  private_spying:     5,
  heart_rate:        12,
  eye_tracking:       6,
  facial_excitement:  7,
  skin_exposure:      5,
  motion:             5,
  audio_vocal:        5,
  momentum:          10,
  hot_streak:         9,
} as const;

// ── Normalisation reference maxima ────────────────────────────────────────────
const INPUT_MAX = {
  tips_per_min:            2,
  chat_velocity_per_min:  30,
  dwell_minutes:          60,
  heart_reactions_per_min: 10,
  private_spy_count:      10,
  hr_delta_bpm:           40,
  heat_trend_5min:        50,
  hot_streak_ticks:       10,
} as const;

// ── Anti-flicker: ticks required before a tier transition is confirmed ────────
const ANTI_FLICKER_TICKS_REQUIRED = 3;

// ── Early-phase generosity ────────────────────────────────────────────────────
const EARLY_PHASE_MINUTES = 5;
const EARLY_PHASE_BOOST   = 1.10;

// ── Dual Flame: max bonus points contributed by partner score ─────────────────
const DUAL_FLAME_PARTNER_MAX_BONUS = 5;

// ── Phase 3: SenSync™ FFS boost. Bounded to the documented [10..25] range. ────
const SENSYNC_BOOST_MIN = 10;
const SENSYNC_BOOST_MAX = 25;

// ── Hot-and-Ready / New-Flames thresholds ─────────────────────────────────────
const HOT_AND_READY_MIN_SCORE = 70;
const HOT_AND_READY_MIN_DWELL = 10;
const NEW_FLAMES_MAX_DWELL    = 15;

// ── Leaderboard grid dimensions ───────────────────────────────────────────────
const LEADERBOARD_GRID_SIZE = 100; // 10 × 10

// ── Adaptive weight defaults and guard rails ──────────────────────────────────
const ADAPTIVE_DEFAULT_WEIGHT = 1.0;
const ADAPTIVE_MIN            = 0.80;
const ADAPTIVE_MAX            = 1.20;
const ADAPTIVE_BOOST_ON_TIP   = 0.02;
const ADAPTIVE_DECAY_ON_TIP   = 0.005;
const ADAPTIVE_ELEVATION_THRESHOLD = 0.70;

@Injectable()
export class FfsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FfsService.name);

  private readonly antiFlicker   = new Map<string, AntiFlickerState>();
  private readonly sessionState  = new Map<string, SessionLiveState>();
  private readonly adaptiveCache = new Map<string, Record<string, number>>();
  private readonly ffsIntervals  = new Map<string, NodeJS.Timeout>();
  private readonly lastInput     = new Map<string, FfsInput>();
  private readonly tickCounters  = new Map<string, number>();
  /** Emit leaderboard broadcast every N ticks (default: every 10 s at 1 Hz). */
  private static readonly LEADERBOARD_EMIT_EVERY_TICKS = 10;

  constructor(
    private readonly nats: NatsService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.subscribeNatsEvents();
    this.logger.log('FfsService: initialised', { rule_applied_id: FFS_RULE_ID });
  }

  onModuleDestroy(): void {
    for (const interval of this.ffsIntervals.values()) {
      clearInterval(interval);
    }
    this.ffsIntervals.clear();
    this.logger.log('FfsService: destroyed — all intervals cleared');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Ingest a telemetry frame.
   * Calculates the FFS score, updates in-memory state, emits NATS events,
   * persists a snapshot (async), and arms the 1 Hz publisher for the session.
   */
  ingest(input: FfsInput): FfsScore {
    const score = this.calculateFfsScore(input);

    this.lastInput.set(input.session_id, input);
    this.emitScoreEvents(score, input);
    this.updateSessionState(input, score);
    void this.persistSnapshot(score, input);
    this.ensureInterval(input.session_id);

    return score;
  }

  /**
   * Pure computation — calculates FFS score without side effects.
   * Same inputs always produce the same raw score.
   */
  calculateFfsScore(input: FfsInput): FfsScore {
    const adaptiveWeights = this.getAdaptiveWeights(input.creator_id);
    const components      = this.calculateComponents(input, adaptiveWeights);

    let rawScore = (Object.values(components) as number[]).reduce(
      (acc: number, v: number) => acc + v,
      0,
    );

    if (input.dwell_minutes < EARLY_PHASE_MINUTES) {
      rawScore *= EARLY_PHASE_BOOST;
    }

    if (input.is_dual_flame && input.dual_flame_partner_score !== undefined) {
      const partnerBonus =
        (Math.min(100, Math.max(0, input.dual_flame_partner_score)) / 100) *
        DUAL_FLAME_PARTNER_MAX_BONUS;
      rawScore += partnerBonus;
    }

    // SenSync™ optional boost — additive, separate from the 12-pt heart_rate
    // component. Gated on `sensync_bpm !== undefined`; consent revocation is
    // honoured by clearing `sensync_bpm` on the SENSYNC_CONSENT_REVOKED event
    // (see subscribeNatsEvents). Formula: linear scale on HR-delta vs. the
    // creator's calibrated baseline, normalised to INPUT_MAX.hr_delta_bpm.
    //   boost = MIN + clamp01(hrDelta / 40) * (MAX - MIN)
    //   sensync_bpm at baseline (delta 0)   → +10 (presence floor)
    //   sensync_bpm at baseline + 40 BPM    → +25 (ceiling)
    if (input.sensync_bpm !== undefined) {
      const hrDelta = Math.max(0, input.sensync_bpm - input.heart_rate_baseline_bpm);
      const t = this.norm(hrDelta, INPUT_MAX.hr_delta_bpm);
      const boost =
        SENSYNC_FFS_BOOST_MIN + t * (SENSYNC_FFS_BOOST_MAX - SENSYNC_FFS_BOOST_MIN);
      rawScore += boost;
    }

    // Phase 3 — SenSync™ FFS boost. Applied only when the BPM_TO_FFS scope is
    // active upstream (the SenSync service refuses to publish to
    // SENSYNC_BPM_UPDATE without it, so by the time `sensync_boost_points` is
    // populated here, consent has already been validated).
    if (
      typeof input.sensync_boost_points === 'number' &&
      Number.isFinite(input.sensync_boost_points)
    ) {
      const clamped = Math.max(
        SENSYNC_BOOST_MIN,
        Math.min(SENSYNC_BOOST_MAX, input.sensync_boost_points),
      );
      rawScore += clamped;
    }

    const ffsScore = Math.min(100, Math.max(0, Math.round(rawScore)));
    const { tier, pendingTier, ticks } = this.resolveAntiFlickerTier(
      input.session_id,
      ffsScore,
    );

    const adaptiveMultiplier = this.computeAdaptiveMultiplier(adaptiveWeights);

    return {
      session_id:              input.session_id,
      creator_id:              input.creator_id,
      ffs_score:               ffsScore,
      ffs_tier:                tier,
      components,
      adaptive_multiplier:     adaptiveMultiplier,
      anti_flicker_pending_tier: pendingTier,
      anti_flicker_ticks:      ticks,
      is_dual_flame:           input.is_dual_flame,
      captured_at_utc:         input.captured_at_utc,
      rule_applied_id:         FFS_RULE_ID,
    };
  }

  /** Called by tip service when a tip event fires — updates adaptive weights. */
  learnFromTipEvent(input: FfsInput): void {
    const weights = this.getAdaptiveWeights(input.creator_id);
    const elevated = this.identifyElevatedSignals(input);

    let changed = false;
    for (const key of Object.keys(weights)) {
      const prev = weights[key];
      if (elevated.includes(key)) {
        weights[key] = +(
          Math.min(ADAPTIVE_MAX, weights[key] + ADAPTIVE_BOOST_ON_TIP)
        ).toFixed(4);
      } else {
        weights[key] = +(
          Math.max(ADAPTIVE_MIN, weights[key] - ADAPTIVE_DECAY_ON_TIP)
        ).toFixed(4);
      }
      if (weights[key] !== prev) changed = true;
    }

    if (changed) {
      this.adaptiveCache.set(input.creator_id, weights);
      void this.persistAdaptiveWeights(input.creator_id, weights);
      this.nats.publish(NATS_TOPICS.FFS_ADAPTIVE_UPDATED, {
        creator_id:       input.creator_id,
        elevated,
        weights_snapshot: weights,
        rule_applied_id:  FFS_RULE_ID,
        updated_at_utc:   new Date().toISOString(),
      });
    }
  }

  /** Returns the current FFS score for a session, or null if unknown. */
  getSessionScore(sessionId: string): FfsScore | null {
    return this.sessionState.get(sessionId)?.currentScore ?? null;
  }

  /**
   * Returns the leaderboard for the requested category.
   * Grid: 10×10, coolest session at rank 0 (top-left), hottest at rank 99.
   */
  getLeaderboard(category: LeaderboardCategory = 'all'): FfsLeaderboard {
    const now   = new Date();
    const nowMs = now.getTime();
    const states = [...this.sessionState.entries()];

    const filtered = states.filter(([, state]) => {
      const dwellMs = nowMs - state.sessionStartedAt.getTime();
      const dwell   = dwellMs / 60_000;
      const s       = state.currentScore.ffs_score;

      switch (category) {
        case 'dual_flame':    return state.isDualFlame;
        case 'hot_and_ready': return s >= HOT_AND_READY_MIN_SCORE && dwell >= HOT_AND_READY_MIN_DWELL;
        case 'new_flames':    return dwell < NEW_FLAMES_MAX_DWELL;
        case 'standard':      return !state.isDualFlame;
        default:              return true;
      }
    });

    filtered.sort(([, a], [, b]) => a.currentScore.ffs_score - b.currentScore.ffs_score);

    const grid = filtered.slice(0, LEADERBOARD_GRID_SIZE);

    const entries = grid.map(([sessionId, state], index) => {
      const dwellMs = nowMs - state.sessionStartedAt.getTime();
      const dwell   = dwellMs / 60_000;
      const s       = state.currentScore.ffs_score;
      return {
        session_id:        sessionId,
        creator_id:        state.currentScore.creator_id,
        ffs_score:         s,
        ffs_tier:          state.currentScore.ffs_tier,
        rank:              index,
        grid_row:          Math.floor(index / 10),
        grid_col:          index % 10,
        is_dual_flame:     state.isDualFlame,
        is_hot_and_ready:  s >= HOT_AND_READY_MIN_SCORE && dwell >= HOT_AND_READY_MIN_DWELL,
        is_new_flame:      dwell < NEW_FLAMES_MAX_DWELL,
        session_started_at: state.sessionStartedAt.toISOString(),
      };
    });

    return {
      entries,
      total:             filtered.length,
      generated_at_utc:  now.toISOString(),
      rule_applied_id:   FFS_RULE_ID,
    };
  }

  /**
   * Register a session start. Arms the 1 Hz publisher.
   */
  startSession(sessionId: string, creatorId: string, isDualFlame: boolean): void {
    if (!this.sessionState.has(sessionId)) {
      const now     = new Date();
      const initial: FfsScore = {
        session_id:               sessionId,
        creator_id:               creatorId,
        ffs_score:                0,
        ffs_tier:                 'COLD',
        components:               this.zeroComponents(),
        adaptive_multiplier:      1.0,
        anti_flicker_pending_tier: null,
        anti_flicker_ticks:       0,
        is_dual_flame:            isDualFlame,
        captured_at_utc:          now.toISOString(),
        rule_applied_id:          FFS_RULE_ID,
      };
      this.sessionState.set(sessionId, {
        currentScore:     initial,
        sessionStartedAt: now,
        isDualFlame,
      });
    }
    this.nats.publish(NATS_TOPICS.FFS_SESSION_STARTED, {
      session_id:      sessionId,
      creator_id:      creatorId,
      is_dual_flame:   isDualFlame,
      rule_applied_id: FFS_RULE_ID,
      started_at_utc:  new Date().toISOString(),
    });
  }

  /**
   * Tear down session state and stop the 1 Hz publisher for this session.
   */
  endSession(sessionId: string): void {
    this.clearInterval(sessionId);
    const state = this.sessionState.get(sessionId);
    this.sessionState.delete(sessionId);
    this.antiFlicker.delete(sessionId);
    this.lastInput.delete(sessionId);

    this.nats.publish(NATS_TOPICS.FFS_SESSION_ENDED, {
      session_id:      sessionId,
      creator_id:      state?.currentScore.creator_id ?? null,
      final_ffs_score: state?.currentScore.ffs_score ?? 0,
      final_ffs_tier:  state?.currentScore.ffs_tier ?? 'COLD',
      rule_applied_id: FFS_RULE_ID,
      ended_at_utc:    new Date().toISOString(),
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRIVATE — SCORING INTERNALS
  // ══════════════════════════════════════════════════════════════════════════

  private norm(value: number, max: number): number {
    if (max <= 0) return 0;
    return Math.min(1, Math.max(0, value / max));
  }

  private calculateComponents(
    input: FfsInput,
    weights: Record<string, number>,
  ): FfsScoreComponents {
    const w = (key: string): number => weights[key] ?? ADAPTIVE_DEFAULT_WEIGHT;

    const tip_pressure = Math.min(
      WEIGHT_CEILINGS.tip_pressure,
      this.norm(input.tips_per_min, INPUT_MAX.tips_per_min) *
        WEIGHT_CEILINGS.tip_pressure * w('tip_pressure'),
    );

    const chat_velocity = Math.min(
      WEIGHT_CEILINGS.chat_velocity,
      this.norm(input.chat_velocity_per_min, INPUT_MAX.chat_velocity_per_min) *
        WEIGHT_CEILINGS.chat_velocity * w('chat_velocity'),
    );

    const dwell = Math.min(
      WEIGHT_CEILINGS.dwell,
      this.norm(input.dwell_minutes, INPUT_MAX.dwell_minutes) *
        WEIGHT_CEILINGS.dwell * w('dwell'),
    );

    const hearts = Math.min(
      WEIGHT_CEILINGS.hearts,
      this.norm(input.heart_reactions_per_min, INPUT_MAX.heart_reactions_per_min) *
        WEIGHT_CEILINGS.hearts * w('hearts'),
    );

    const private_spying = Math.min(
      WEIGHT_CEILINGS.private_spying,
      this.norm(input.private_spy_count, INPUT_MAX.private_spy_count) *
        WEIGHT_CEILINGS.private_spying * w('private_spying'),
    );

    // SenSync™ BPM takes precedence when available; falls back to heart_rate_bpm otherwise.
    const effectiveBpm = input.sensync_bpm ?? input.heart_rate_bpm;
    const hrDelta = Math.max(0, effectiveBpm - input.heart_rate_baseline_bpm);
    const heart_rate = Math.min(
      WEIGHT_CEILINGS.heart_rate,
      this.norm(hrDelta, INPUT_MAX.hr_delta_bpm) *
        WEIGHT_CEILINGS.heart_rate * w('heart_rate'),
    );

    const eye_tracking = Math.min(
      WEIGHT_CEILINGS.eye_tracking,
      Math.min(1, Math.max(0, input.eye_tracking_score)) *
        WEIGHT_CEILINGS.eye_tracking * w('eye_tracking'),
    );

    const facial_excitement = Math.min(
      WEIGHT_CEILINGS.facial_excitement,
      Math.min(1, Math.max(0, input.facial_excitement_score)) *
        WEIGHT_CEILINGS.facial_excitement * w('facial_excitement'),
    );

    const skin_exposure = Math.min(
      WEIGHT_CEILINGS.skin_exposure,
      Math.min(1, Math.max(0, input.skin_exposure_score)) *
        WEIGHT_CEILINGS.skin_exposure * w('skin_exposure'),
    );

    const motion = Math.min(
      WEIGHT_CEILINGS.motion,
      Math.min(1, Math.max(0, input.motion_score)) *
        WEIGHT_CEILINGS.motion * w('motion'),
    );

    const audio_vocal = Math.min(
      WEIGHT_CEILINGS.audio_vocal,
      Math.min(1, Math.max(0, input.audio_vocal_ratio)) *
        WEIGHT_CEILINGS.audio_vocal * w('audio_vocal'),
    );

    const momentumRaw = Math.max(0, input.heat_trend_5min);
    const momentum = Math.min(
      WEIGHT_CEILINGS.momentum,
      this.norm(momentumRaw, INPUT_MAX.heat_trend_5min) * WEIGHT_CEILINGS.momentum,
    );

    const hot_streak = Math.min(
      WEIGHT_CEILINGS.hot_streak,
      this.norm(input.hot_streak_ticks, INPUT_MAX.hot_streak_ticks) *
        WEIGHT_CEILINGS.hot_streak * w('hot_streak'),
    );

    const round2 = (n: number): number => Math.round(n * 100) / 100;

    return {
      tip_pressure:      round2(tip_pressure),
      chat_velocity:     round2(chat_velocity),
      dwell:             round2(dwell),
      hearts:            round2(hearts),
      private_spying:    round2(private_spying),
      heart_rate:        round2(heart_rate),
      eye_tracking:      round2(eye_tracking),
      facial_excitement: round2(facial_excitement),
      skin_exposure:     round2(skin_exposure),
      motion:            round2(motion),
      audio_vocal:       round2(audio_vocal),
      momentum:          round2(momentum),
      hot_streak:        round2(hot_streak),
    };
  }

  private resolveAntiFlickerTier(
    sessionId: string,
    score: number,
  ): { tier: FfsTier; pendingTier: FfsTier | null; ticks: number } {
    const rawTier = this.scoreToBand(score);

    let state = this.antiFlicker.get(sessionId);
    if (!state) {
      state = { confirmedTier: rawTier, pendingTier: rawTier, ticks: 0 };
      this.antiFlicker.set(sessionId, state);
      return { tier: rawTier, pendingTier: null, ticks: 0 };
    }

    if (rawTier === state.confirmedTier) {
      state.pendingTier = rawTier;
      state.ticks       = 0;
      this.antiFlicker.set(sessionId, state);
      return { tier: state.confirmedTier, pendingTier: null, ticks: 0 };
    }

    if (rawTier === state.pendingTier) {
      state.ticks += 1;
      if (state.ticks >= ANTI_FLICKER_TICKS_REQUIRED) {
        const promoted = state.pendingTier;
        state.confirmedTier = promoted;
        state.ticks         = 0;
        this.antiFlicker.set(sessionId, state);
        return { tier: promoted, pendingTier: null, ticks: 0 };
      }
    } else {
      state.pendingTier = rawTier;
      state.ticks       = 1;
    }

    this.antiFlicker.set(sessionId, state);
    return {
      tier:        state.confirmedTier,
      pendingTier: state.pendingTier,
      ticks:       state.ticks,
    };
  }

  private scoreToBand(score: number): FfsTier {
    for (const band of TIER_THRESHOLDS) {
      if (score >= band.min) return band.tier;
    }
    return 'COLD';
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRIVATE — ADAPTIVE WEIGHTS
  // ══════════════════════════════════════════════════════════════════════════

  private defaultAdaptiveWeights(): Record<string, number> {
    return Object.fromEntries(
      Object.keys(WEIGHT_CEILINGS).map((k) => [k, ADAPTIVE_DEFAULT_WEIGHT]),
    );
  }

  private getAdaptiveWeights(creatorId: string): Record<string, number> {
    if (this.adaptiveCache.has(creatorId)) {
      return { ...this.adaptiveCache.get(creatorId)! };
    }
    const defaults = this.defaultAdaptiveWeights();
    this.adaptiveCache.set(creatorId, defaults);
    void this.loadAdaptiveWeightsFromDb(creatorId);
    return { ...defaults };
  }

  private computeAdaptiveMultiplier(weights: Record<string, number>): number {
    const vals = Object.values(weights);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    return Math.round(mean * 10000) / 10000;
  }

  private identifyElevatedSignals(input: FfsInput): string[] {
    const elevated: string[] = [];
    const T = ADAPTIVE_ELEVATION_THRESHOLD;

    if (input.tips_per_min / INPUT_MAX.tips_per_min >= T)                       elevated.push('tip_pressure');
    if (input.chat_velocity_per_min / INPUT_MAX.chat_velocity_per_min >= T)     elevated.push('chat_velocity');
    if (input.heart_reactions_per_min / INPUT_MAX.heart_reactions_per_min >= T) elevated.push('hearts');
    if (input.private_spy_count / INPUT_MAX.private_spy_count >= T)             elevated.push('private_spying');
    const effectiveBpm = input.sensync_bpm ?? input.heart_rate_bpm;
    const hrDelta = Math.max(0, effectiveBpm - input.heart_rate_baseline_bpm);
    if (hrDelta / INPUT_MAX.hr_delta_bpm >= T)                                  elevated.push('heart_rate');
    if (input.eye_tracking_score >= T)                                           elevated.push('eye_tracking');
    if (input.facial_excitement_score >= T)                                      elevated.push('facial_excitement');
    if (input.skin_exposure_score >= T)                                          elevated.push('skin_exposure');
    if (input.motion_score >= T)                                                 elevated.push('motion');
    if (input.audio_vocal_ratio >= T)                                            elevated.push('audio_vocal');
    if (input.hot_streak_ticks / INPUT_MAX.hot_streak_ticks >= T)               elevated.push('hot_streak');

    return elevated;
  }

  private async loadAdaptiveWeightsFromDb(creatorId: string): Promise<void> {
    try {
      const row = await this.prisma.ffsAdaptiveWeights.findUnique({
        where: { creator_id: creatorId },
      });
      if (row) {
        const loaded   = row.weights as Record<string, number>;
        const defaults = this.defaultAdaptiveWeights();
        const merged: Record<string, number> = {};
        for (const key of Object.keys(defaults)) {
          merged[key] =
            typeof loaded[key] === 'number' ? loaded[key] : defaults[key];
        }
        this.adaptiveCache.set(creatorId, merged);
      }
    } catch (err) {
      this.logger.warn('FfsService: adaptive weights DB load failed', {
        creator_id: creatorId,
        error:      String(err),
      });
    }
  }

  private async persistAdaptiveWeights(
    creatorId: string,
    weights: Record<string, number>,
  ): Promise<void> {
    try {
      const existing = await this.prisma.ffsAdaptiveWeights.findUnique({
        where: { creator_id: creatorId },
      });

      if (existing) {
        await this.prisma.ffsAdaptiveWeights.update({
          where: { creator_id: creatorId },
          data: {
            weights,
            tip_events_seen: { increment: 1 },
            last_updated_at: new Date(),
          },
        });
      } else {
        await this.prisma.ffsAdaptiveWeights.create({
          data: {
            creator_id:      creatorId,
            weights,
            tip_events_seen: 1,
            correlation_id:  `ffs-adaptive-init-${creatorId}-${Date.now()}`,
            reason_code:     'FFS_ADAPTIVE_INIT',
            rule_applied_id: FFS_RULE_ID,
          },
        });
      }
    } catch (err) {
      this.logger.error('FfsService: adaptive weights persist failed', err, {
        creator_id: creatorId,
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRIVATE — SESSION STATE & NATS EVENTS
  // ══════════════════════════════════════════════════════════════════════════

  private updateSessionState(input: FfsInput, score: FfsScore): void {
    const existing = this.sessionState.get(input.session_id);
    this.sessionState.set(input.session_id, {
      currentScore:     score,
      sessionStartedAt: existing?.sessionStartedAt ?? new Date(),
      isDualFlame:      input.is_dual_flame,
    });
  }

  private emitScoreEvents(score: FfsScore, input: FfsInput): void {
    const payload = {
      session_id:          score.session_id,
      creator_id:          score.creator_id,
      ffs_score:           score.ffs_score,
      ffs_tier:            score.ffs_tier,
      components:          score.components,
      adaptive_multiplier: score.adaptive_multiplier,
      is_dual_flame:       score.is_dual_flame,
      captured_at_utc:     score.captured_at_utc,
      rule_applied_id:     score.rule_applied_id,
    };
    this.nats.publish(NATS_TOPICS.FFS_SCORE_UPDATE, payload);

    // Tier transition
    const prev = this.previousTier(score.session_id);
    if (prev !== null && prev !== score.ffs_tier) {
      this.nats.publish(NATS_TOPICS.FFS_TIER_CHANGED, {
        session_id:      score.session_id,
        creator_id:      score.creator_id,
        from:            prev,
        to:              score.ffs_tier,
        ffs_score:       score.ffs_score,
        captured_at_utc: score.captured_at_utc,
        rule_applied_id: score.rule_applied_id,
      });
      this.logger.log('FfsService: tier transition', {
        session_id: score.session_id,
        from:       prev,
        to:         score.ffs_tier,
      });
    }

    // INFERNO peak
    if (score.ffs_tier === 'INFERNO') {
      this.nats.publish(NATS_TOPICS.FFS_PEAK, {
        session_id:      score.session_id,
        creator_id:      score.creator_id,
        ffs_score:       score.ffs_score,
        captured_at_utc: score.captured_at_utc,
        rule_applied_id: score.rule_applied_id,
      });
    }

    // Dual Flame INFERNO peak
    if (score.ffs_tier === 'INFERNO' && score.is_dual_flame) {
      this.nats.publish(NATS_TOPICS.FFS_DUAL_FLAME_PEAK, {
        session_id:               score.session_id,
        creator_id:               score.creator_id,
        ffs_score:                score.ffs_score,
        dual_flame_partner_score: input.dual_flame_partner_score ?? null,
        captured_at_utc:          score.captured_at_utc,
        rule_applied_id:          score.rule_applied_id,
      });
    }

    // Hot-and-Ready
    const state = this.sessionState.get(score.session_id);
    if (state) {
      const dwellMs = Date.now() - state.sessionStartedAt.getTime();
      const dwell   = dwellMs / 60_000;
      if (
        score.ffs_score >= HOT_AND_READY_MIN_SCORE &&
        dwell >= HOT_AND_READY_MIN_DWELL
      ) {
        this.nats.publish(NATS_TOPICS.FFS_HOT_AND_READY, {
          session_id:      score.session_id,
          creator_id:      score.creator_id,
          ffs_score:       score.ffs_score,
          dwell_minutes:   Math.round(dwell),
          captured_at_utc: score.captured_at_utc,
          rule_applied_id: score.rule_applied_id,
        });
      }
    }
  }

  private previousTier(sessionId: string): FfsTier | null {
    return this.sessionState.get(sessionId)?.currentScore.ffs_tier ?? null;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRIVATE — 1 Hz PUBLISHER
  // ══════════════════════════════════════════════════════════════════════════

  private ensureInterval(sessionId: string): void {
    if (this.ffsIntervals.has(sessionId)) return;
    const handle = setInterval(() => {
      const input = this.lastInput.get(sessionId);
      if (!input) {
        this.clearInterval(sessionId);
        return;
      }
      const refreshed: FfsInput = {
        ...input,
        captured_at_utc: new Date().toISOString(),
      };
      const score = this.calculateFfsScore(refreshed);
      this.emitScoreEvents(score, refreshed);
      this.updateSessionState(refreshed, score);

      const ticks = (this.tickCounters.get(sessionId) ?? 0) + 1;
      this.tickCounters.set(sessionId, ticks);
      if (ticks % FfsService.LEADERBOARD_EMIT_EVERY_TICKS === 0) {
        const leaderboard = this.getLeaderboard('all');
        this.nats.publish(NATS_TOPICS.FFS_LEADERBOARD_UPDATED, {
          ...leaderboard,
          rule_applied_id: FFS_RULE_ID,
        });
      }
    }, 1_000);
    this.ffsIntervals.set(sessionId, handle);
  }

  private clearInterval(sessionId: string): void {
    const handle = this.ffsIntervals.get(sessionId);
    if (handle) {
      clearInterval(handle);
      this.ffsIntervals.delete(sessionId);
      this.tickCounters.delete(sessionId);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRIVATE — PERSISTENCE
  // ══════════════════════════════════════════════════════════════════════════

  private async persistSnapshot(score: FfsScore, _input: FfsInput): Promise<void> {
    try {
      await this.prisma.ffsSnapshot.create({
        data: {
          session_id:      score.session_id,
          creator_id:      score.creator_id,
          ffs_score:       score.ffs_score,
          ffs_tier:        score.ffs_tier,
          components:      score.components as object,
          correlation_id:  `ffs-${score.session_id}-${Date.now()}`,
          reason_code:     `FFS_SAMPLE_${score.ffs_tier}`,
          rule_applied_id: score.rule_applied_id,
          is_dual_flame:   score.is_dual_flame,
        },
      });
    } catch (err) {
      this.logger.warn('FfsService: snapshot persist failed', {
        session_id: score.session_id,
        error:      String(err),
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRIVATE — NATS SUBSCRIPTIONS
  // ══════════════════════════════════════════════════════════════════════════

  private subscribeNatsEvents(): void {
    // SenSync™ BPM updates — update heart rate AND boost points in last input.
    // Phase 3 — `quality_boost_points` is the precomputed +10..25 bonus that
    // the SenSync service derives from adapter quality. We carry it into the
    // input frame so the next score tick adds it to the composite.
    this.nats.subscribe(NATS_TOPICS.SENSYNC_BPM_UPDATE, (payload) => {
      const sessionId = payload['session_id'] as string | undefined;
      const bpm       = payload['bpm'] as number | undefined;
      const boost     = payload['quality_boost_points'] as number | undefined;
      if (!sessionId || typeof bpm !== 'number') return;

      const last = this.lastInput.get(sessionId);
      if (last) {
        this.lastInput.set(sessionId, {
          ...last,
          sensync_bpm: bpm,
          sensync_boost_points: typeof boost === 'number' ? boost : last.sensync_boost_points,
        });
      }
    });

    // SenSync™ consent revoked — drop sensync_bpm so the boost stops next tick.
    // Upstream gate prevents new BPM publishes after revoke; this clears any
    // stale value already cached on `lastInput`.
    this.nats.subscribe(NATS_TOPICS.SENSYNC_CONSENT_REVOKED, (payload) => {
      const sessionId = payload['session_id'] as string | undefined;
      if (!sessionId) return;
      const last = this.lastInput.get(sessionId);
      if (last && last.sensync_bpm !== undefined) {
        const { sensync_bpm: _dropped, ...rest } = last;
        this.lastInput.set(sessionId, rest);
      }
    });

    // Chat message ingested — bump chat velocity approximation
    this.nats.subscribe(NATS_TOPICS.CHAT_MESSAGE_INGESTED, (payload) => {
      const sessionId = payload['session_id'] as string | undefined;
      if (!sessionId) return;
      const last = this.lastInput.get(sessionId);
      if (last) {
        this.lastInput.set(sessionId, {
          ...last,
          chat_velocity_per_min: Math.min(INPUT_MAX.chat_velocity_per_min, last.chat_velocity_per_min + 1),
        });
      }
    });

    this.logger.log('FfsService: NATS subscriptions active', {
      topics: [
        NATS_TOPICS.SENSYNC_BPM_UPDATE,
        NATS_TOPICS.SENSYNC_CONSENT_REVOKED,
        NATS_TOPICS.CHAT_MESSAGE_INGESTED,
      ],
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRIVATE — HELPERS
  // ══════════════════════════════════════════════════════════════════════════

  private zeroComponents(): FfsScoreComponents {
    return {
      tip_pressure:      0,
      chat_velocity:     0,
      dwell:             0,
      hearts:            0,
      private_spying:    0,
      heart_rate:        0,
      eye_tracking:      0,
      facial_excitement: 0,
      skin_exposure:     0,
      motion:            0,
      audio_vocal:       0,
      momentum:          0,
      hot_streak:        0,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PUBLIC — Adaptive weights read (for external audit / testing)
  // ══════════════════════════════════════════════════════════════════════════

  getAdaptiveWeightsPublic(creatorId: string): AdaptiveWeights {
    const weights = this.getAdaptiveWeights(creatorId);
    return {
      creator_id:      creatorId,
      weights,
      tip_events_seen: 0,
      last_updated_at: new Date().toISOString(),
    };
  }
}
