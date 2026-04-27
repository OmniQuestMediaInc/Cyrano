// PAYLOAD 2 — REDBOOK Unified CS Recovery Types
// Scoped to CS Recovery Engine and Diamond Concierge surfaces.
// No schema changes. No prisma/ledger touchpoints.

export type RecoveryStage =
  | 'OPEN'
  | 'TOKEN_BRIDGE_OFFERED'
  | 'TOKEN_BRIDGE_ACCEPTED'
  | 'THREE_FIFTHS_EXIT_OFFERED'
  | 'THREE_FIFTHS_EXIT_POLICY_GATED'
  | 'EXPIRATION_PROCESSED'
  | 'RESOLVED';

export type RecoveryAction =
  | 'TOKEN_BRIDGE_OFFER'
  | 'TOKEN_BRIDGE_ACCEPT'
  | 'THREE_FIFTHS_EXIT_REQUEST'
  | 'EXPIRATION_DISTRIBUTE'
  | 'EXPIRATION_EXTENSION_FEE'
  | 'EXPIRATION_RECOVERY_FEE'
  | 'WARNING_48H_DISPATCHED'
  | 'PERSONAL_TOUCH_TRIGGERED';

export type RecoveryResultCode =
  | 'OK'
  | 'POLICY_GATED'
  | 'IDEMPOTENT_REPLAY'
  | 'INVALID_STATE'
  | 'INSUFFICIENT_BALANCE';

export interface RecoveryCase {
  case_id: string;
  wallet_id: string;
  user_id: string;
  opened_at_utc: string;
  stage: RecoveryStage;
  remaining_balance_tokens: bigint;
  original_purchase_price_usd_cents: bigint;
  rule_applied_id: string;
  correlation_id: string;
  flags: string[];
  audit_trail: RecoveryAuditEntry[];
}

export interface RecoveryAuditEntry {
  action: RecoveryAction;
  actor_id: string; // CS agent id OR 'SYSTEM'
  reason_code: string;
  correlation_id: string;
  rule_applied_id: string;
  at_utc: string;
  metadata?: Record<string, unknown>;
}

export interface TokenBridgeOffer {
  case_id: string;
  bonus_tokens: bigint;
  bonus_pct: number;
  requires_waiver_signature: true;
  restriction_window_hours: number;
  offer_expires_at_utc: string;
  rule_applied_id: string;
}

export interface ThreeFifthsExitOutcome {
  case_id: string;
  result_code: RecoveryResultCode;
  refund_percentage: number; // Nominal 0.60 per REDBOOK §5
  lock_hours: number; // 24h buy/spend lock
  processing_business_days: [number, number]; // [7, 10]
  permanent_flag: string; // "Aware of policy / declined two goodwill offers"
  policy_gate_reference?: string; // FIZ-002-REVISION-2026-04-11 when gated
  rule_applied_id: string;
}

export interface ExpirationDistribution {
  wallet_id: string;
  expired_tokens: bigint;
  creator_bonus_pool_tokens: bigint; // 70%
  platform_mgmt_fee_tokens: bigint; // 30%
  extension_fee_usd: number; // $49
  recovery_fee_usd: number; // $79
  rule_applied_id: string;
}

export interface WalletSnapshot {
  wallet_id: string;
  user_id: string;
  tier: 'GUEST' | 'VIP' | 'VIP_SILVER' | 'VIP_GOLD' | 'VIP_PLATINUM' | 'VIP_DIAMOND' | string;
  remaining_balance_tokens: bigint;
  remaining_balance_usd_cents: bigint;
  expires_at_utc: string;
  is_diamond: boolean;
  last_purchase_at_utc: string;
}

export interface DashboardCaseRow {
  case_id: string;
  user_id: string;
  tier: string;
  stage: RecoveryStage;
  balance_usd_cents: string | null; // bigint as string for JSON safety; null when unresolved at this surface
  opened_at_utc: string;
  flags: string[];
}
