// CRM: Fan Fervor Score (FFS) — per-guest engagement score service
// Business Plan §B.4 — guest intelligence layer.
//
// Contract:
//   • FanFervorScoreService.score(input): computes ffs_score (0–100) and
//     ffs_tier (COLD/WARM/HOT/INFERNO) from a weighted sum of guest signals.
//   • SenSync™ (HeartSync biometric relay) adds +10–25 pts when consent is
//     granted and a valid BPM elevation is detected.
//   • Result persisted to fan_fervor_scores (append-only) via Prisma.
//   • NATS: emits FFS_GUEST_SCORED on every score.
//   • No ledger or payment mutations. No raw PII logged.

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { PrismaService } from '../../core-api/src/prisma.service';
import { NATS_TOPICS } from '../../nats/topics.registry';
import {
  FFS_HEARTSYNC_BOOST_MAX,
  FFS_HEARTSYNC_BOOST_MIN,
  FFS_INPUT_MAX,
  FFS_RULE_ID,
  FFS_TIER_THRESHOLDS,
  FFS_WEIGHT_CEILINGS,
  type FfsInput,
  type FfsResult,
  type FfsTier,
} from './fan-fervor-score.types';

// ── Internal helpers ─────────────────────────────────────────────────────────

/** Clamp a value to [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Linear interpolation from a to b at ratio t (0..1). */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

// ── Base score computation ────────────────────────────────────────────────────

/**
 * Compute the base FFS (0–100) from non-biometric engagement signals.
 * All components are normalised 0..ceiling via linear mapping.
 */
function computeBaseScore(input: FfsInput): number {
  // ── Component: tip volume (max 25) ─────────────────────────────────────────
  const tips_czt = Math.min(
    FFS_WEIGHT_CEILINGS.tips_czt,
    (input.tips_czt_in_session / FFS_INPUT_MAX.tips_czt_in_session) *
      FFS_WEIGHT_CEILINGS.tips_czt,
  );

  // ── Component: tip velocity (max 20) ───────────────────────────────────────
  const tip_velocity = Math.min(
    FFS_WEIGHT_CEILINGS.tip_velocity,
    (input.tip_velocity_per_min / FFS_INPUT_MAX.tip_velocity_per_min) *
      FFS_WEIGHT_CEILINGS.tip_velocity,
  );

  // ── Component: chat engagement — messages + reactions (max 15) ─────────────
  const combined_chat =
    (input.chat_messages_in_session / FFS_INPUT_MAX.chat_messages_in_session +
      input.heart_reactions_in_session /
        FFS_INPUT_MAX.heart_reactions_in_session) /
    2; // average of the two normalised signals (0..1)
  const chat_engagement = Math.min(
    FFS_WEIGHT_CEILINGS.chat_engagement,
    combined_chat * FFS_WEIGHT_CEILINGS.chat_engagement,
  );

  // ── Component: session dwell (max 5) ───────────────────────────────────────
  const dwell = Math.min(
    FFS_WEIGHT_CEILINGS.dwell,
    (input.dwell_minutes / FFS_INPUT_MAX.dwell_minutes) *
      FFS_WEIGHT_CEILINGS.dwell,
  );

  // ── Component: private/exclusive requests (max 10) ─────────────────────────
  const private_requests = Math.min(
    FFS_WEIGHT_CEILINGS.private_requests,
    (input.private_request_count / FFS_INPUT_MAX.private_request_count) *
      FFS_WEIGHT_CEILINGS.private_requests,
  );

  // ── Component: long-term whale score baseline (max 25) ─────────────────────
  // whale_score is already normalised 0..100; map linearly to 0..25.
  const whale_score_component = Math.min(
    FFS_WEIGHT_CEILINGS.whale_score,
    (input.whale_score / 100) * FFS_WEIGHT_CEILINGS.whale_score,
  );

  const raw =
    tips_czt +
    tip_velocity +
    chat_engagement +
    dwell +
    private_requests +
    whale_score_component;

  return Math.round(clamp(raw, 0, 100));
}

// ── SenSync™ / HeartSync boost ────────────────────────────────────────────────

