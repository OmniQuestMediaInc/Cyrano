// PAYLOAD 5 — Flicker n'Flame Scoring (FFS) Engine (foundation for CreatorControl + Cyrano)
// Business Plan B.4 — room-level telemetry that summarises tipper presence,
// tip velocity and dwell into a single deterministic FFS tier.
//
// Doctrine:
//   - Pure computation. No persistence here — callers decide whether to store.
//   - Deterministic. Same inputs → same tier. No randomness.
//   - Side-channel free. Does not talk to ledger or payments directly.
//   - Emits via NATS (FFS_SCORE_* topics) for downstream consumers.

import { Injectable, Logger } from '@nestjs/common';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { NATS_TOPICS } from '../../nats/topics.registry';

export const FFS_RULE_ID = 'FFS_ENGINE_v1';

export type FfsTier = 'COLD' | 'WARM' | 'HOT' | 'INFERNO';

export interface FfsSample {
  session_id: string;
  creator_id: string;
  tippers_online: number;         // how many viewers are currently tip-capable
  tips_per_minute: number;        // rolling 60s tip rate
  avg_tip_tokens: number;         // rolling 60s mean
  dwell_minutes: number;          // session runtime so far
  diamond_guests_present: number; // Diamond-tier guests currently in room
  captured_at_utc: string;
}

export interface FfsScore {
  session_id: string;
  creator_id: string;
  tier: FfsTier;
  score: number;                  // 0..100 composite
  components: {
    tipper_pressure: number;      // 0..40
    velocity: number;             // 0..40
    vip_presence: number;         // 0..20
  };
  captured_at_utc: string;
  rule_applied_id: string;
}

// Tier thresholds — canonical bands locked in GovernanceConfig.HEAT_BAND_* constants.
// COLD 0–33, WARM 34–60, HOT 61–85, INFERNO 86–100.
// Source of truth: GovernanceConfig (governance.config.ts) + DOMAIN_GLOSSARY.md.
const TIER_THRESHOLDS: Array<{ min: number; tier: FfsTier }> = [
  { min: 86, tier: 'INFERNO' },
  { min: 61, tier: 'HOT' },
  { min: 34, tier: 'WARM' },
  { min: 0,  tier: 'COLD' },
];

@Injectable()
export class FlickerNFlameScoringEngine {
  private readonly logger = new Logger(FlickerNFlameScoringEngine.name);
  // Last-known tier per session — transition emits FFS_SCORE_TIER_CHANGED.
  private readonly lastTier = new Map<string, FfsTier>();

  constructor(private readonly nats: NatsService) {}

  /** Compute a FfsScore from a sample. Pure; no side effects. */
  computeScore(sample: FfsSample): FfsScore {
    const tipperPressure = this.tipperPressure(sample.tippers_online);
    const velocity = this.velocity(sample.tips_per_minute, sample.avg_tip_tokens);
    const vipPresence = this.vipPresence(sample.diamond_guests_present);

    const score = Math.min(100, tipperPressure + velocity + vipPresence);
    const tier = this.resolveTier(score);

    return {
      session_id: sample.session_id,
      creator_id: sample.creator_id,
      tier,
      score,
      components: {
        tipper_pressure: tipperPressure,
        velocity,
        vip_presence: vipPresence,
      },
      captured_at_utc: sample.captured_at_utc,
      rule_applied_id: FFS_RULE_ID,
    };
  }

  /**
   * Ingest a sample: score it, publish to NATS, and emit a tier-changed
   * signal when the tier crosses a band boundary.
   */
  ingest(sample: FfsSample): FfsScore {
    const score = this.computeScore(sample);
    this.nats.publish(NATS_TOPICS.FFS_SCORE_UPDATE, { ...score });

    const prev = this.lastTier.get(sample.session_id);
    if (prev !== score.tier) {
      this.lastTier.set(sample.session_id, score.tier);
      this.logger.log('FlickerNFlameScoringEngine: tier transition', {
        session_id: sample.session_id,
        from: prev ?? 'UNKNOWN',
        to: score.tier,
        rule_applied_id: FFS_RULE_ID,
      });
      this.nats.publish(NATS_TOPICS.FFS_TIER_CHANGED, {
        session_id: sample.session_id,
        creator_id: sample.creator_id,
        from: prev ?? null,
        to: score.tier,
        score: score.score,
        captured_at_utc: score.captured_at_utc,
        rule_applied_id: FFS_RULE_ID,
      });
    }

    if (score.tier === 'INFERNO') {
      this.nats.publish(NATS_TOPICS.FFS_PEAK, {
        session_id: sample.session_id,
        creator_id: sample.creator_id,
        score: score.score,
        captured_at_utc: score.captured_at_utc,
        rule_applied_id: FFS_RULE_ID,
      });
    }

    return score;
  }

  /** Test seam — resets the in-memory tier map. */
  reset(): void {
    this.lastTier.clear();
  }

  private tipperPressure(tippersOnline: number): number {
    // 0..40 linear with a soft cap at 40 viewers.
    if (tippersOnline <= 0) return 0;
    return Math.min(40, Math.round(tippersOnline * 1));
  }

  private velocity(tipsPerMinute: number, avgTipTokens: number): number {
    // 0..40 — TPM * avg tip (in tokens) / 10, capped at 40.
    const raw = (tipsPerMinute * avgTipTokens) / 10;
    return Math.min(40, Math.round(raw));
  }

  private vipPresence(diamondGuests: number): number {
    // 0..20 — each Diamond guest contributes 5 pts up to 20.
    return Math.min(20, diamondGuests * 5);
  }

  private resolveTier(score: number): FfsTier {
    for (const band of TIER_THRESHOLDS) {
      if (score >= band.min) return band.tier;
    }
    return 'COLD';
  }
}
