// PAYLOAD 7 — CreatorControl.Zone command center presenter.
// Composes FfsScore + nudge + broadcast windows + Cyrano panel into a single
// CreatorCommandCenterView consumed by /creator/control. Pure TypeScript —
// no NestJS dependencies, so the UI layer can be built / shipped independently
// of the service bootstrap graph.

import type {
  FfsTier,
  HeatMeterFrame,
  PriceNudgeCard,
  BroadcastWindowRow,
  CyranoPanelSuggestion,
} from '../types/creator-control-contracts';
import type {
  BroadcastTimingDashboard,
  CreatorCommandCenterView,
  CyranoWhisperPanel,
  FfsMeter,
  PayoutRateIndicator,
  SessionMonitoringPanel,
} from '../types/creator-panel-contracts';

export const CREATOR_PRESENTER_RULE_ID = 'CREATOR_CONTROL_UI_v1';

/** Tier-boundary lookup aligned to canonical GovernanceConfig.HEAT_BAND_* constants
 *  (mirror of FFS TIER_THRESHOLDS in services/creator-control/src/ffs.engine.ts). */
const TIER_BOUNDS: Record<FfsTier, { min: number; max: number }> = {
  COLD:    { min: 0,  max: 34 },  // GovernanceConfig.HEAT_BAND_COLD_MAX = 33; max exclusive
  WARM:    { min: 34, max: 61 },  // GovernanceConfig.HEAT_BAND_WARM_MAX = 60
  HOT:     { min: 61, max: 86 },  // GovernanceConfig.HEAT_BAND_HOT_MAX = 85
  INFERNO: { min: 86, max: 101 }, // 86–100 inclusive; max exclusive = 101
};

/** Payout scaling table mirrors integration-hub PAYOUT_SCALING_PCT_BY_TIER. */
const PAYOUT_SCALING_BY_TIER: Record<FfsTier, number> = {
  COLD: 0.0,
  WARM: 0.0,
  HOT: 0.05,
  INFERNO: 0.1,
};

export const REDBOOK_PAYOUT_FLOOR = 0.075;
export const REDBOOK_PAYOUT_CEILING = 0.09;

export interface HeatSampleInput {
  session_id: string;
  creator_id: string;
  tier: FfsTier;
  score: number;
  components: {
    tipper_pressure: number;
    velocity: number;
    vip_presence: number;
  };
  captured_at_utc: string;
}

export interface PriceNudgeInput {
  session_id: string;
  creator_id: string;
  direction: 'HOLD' | 'RAISE' | 'LOWER';
  magnitude_pct: number;
  tier: FfsTier;
  ffs_score: number;
  reason_code: string;
  copy: string;
  captured_at_utc: string;
}

export interface BroadcastWindowInput {
  suggested_slot_utc: string;
  confidence: number;
  expected_tippers: number;
  expected_tips_per_minute: number;
  reason_code: string;
}

export interface CyranoSuggestionInput {
  suggestion_id: string;
  session_id: string;
  category: string;
  weight: number;
  tier_context: FfsTier;
  copy: string;
  reason_codes: string[];
  emitted_at_utc: string;
  latency_ms: number;
}

export interface PersonaInput {
  persona_id: string;
  display_name: string;
  tone: string;
  style_notes: string;
  active: boolean;
}

export interface CreatorCommandCenterInputs {
  creator_id: string;
  display_name: string;
  obs_ready: boolean;
  chat_aggregator_ready: boolean;
  active_session_id: string | null;
  latest_heat: HeatSampleInput | null;
  latest_nudge: PriceNudgeInput | null;
  broadcast_windows: BroadcastWindowInput[];
  cyrano_suggestions: CyranoSuggestionInput[];
  cyrano_personas: PersonaInput[];
  cyrano_latency_sla_ms: number;
  creator_base_payout_rate_per_token_usd: number;
  now_utc?: Date;
}

export class CreatorControlPresenter {
  private readonly RULE_ID = CREATOR_PRESENTER_RULE_ID;

  buildCommandCenterView(inputs: CreatorCommandCenterInputs): CreatorCommandCenterView {
    const now = inputs.now_utc ?? new Date();

    const heat_meter = inputs.latest_heat ? this.buildHeatMeter(inputs.latest_heat) : null;
    const session_monitoring = this.buildSessionMonitoring(
      inputs.creator_id,
      inputs.active_session_id,
      inputs.latest_heat,
      inputs.latest_nudge,
      now,
    );
    const broadcast_timing = this.buildBroadcastTiming(
      inputs.creator_id,
      inputs.broadcast_windows,
      now,
    );
    const cyrano_panel = this.buildCyranoPanel(
      inputs.creator_id,
      inputs.active_session_id,
      inputs.cyrano_suggestions,
      inputs.cyrano_personas,
      inputs.cyrano_latency_sla_ms,
      now,
    );
    const payout_rate = this.buildPayoutRate(
      inputs.creator_id,
      inputs.creator_base_payout_rate_per_token_usd,
      inputs.latest_heat?.tier ?? 'COLD',
      now,
    );

    return {
      creator_id: inputs.creator_id,
      display_name: inputs.display_name,
      obs_ready: inputs.obs_ready,
      chat_aggregator_ready: inputs.chat_aggregator_ready,
      heat_meter,
      session_monitoring,
      broadcast_timing,
      cyrano_panel,
      payout_rate,
      generated_at_utc: now.toISOString(),
      rule_applied_id: this.RULE_ID,
    };
  }

