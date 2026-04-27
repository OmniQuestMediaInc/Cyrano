// PAYLOAD 5 — Session Monitoring Copilot
// Real-time pricing push/pull suggestions during a live broadcast.
// Consumes FfsScore output from FlickerNFlameScoringEngine and returns deterministic
// price-nudge suggestions the creator can accept or ignore.
//
// No writes — this is a suggestion surface. The core-api/pricing service
// is the single writer of effective tip rates.

import { Injectable, Logger } from '@nestjs/common';
import type { FfsScore, FfsTier } from './ffs.engine';

export const SESSION_MONITORING_RULE_ID = 'SESSION_MONITORING_COPILOT_v1';

export type NudgeDirection = 'HOLD' | 'RAISE' | 'LOWER';

export interface PriceNudge {
  session_id: string;
  creator_id: string;
  direction: NudgeDirection;
  /** Fractional change relative to the current base price (e.g. 0.10 = +10%). */
  magnitude_pct: number;
  /** Current tier snapshot that produced the suggestion. */
  tier: FfsTier;
  ffs_score: number;
  /** Why — a canonical reason code. */
  reason_code: string;
  /** Human-readable prompt to show in the copilot panel. */
  copy: string;
  rule_applied_id: string;
  captured_at_utc: string;
}

/**
 * Tier → nudge policy. Deterministic; any change is a governance edit.
 * Magnitudes are conservative — the copilot nudges, it does not leap.
 */
const NUDGE_POLICY: Record<FfsTier, { direction: NudgeDirection; magnitude: number; reason: string }> = {
  INFERNO: { direction: 'RAISE', magnitude: 0.20, reason: 'HEAT_INFERNO_PRICE_PUSH' },
  HOT:     { direction: 'RAISE', magnitude: 0.10, reason: 'HEAT_HOT_PRICE_PUSH' },
  WARM:    { direction: 'HOLD',  magnitude: 0.00, reason: 'HEAT_WARM_STEADY' },
  COLD:    { direction: 'LOWER', magnitude: 0.10, reason: 'HEAT_COLD_PRICE_PULL' },
};

@Injectable()
export class SessionMonitoringCopilot {
  private readonly logger = new Logger(SessionMonitoringCopilot.name);

  /**
   * Convert a FfsScore into a PriceNudge. Pure function over the heat score;
   * two identical scores always produce identical nudges.
   */
  suggestNudge(score: FfsScore): PriceNudge {
    const policy = NUDGE_POLICY[score.tier];
    const nudge: PriceNudge = {
      session_id: score.session_id,
      creator_id: score.creator_id,
      direction: policy.direction,
      magnitude_pct: policy.magnitude,
      tier: score.tier,
      ffs_score: score.score,
      reason_code: policy.reason,
      copy: this.buildCopy(score.tier, policy.direction, policy.magnitude),
      rule_applied_id: SESSION_MONITORING_RULE_ID,
      captured_at_utc: score.captured_at_utc,
    };

    this.logger.log('SessionMonitoringCopilot: nudge computed', {
      session_id: score.session_id,
      tier: score.tier,
      direction: policy.direction,
      magnitude_pct: policy.magnitude,
      rule_applied_id: SESSION_MONITORING_RULE_ID,
    });

    return nudge;
  }

  private buildCopy(tier: FfsTier, dir: NudgeDirection, magnitude: number): string {
    if (dir === 'HOLD') return `Heat is ${tier}. Hold current price.`;
    const pct = Math.round(magnitude * 100);
    const verb = dir === 'RAISE' ? 'Raise' : 'Soft-drop';
    return `Heat is ${tier}. ${verb} price ${pct}% for the next window.`;
  }
}
