// PAYLOAD 5 — UI contracts for /creator/control + /creator/cyrano-panel.
// Shapes mirror the service-side exports so a future Next.js frontend can
// bind without re-deriving field names. The live Next.js app is not yet
// bootstrapped — these contracts keep the frontend integration gap narrow.
//
// @alpha-frozen — wireframe binding target for Grok handoff
// (docs/UX_INTEGRATION_BRIEF.md §1). FfsTier values (COLD/WARM/HOT/INFERNO)
// are canonical — do not introduce drift like cool/warm/hot/high-heat.

export type FfsTier = 'COLD' | 'WARM' | 'HOT' | 'INFERNO';

export type CyranoCategory =
  | 'CAT_SESSION_OPEN'
  | 'CAT_ENGAGEMENT'
  | 'CAT_ESCALATION'
  | 'CAT_NARRATIVE'
  | 'CAT_CALLBACK'
  | 'CAT_RECOVERY'
  | 'CAT_MONETIZATION'
  | 'CAT_SESSION_CLOSE';

/** Feed element rendered on the real-time heat meter for /creator/control. */
export interface HeatMeterFrame {
  session_id: string;
  tier: FfsTier;
  score: number;                      // 0..100
  captured_at_utc: string;
}

/** Price-nudge card rendered on /creator/control. */
export interface PriceNudgeCard {
  session_id: string;
  direction: 'HOLD' | 'RAISE' | 'LOWER';
  magnitude_pct: number;
  tier: FfsTier;
  ffs_score: number;
  reason_code: string;
  copy: string;
}

/** Broadcast-timing row rendered on /creator/control. */
export interface BroadcastWindowRow {
  suggested_slot_utc: string;
  confidence: number;                 // 0..1
  expected_tippers: number;
  expected_tips_per_minute: number;
  reason_code: string;
}

/** Dashboard payload for /creator/control. */
export interface CreatorControlDashboard {
  creator_id: string;
  active_session_id: string | null;
  heat: HeatMeterFrame | null;
  nudge: PriceNudgeCard | null;
  broadcast_slots: BroadcastWindowRow[];
  obs_ready: boolean;
  chat_aggregator_ready: boolean;
  captured_at_utc: string;
}

/** Whisper suggestion row rendered on /creator/cyrano-panel. */
export interface CyranoPanelSuggestion {
  suggestion_id: string;
  session_id: string;
  category: CyranoCategory;
  weight: number;                     // 0..100
  tier_context: FfsTier;
  copy: string;
  reason_codes: string[];
  emitted_at_utc: string;
}

/** Stream payload for the /creator/cyrano-panel live feed. */
export interface CyranoPanelFeed {
  creator_id: string;
  session_id: string;
  active_persona_id: string | null;
  suggestions: CyranoPanelSuggestion[];
  latency_sla_ms: number;             // reference SLO (2000 ideal, 4000 cutoff)
}
