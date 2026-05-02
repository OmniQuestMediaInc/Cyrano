// PAYLOAD 7 — UI contracts for /admin/diamond Diamond Concierge Command Center.
// Mirrors the service-side types in services/diamond-concierge + services/recovery
// so a Next.js frontend can bind without re-deriving field names. Pure types —
// no runtime imports from the service layer (UI layer must remain shippable
// independently of the NestJS bootstrap graph).
//
// @alpha-frozen — wireframe binding target for Grok handoff
// (docs/UX_INTEGRATION_BRIEF.md §1). Field additions require a versioned
// migration; field removals require CEO sign-off. Do not rename fields
// without coordinating with the wireframe handoff packet.

export type DiamondVelocityBand = 'DAYS_14' | 'DAYS_30' | 'DAYS_90' | 'DAYS_180' | 'DAYS_366';

export type RecoveryStageTag =
  | 'OPEN'
  | 'TOKEN_BRIDGE_OFFERED'
  | 'TOKEN_BRIDGE_ACCEPTED'
  | 'THREE_FIFTHS_EXIT_POLICY_GATED'
  | 'THREE_FIFTHS_EXIT_OFFERED'
  | 'EXPIRATION_PROCESSED'
  | 'RESOLVED';

/** Single-line KPI card on the Diamond command center header. */
export interface DiamondKpiCard {
  label: string;
  value: string;
  trend: 'UP' | 'DOWN' | 'FLAT';
  reason_code: string;
}

/** Row of the Diamond liquidity velocity table. */
export interface DiamondVelocityRow {
  velocity_band: DiamondVelocityBand;
  open_wallets: number;
  remaining_tokens: string; // bigint as string
  remaining_usd_cents: string; // bigint as string
  pct_of_book: number; // 0..100
}

/** Aggregated real-time liquidity view for /admin/diamond. */
export interface DiamondLiquidityView {
  generated_at_utc: string;
  open_diamond_wallets: number;
  total_remaining_tokens: string;
  total_remaining_usd_cents: string;
  expiring_within_48h: number;
  high_balance_wallets: number;
  velocity_table: DiamondVelocityRow[];
  kpis: DiamondKpiCard[];
  rule_applied_id: string;
}

/** 48h warning queue row rendered on the Diamond command center. */
export interface Diamond48HQueueRow {
  wallet_id: string;
  user_id: string;
  expires_at_utc: string;
  remaining_tokens: string; // bigint as string
  remaining_usd_cents: string; // bigint as string
  hours_until_expiry: number;
  severity: 'WARNING' | 'CRITICAL';
}

/** Personal-touch queue row (>$10k USD equivalent). */
export interface DiamondHighBalanceRow {
  wallet_id: string;
  user_id: string;
  remaining_usd_cents: string; // bigint as string
  last_touch_at_utc: string | null;
  concierge_notes: string | null;
  escalation_tier: 'GOLD' | 'PLATINUM' | 'BLACK';
}

/** Token Bridge one-click offer card. */
export interface TokenBridgeCtaCard {
  case_id: string;
  wallet_id: string;
  user_id: string;
  current_balance_tokens: string; // bigint as string
  bonus_tokens: string; // bigint as string
  bonus_pct: number;
  restriction_window_hours: number;
  requires_waiver_signature: boolean;
  offer_expires_at_utc: string;
  rule_applied_id: string;
}

/** Three-Fifths Exit one-click card. */
export interface ThreeFifthsExitCtaCard {
  case_id: string;
  wallet_id: string;
  user_id: string;
  refund_percentage: number;
  lock_hours: number;
  processing_business_days: [number, number];
  permanent_flag: string;
  policy_gated: boolean;
  policy_gate_reference: string | null;
  rule_applied_id: string;
}

/** GateGuard telemetry live feed row. */
export interface GateGuardTelemetryRow {
  event_id: string;
  actor_id: string;
  action: 'PURCHASE' | 'SPEND' | 'PAYOUT';
  decision: 'APPROVE' | 'COOLDOWN' | 'HARD_DECLINE' | 'HUMAN_ESCALATE';
  fraud_score: number; // 0..100
  welfare_score: number; // 0..100
  reason_codes: string[];
  captured_at_utc: string;
}

/** Welfare Guardian score live panel summary. */
export interface WelfareGuardianPanel {
  generated_at_utc: string;
  cohort_average_welfare_score: number;
  cohort_average_fraud_score: number;
  active_cooldowns: number;
  active_hard_declines: number;
  active_human_escalations: number;
  trending_reason_codes: Array<{ reason_code: string; count: number }>;
  rule_applied_id: string;
}

/** Audit chain viewer row (from immutable audit). */
export interface AuditChainRow {
  event_id: string;
  sequence_number: string;
  event_type: string;
  correlation_id: string;
  actor_id: string | null;
  occurred_at_utc: string;
  payload_hash: string;
  hash_prior: string | null;
  hash_current: string;
}

/** Aggregate dashboard payload for /admin/diamond single-render. */
export interface DiamondCommandCenterView {
  liquidity: DiamondLiquidityView;
  warning_queue: Diamond48HQueueRow[];
  personal_touch_queue: DiamondHighBalanceRow[];
  open_token_bridge_cards: TokenBridgeCtaCard[];
  open_three_fifths_cards: ThreeFifthsExitCtaCard[];
  gateguard_feed: GateGuardTelemetryRow[];
  welfare_panel: WelfareGuardianPanel;
  audit_chain_window: AuditChainRow[];
  generated_at_utc: string;
  rule_applied_id: string;
}

/** Dashboard payload for /admin/recovery. */
export interface RecoveryCommandCenterView {
  generated_at_utc: string;
  cases_by_stage: Record<RecoveryStageTag, number>;
  open_cases: Array<{
    case_id: string;
    wallet_id: string;
    user_id: string;
    stage: RecoveryStageTag;
    opened_at_utc: string;
    remaining_balance_tokens: string; // bigint as string
    original_purchase_price_usd_cents: string; // bigint as string
    flags: string[];
  }>;
  audit_trail_window: AuditChainRow[];
  rule_applied_id: string;
}
