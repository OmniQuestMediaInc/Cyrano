// PAYLOAD 7 — Creator-facing UI contracts for /creator/control (Command Center).
// Extends the Payload-5 creator-control-contracts.ts with view-model shapes
// specific to the CreatorControl command pane: FFS (Flicker n'Flame Scoring) meter, Cyrano panel,
// broadcast timing copilot, persona switcher, payout rate indicator.

import type {
  FfsTier,
  HeatMeterFrame,
  PriceNudgeCard,
  BroadcastWindowRow,
  CyranoPanelSuggestion,
} from './creator-control-contracts';

/** Payout rate indicator — live creator revenue per token. */
export interface PayoutRateIndicator {
  creator_id: string;
  tier_context: FfsTier;
  current_rate_per_token_usd: number;
  redbook_floor_per_token_usd: number; // 0.075
  redbook_ceiling_per_token_usd: number; // 0.090
  scaling_pct_applied: number; // 0, 5, or 10 (HOT / INFERNO)
  captured_at_utc: string;
  reason_code: 'PAYOUT_SCALING_APPLIED';
}

/** Flicker n'Flame Scoring (FFS) meter (visual gauge). */
export interface FfsMeter {
  session_id: string;
  tier: FfsTier;
  score: number; // 0..100
  components: {
    tipper_pressure: number; // 0..40
    velocity: number; // 0..40
    vip_presence: number; // 0..20
  };
  tier_min: number; // inclusive lower bound for current tier
  tier_max: number; // exclusive upper bound
  captured_at_utc: string;
}

/** Cyrano whisper panel with heat-weighted suggestions. */
export interface CyranoWhisperPanel {
  creator_id: string;
  session_id: string | null;
  active_persona_id: string | null;
  personas_available: Array<{
    persona_id: string;
    display_name: string;
    tone: string;
    style_notes: string;
    active: boolean;
  }>;
  suggestions: CyranoPanelSuggestion[];
  latency_sla_ms: number;
  latency_last_observed_ms: number | null;
  generated_at_utc: string;
}

/** Broadcast Timing Copilot dashboard table. */
export interface BroadcastTimingDashboard {
  creator_id: string;
  windows: BroadcastWindowRow[];
  generated_at_utc: string;
  reason_code: 'BROADCAST_TIMING_COPILOT';
}

/** Live session monitoring panel (suggestion card + current nudge). */
export interface SessionMonitoringPanel {
  creator_id: string;
  active_session_id: string | null;
  latest_heat: HeatMeterFrame | null;
  latest_nudge: PriceNudgeCard | null;
  generated_at_utc: string;
}

/** Aggregate dashboard payload for /creator/control. */
export interface CreatorCommandCenterView {
  creator_id: string;
  display_name: string;
  obs_ready: boolean;
  chat_aggregator_ready: boolean;
  heat_meter: FfsMeter | null;
  session_monitoring: SessionMonitoringPanel;
  broadcast_timing: BroadcastTimingDashboard;
  cyrano_panel: CyranoWhisperPanel;
  payout_rate: PayoutRateIndicator;
  generated_at_utc: string;
  rule_applied_id: string;
}