/**
 * Compute the HeartSync biometric boost (0 if not opted in).
 * When consent is granted and BPM elevation is detected:
 *   boost = lerp(FFS_HEARTSYNC_BOOST_MIN, FFS_HEARTSYNC_BOOST_MAX,
 *                bpm_delta / FFS_INPUT_MAX.heartsync_bpm_delta)
 *
 * Min boost = +10 pts for any positive elevation.
 * Max boost = +25 pts at ≥40 BPM above resting baseline.
 */
function computeHeartSyncBoost(input: FfsInput): number {
  if (!input.heartsync_opted_in) return 0;
  if (input.heartsync_bpm <= 0 || input.heartsync_baseline_bpm <= 0) return 0;

  const bpm_delta = clamp(
    input.heartsync_bpm - input.heartsync_baseline_bpm,
    0,
    FFS_INPUT_MAX.heartsync_bpm_delta,
  );

  // No elevation detected — no boost even if opted in.
  if (bpm_delta <= 0) return 0;

  const t = bpm_delta / FFS_INPUT_MAX.heartsync_bpm_delta;
  return Math.round(lerp(FFS_HEARTSYNC_BOOST_MIN, FFS_HEARTSYNC_BOOST_MAX, t));
}

// ── Tier resolution ───────────────────────────────────────────────────────────

function resolveTier(score: number): FfsTier {
  for (const { min, tier } of FFS_TIER_THRESHOLDS) {
    if (score >= min) return tier;
  }
  return 'COLD';
}

// ── FanFervorScoreService ─────────────────────────────────────────────────────

@Injectable()
export class FanFervorScoreService {
  private readonly logger = new Logger(FanFervorScoreService.name);

  constructor(
    private readonly nats: NatsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Score a guest's fan fervor for the given session.
   * Persists the result to fan_fervor_scores (append-only) and emits FFS_GUEST_SCORED.
   */
  async score(input: FfsInput): Promise<FfsResult> {
    const base_score = computeBaseScore(input);
    const heartsync_boost = computeHeartSyncBoost(input);
    const ffs_score = clamp(base_score + heartsync_boost, 0, 100);
    const ffs_tier = resolveTier(ffs_score);

    const result: FfsResult = {
      ffs_id: randomUUID(),
      guest_id: input.guest_id,
      session_id: input.session_id,
      ffs_score,
      ffs_tier,
      base_score,
      heartsync_boost,
      correlation_id: input.correlation_id,
      rule_applied_id: FFS_RULE_ID,
      scored_at_utc: new Date().toISOString(),
    };

    await this.prisma.fanFervorScore.create({
      data: {
        guest_id:        input.guest_id,
        session_id:      input.session_id,
        ffs_score,
        ffs_tier,
        base_score,
        heartsync_boost,
        heartsync_opted_in: input.heartsync_opted_in,
        correlation_id:  input.correlation_id,
        rule_applied_id: FFS_RULE_ID,
      },
    });

    this.nats.publish(NATS_TOPICS.FFS_GUEST_SCORED, {
      ...result,
    } as unknown as Record<string, unknown>);

    this.logger.log('FanFervorScoreService: guest scored', {
      guest_id:       input.guest_id,
      session_id:     input.session_id,
      ffs_score,
      ffs_tier,
      base_score,
      heartsync_boost,
    });

    return result;
  }

  /**
   * Retrieve the latest FFS result for a guest (any session).
   */
  async getLatest(guest_id: string): Promise<FfsResult | null> {
    const row = await this.prisma.fanFervorScore.findFirst({
      where:   { guest_id },
      orderBy: { scored_at: 'desc' },
    });

    if (!row) return null;

    return {
      ffs_id:          row.id,
      guest_id:        row.guest_id,
      session_id:      row.session_id,
      ffs_score:       Number(row.ffs_score),
      ffs_tier:        row.ffs_tier as FfsTier,
      base_score:      Number(row.base_score),
      heartsync_boost: Number(row.heartsync_boost),
      correlation_id:  row.correlation_id,
      rule_applied_id: row.rule_applied_id,
      scored_at_utc:   row.scored_at.toISOString(),
    };
  }
}
