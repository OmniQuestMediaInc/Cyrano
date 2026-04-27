// PAYLOAD 5 — CreatorControl.Zone core service
// Business Plan B.3 + Canonical Corpus Chapter 4 (Creator Success).
//
// Unified creator workstation (single-pane) — aggregates:
//   • Broadcast Timing Copilot  — when to go live
//   • Session Monitoring Copilot — real-time price nudges during broadcast
//   • Flicker n'Flame Scoring (FFS) — the live-telemetry foundation
//   • OBS plugin + chat aggregator stubs (services/obs-bridge)
//
// This service is a READ + SUGGEST surface. It never writes to the ledger
// and never mutates wallet state. It publishes NATS suggestions for the
// UI panel (creator/cyrano-panel) and for the Integration Hub to fan out.

import { Injectable, Logger } from '@nestjs/common';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { NATS_TOPICS } from '../../nats/topics.registry';
import {
  FlickerNFlameScoringEngine,
  type FfsScore,
  type FfsSample,
} from './ffs.engine';
import {
  BroadcastTimingCopilot,
  type BroadcastWindowSuggestion,
  type TipperAvailabilityBucket,
} from './broadcast-timing.copilot';
import {
  SessionMonitoringCopilot,
  type PriceNudge,
} from './session-monitoring.copilot';

export const CREATOR_CONTROL_RULE_ID = 'CREATOR_CONTROL_ZONE_v1';

export interface CreatorWorkstationSnapshot {
  creator_id: string;
  active_session_id: string | null;
  latest_heat: FfsScore | null;
  latest_nudge: PriceNudge | null;
  top_broadcast_slots: BroadcastWindowSuggestion[];
  obs_ready: boolean;
  chat_aggregator_ready: boolean;
  captured_at_utc: string;
  rule_applied_id: string;
}

@Injectable()
export class CreatorControlService {
  private readonly logger = new Logger(CreatorControlService.name);
  // Per-creator cache of the most recent FfsScore / nudge — supports the
  // single-pane snapshot without forcing recomputation on every read.
  private readonly latestByCreator = new Map<
    string,
    { heat: FfsScore; nudge: PriceNudge }
  >();

  constructor(
    private readonly nats: NatsService,
    private readonly heat: FlickerNFlameScoringEngine,
    private readonly timing: BroadcastTimingCopilot,
    private readonly monitoring: SessionMonitoringCopilot,
  ) {}

  /**
   * Ingest a Flicker n'Flame Scoring (FFS) sample from ShowZone/Bijou/HeartZone and fan the
   * resulting suggestion out to the creator's copilot panel.
   */
  ingestSample(sample: FfsSample): { heat: FfsScore; nudge: PriceNudge } {
    const heat = this.heat.ingest(sample);
    const nudge = this.monitoring.suggestNudge(heat);
    this.latestByCreator.set(sample.creator_id, { heat, nudge });

    this.nats.publish(NATS_TOPICS.CREATOR_CONTROL_SESSION_SUGGESTION, {
      creator_id: sample.creator_id,
      session_id: sample.session_id,
      heat,
      nudge,
      rule_applied_id: CREATOR_CONTROL_RULE_ID,
      timestamp: new Date().toISOString(),
    });

    // Only emit a PRICE_NUDGE topic when the suggestion is actionable
    // (direction !== HOLD) so downstream consumers don't get noise.
    if (nudge.direction !== 'HOLD') {
      this.nats.publish(NATS_TOPICS.CREATOR_CONTROL_PRICE_NUDGE, {
        creator_id: nudge.creator_id,
        session_id: nudge.session_id,
        direction: nudge.direction,
        magnitude_pct: nudge.magnitude_pct,
        tier: nudge.tier,
        ffs_score: nudge.ffs_score,
        reason_code: nudge.reason_code,
        rule_applied_id: CREATOR_CONTROL_RULE_ID,
        captured_at_utc: nudge.captured_at_utc,
      });
    }

    return { heat, nudge };
  }

  /**
   * Run the Broadcast Timing Copilot to recommend future go-live windows.
   * This is a read query — caller supplies the 30-day availability history
   * aggregated upstream by an analytics job.
   */
  recommendBroadcastSlots(args: {
    creator_id: string;
    history: TipperAvailabilityBucket[];
    top_n?: number;
    diamond_correlated_slots?: Set<string>;
  }): BroadcastWindowSuggestion[] {
    const suggestions = this.timing.recommendTopSlots(args);

    if (suggestions.length > 0) {
      this.nats.publish(NATS_TOPICS.CREATOR_CONTROL_BROADCAST_SUGGESTION, {
        creator_id: args.creator_id,
        suggestions,
        rule_applied_id: CREATOR_CONTROL_RULE_ID,
        timestamp: new Date().toISOString(),
      });
    }

    return suggestions;
  }

  /**
   * Build the single-pane snapshot for the /creator/control dashboard.
   * Caller passes additional surface state (OBS ready, chat aggregator
   * ready) because those live outside this service's read model.
   */
  buildWorkstationSnapshot(args: {
    creator_id: string;
    active_session_id: string | null;
    top_broadcast_slots: BroadcastWindowSuggestion[];
    obs_ready: boolean;
    chat_aggregator_ready: boolean;
  }): CreatorWorkstationSnapshot {
    const cached = this.latestByCreator.get(args.creator_id);
    return {
      creator_id: args.creator_id,
      active_session_id: args.active_session_id,
      latest_heat: cached?.heat ?? null,
      latest_nudge: cached?.nudge ?? null,
      top_broadcast_slots: args.top_broadcast_slots,
      obs_ready: args.obs_ready,
      chat_aggregator_ready: args.chat_aggregator_ready,
      captured_at_utc: new Date().toISOString(),
      rule_applied_id: CREATOR_CONTROL_RULE_ID,
    };
  }

  /** Test seam — clears the in-memory cache. */
  reset(): void {
    this.latestByCreator.clear();
    this.heat.reset();
  }
}

// ## HANDOFF ─────────────────────────────────────────────────────────────────
// CreatorControl.Zone is now a live single-pane workstation. It consumes
// Flicker n'Flame Scoring (FFS) samples, runs Broadcast Timing + Session Monitoring copilots,
// and publishes deterministic suggestions to NATS
// (CREATOR_CONTROL_* and FFS_SCORE_* topics).
//
// All major creator-facing systems (ledger, gateguard, recovery, diamond
// concierge, ffs, cyrano, integration hub) are now wired together.
//
// NEXT PRIORITY: full Next.js frontend polish for /creator/control and
// /creator/cyrano-panel, plus the pre-launch readiness checklist (OBS
// plugin cert, chat aggregator live on at least one non-native platform,
// Cyrano latency SLO dashboards).