  buildHeatMeter(heat: HeatSampleInput): FfsMeter {
    const bounds = TIER_BOUNDS[heat.tier];
    return {
      session_id: heat.session_id,
      tier: heat.tier,
      score: heat.score,
      components: { ...heat.components },
      tier_min: bounds.min,
      tier_max: bounds.max,
      captured_at_utc: heat.captured_at_utc,
    };
  }

  buildSessionMonitoring(
    creator_id: string,
    active_session_id: string | null,
    heat: HeatSampleInput | null,
    nudge: PriceNudgeInput | null,
    now: Date,
  ): SessionMonitoringPanel {
    const heatFrame: HeatMeterFrame | null = heat
      ? {
          session_id: heat.session_id,
          tier: heat.tier,
          score: heat.score,
          captured_at_utc: heat.captured_at_utc,
        }
      : null;
    const nudgeCard: PriceNudgeCard | null = nudge
      ? {
          session_id: nudge.session_id,
          direction: nudge.direction,
          magnitude_pct: nudge.magnitude_pct,
          tier: nudge.tier,
          ffs_score: nudge.ffs_score,
          reason_code: nudge.reason_code,
          copy: nudge.copy,
        }
      : null;
    return {
      creator_id,
      active_session_id,
      latest_heat: heatFrame,
      latest_nudge: nudgeCard,
      generated_at_utc: now.toISOString(),
    };
  }

  buildBroadcastTiming(
    creator_id: string,
    windows: BroadcastWindowInput[],
    now: Date,
  ): BroadcastTimingDashboard {
    const rows: BroadcastWindowRow[] = [...windows]
      .sort((a, b) => b.confidence - a.confidence)
      .map((w) => ({
        suggested_slot_utc: w.suggested_slot_utc,
        confidence: w.confidence,
        expected_tippers: w.expected_tippers,
        expected_tips_per_minute: w.expected_tips_per_minute,
        reason_code: w.reason_code,
      }));
    return {
      creator_id,
      windows: rows,
      generated_at_utc: now.toISOString(),
      reason_code: 'BROADCAST_TIMING_COPILOT',
    };
  }

  buildCyranoPanel(
    creator_id: string,
    active_session_id: string | null,
    suggestions: CyranoSuggestionInput[],
    personas: PersonaInput[],
    latency_sla_ms: number,
    now: Date,
  ): CyranoWhisperPanel {
    // Weight-first sort, then most recent first for deterministic UI order.
    const sorted = [...suggestions]
      .sort((a, b) =>
        b.weight !== a.weight
          ? b.weight - a.weight
          : b.emitted_at_utc.localeCompare(a.emitted_at_utc),
      )
      .slice(0, 10)
      .map<CyranoPanelSuggestion>((s) => ({
        suggestion_id: s.suggestion_id,
        session_id: s.session_id,
        category: s.category as CyranoPanelSuggestion['category'],
        weight: s.weight,
        tier_context: s.tier_context,
        copy: s.copy,
        reason_codes: [...s.reason_codes],
        emitted_at_utc: s.emitted_at_utc,
      }));

    const active_persona = personas.find((p) => p.active);
    const latencySorted = [...suggestions].sort((a, b) =>
      b.emitted_at_utc.localeCompare(a.emitted_at_utc),
    );
    return {
      creator_id,
      session_id: active_session_id,
      active_persona_id: active_persona?.persona_id ?? null,
      personas_available: personas.map((p) => ({ ...p })),
      suggestions: sorted,
      latency_sla_ms,
      latency_last_observed_ms: latencySorted.length > 0 ? latencySorted[0].latency_ms : null,
      generated_at_utc: now.toISOString(),
    };
  }

  buildPayoutRate(
    creator_id: string,
    base_rate: number,
    tier: FfsTier,
    now: Date,
  ): PayoutRateIndicator {
    const scaling = PAYOUT_SCALING_BY_TIER[tier];
    const raw = base_rate * (1 + scaling);
    // 4-decimal precision tracks REDBOOK floor/ceiling resolution ($0.0750 / $0.0900).
    const rounded = Math.round(raw * 10_000) / 10_000;
    const clamped = Math.min(Math.max(rounded, REDBOOK_PAYOUT_FLOOR), REDBOOK_PAYOUT_CEILING);
    return {
      creator_id,
      tier_context: tier,
      current_rate_per_token_usd: clamped,
      redbook_floor_per_token_usd: REDBOOK_PAYOUT_FLOOR,
      redbook_ceiling_per_token_usd: REDBOOK_PAYOUT_CEILING,
      scaling_pct_applied: scaling * 100,
      captured_at_utc: now.toISOString(),
      reason_code: 'PAYOUT_SCALING_APPLIED',
    };
  }
}
