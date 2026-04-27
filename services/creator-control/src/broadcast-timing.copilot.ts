// PAYLOAD 5 — Broadcast Timing Copilot
// Business Plan B.3 — suggests optimal go-live windows based on rolling
// tipper-online telemetry. Pure read model — never writes state.

import { Injectable, Logger } from '@nestjs/common';

export const BROADCAST_TIMING_RULE_ID = 'BROADCAST_TIMING_COPILOT_v1';

/** A 15-minute slot describing tipper availability history. */
export interface TipperAvailabilityBucket {
  /** ISO-8601 UTC start of the 15-minute slot. */
  slot_start_utc: string;
  /** Average tippers online during this slot (rolling 30-day window). */
  avg_tippers_online: number;
  /** Average tip velocity during this slot. */
  avg_tips_per_minute: number;
  /** Number of samples contributing to this average. */
  sample_count: number;
}

export interface BroadcastWindowSuggestion {
  creator_id: string;
  suggested_slot_utc: string;
  confidence: number;             // 0..1 — based on sample_count
  expected_tippers: number;
  expected_tips_per_minute: number;
  reason_code: string;
  rule_applied_id: string;
}

/** Minimum sample size before we trust a slot. */
const MIN_SAMPLES_FOR_CONFIDENCE = 10;

/** Boost applied to reason when Diamond guest availability correlates. */
const DIAMOND_CORRELATION_BOOST = 0.15;

@Injectable()
export class BroadcastTimingCopilot {
  private readonly logger = new Logger(BroadcastTimingCopilot.name);

  /**
   * Recommend the top N slots. Deterministic — sorts by a composite score
   * (availability × velocity × confidence). Ties break by earlier slot.
   */
  recommendTopSlots(args: {
    creator_id: string;
    history: TipperAvailabilityBucket[];
    top_n?: number;
    diamond_correlated_slots?: Set<string>;
  }): BroadcastWindowSuggestion[] {
    const topN = args.top_n ?? 3;
    const diamondSlots = args.diamond_correlated_slots ?? new Set<string>();

    if (args.history.length === 0) {
      this.logger.warn('BroadcastTimingCopilot: empty history — no suggestions', {
        creator_id: args.creator_id,
      });
      return [];
    }

    const scored = args.history.map((b) => {
      const confidence = Math.min(1, b.sample_count / MIN_SAMPLES_FOR_CONFIDENCE);
      const diamondBoost = diamondSlots.has(b.slot_start_utc)
        ? DIAMOND_CORRELATION_BOOST
        : 0;
      const composite =
        b.avg_tippers_online * Math.max(1, b.avg_tips_per_minute) * confidence +
        diamondBoost * 100;
      return { bucket: b, confidence, composite, diamondBoost };
    });

    scored.sort((a, b) => {
      if (b.composite !== a.composite) return b.composite - a.composite;
      return a.bucket.slot_start_utc.localeCompare(b.bucket.slot_start_utc);
    });

    return scored.slice(0, topN).map((s) => ({
      creator_id: args.creator_id,
      suggested_slot_utc: s.bucket.slot_start_utc,
      confidence: +s.confidence.toFixed(3),
      expected_tippers: Math.round(s.bucket.avg_tippers_online),
      expected_tips_per_minute: +s.bucket.avg_tips_per_minute.toFixed(2),
      reason_code:
        s.diamondBoost > 0
          ? 'HIGH_AVAILABILITY_WITH_DIAMOND_CORRELATION'
          : 'HIGH_AVAILABILITY',
      rule_applied_id: BROADCAST_TIMING_RULE_ID,
    }));
  }
}
