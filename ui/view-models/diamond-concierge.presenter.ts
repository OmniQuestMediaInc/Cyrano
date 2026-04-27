// PAYLOAD 7 — Diamond Concierge Command Center presenter.
// Pure TypeScript — no NestJS decorators, no I/O. Takes in data emitted by the
// services layer (services/diamond-concierge, services/recovery, services/core-api
// audit + gateguard), and produces UI view-models used by /admin/diamond.
//
// Invariants respected:
//   • reason_code + rule_applied_id echoed from source data; never invented.
//   • bigint → string at the boundary (JSON-safe for UI transport).
//   • No mutation of input arrays.

import type {
  AuditChainRow,
  Diamond48HQueueRow,
  DiamondCommandCenterView,
  DiamondHighBalanceRow,
  DiamondKpiCard,
  DiamondLiquidityView,
  DiamondVelocityBand,
  DiamondVelocityRow,
  GateGuardTelemetryRow,
  RecoveryCommandCenterView,
  RecoveryStageTag,
  ThreeFifthsExitCtaCard,
  TokenBridgeCtaCard,
  WelfareGuardianPanel,
} from '../types/admin-diamond-contracts';

export const DIAMOND_PRESENTER_RULE_ID = 'DIAMOND_CONCIERGE_UI_v1';
export const RECOVERY_PRESENTER_RULE_ID = 'RECOVERY_UI_v1';

/** A single open Diamond wallet as ingested from the service layer. */
export interface OpenDiamondWalletInput {
  wallet_id: string;
  user_id: string;
  remaining_tokens: bigint;
  remaining_usd_cents: bigint;
  expires_at_utc: string;
  velocity_band: DiamondVelocityBand;
}

export interface RecoveryCaseInput {
  case_id: string;
  wallet_id: string;
  user_id: string;
  stage: RecoveryStageTag;
  opened_at_utc: string;
  remaining_balance_tokens: bigint;
  original_purchase_price_usd_cents: bigint;
  flags: string[];
}

export interface GateGuardEventInput {
  event_id: string;
  actor_id: string;
  action: 'PURCHASE' | 'SPEND' | 'PAYOUT';
  decision: 'APPROVE' | 'COOLDOWN' | 'HARD_DECLINE' | 'HUMAN_ESCALATE';
  fraud_score: number;
  welfare_score: number;
  reason_codes: string[];
  captured_at_utc: string;
}

export interface WelfareCohortInput {
  cohort_average_welfare_score: number;
  cohort_average_fraud_score: number;
  active_cooldowns: number;
  active_hard_declines: number;
  active_human_escalations: number;
  trending_reason_codes: Array<{ reason_code: string; count: number }>;
}

export interface AuditEventInput {
  event_id: string;
  sequence_number: bigint;
  event_type: string;
  correlation_id: string;
  actor_id: string | null;
  occurred_at_utc: string;
  payload_hash: string;
  hash_prior: string | null;
  hash_current: string;
}

export interface TokenBridgeOfferInput {
  case_id: string;
  wallet_id: string;
  user_id: string;
  current_balance_tokens: bigint;
  bonus_tokens: bigint;
  bonus_pct: number;
  restriction_window_hours: number;
  requires_waiver_signature: boolean;
  offer_expires_at_utc: string;
  rule_applied_id: string;
}

export interface ThreeFifthsExitOfferInput {
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

export interface DiamondCommandCenterInputs {
  now_utc?: Date;
  open_wallets: OpenDiamondWalletInput[];
  warning_window_hours?: number; // default 48
  high_balance_threshold_usd_cents?: bigint;
  high_balance_personal_notes?: Record<string, string>;
  high_balance_last_touch?: Record<string, string>;
  token_bridge_offers: TokenBridgeOfferInput[];
  three_fifths_offers: ThreeFifthsExitOfferInput[];
  gateguard_events: GateGuardEventInput[];
  welfare_cohort: WelfareCohortInput;
  audit_window: AuditEventInput[];
}

export class DiamondConciergePresenter {
  private readonly RULE_ID = DIAMOND_PRESENTER_RULE_ID;

  /** Aggregate builder for the /admin/diamond dashboard. */
  buildCommandCenterView(inputs: DiamondCommandCenterInputs): DiamondCommandCenterView {
    const now = inputs.now_utc ?? new Date();
    const warningHours = inputs.warning_window_hours ?? 48;
    const highBalanceThreshold = inputs.high_balance_threshold_usd_cents ?? BigInt(10_000 * 100);

    const liquidity = this.buildLiquidityView(
      inputs.open_wallets,
      highBalanceThreshold,
      now,
      warningHours,
    );
    const warning_queue = this.buildWarningQueue(inputs.open_wallets, now, warningHours);
    const personal_touch_queue = this.buildPersonalTouchQueue(
      inputs.open_wallets,
      highBalanceThreshold,
      inputs.high_balance_personal_notes ?? {},
      inputs.high_balance_last_touch ?? {},
    );
    const gateguard_feed = this.buildGateGuardFeed(inputs.gateguard_events);
    const welfare_panel = this.buildWelfarePanel(inputs.welfare_cohort, now);
    const audit_chain_window = this.buildAuditChainWindow(inputs.audit_window);

    return {
      liquidity,
      warning_queue,
      personal_touch_queue,
      open_token_bridge_cards: inputs.token_bridge_offers.map(this.toTokenBridgeCard),
      open_three_fifths_cards: inputs.three_fifths_offers.map(this.toThreeFifthsCard),
      gateguard_feed,
      welfare_panel,
      audit_chain_window,
      generated_at_utc: now.toISOString(),
      rule_applied_id: this.RULE_ID,
    };
  }

  buildLiquidityView(
    wallets: OpenDiamondWalletInput[],
    highBalanceThreshold: bigint,
    now: Date,
    warningHours: number,
  ): DiamondLiquidityView {
    const windowMs = warningHours * 60 * 60 * 1000;
    const nowMs = now.getTime();

    let totalTokens = 0n;
    let totalCents = 0n;
    let expiringSoon = 0;
    let highBalance = 0;

    const byBand: Record<DiamondVelocityBand, DiamondVelocityRow> = {
      DAYS_14: this.emptyVelocityRow('DAYS_14'),
      DAYS_30: this.emptyVelocityRow('DAYS_30'),
      DAYS_90: this.emptyVelocityRow('DAYS_90'),
      DAYS_180: this.emptyVelocityRow('DAYS_180'),
      DAYS_366: this.emptyVelocityRow('DAYS_366'),
    };

    for (const w of wallets) {
      totalTokens += w.remaining_tokens;
      totalCents += w.remaining_usd_cents;
      const expires = new Date(w.expires_at_utc).getTime();
      if (expires > nowMs && expires <= nowMs + windowMs) expiringSoon += 1;
      if (w.remaining_usd_cents > highBalanceThreshold) highBalance += 1;

      const row = byBand[w.velocity_band];
      row.open_wallets += 1;
      row.remaining_tokens = (BigInt(row.remaining_tokens) + w.remaining_tokens).toString();
      row.remaining_usd_cents = (
        BigInt(row.remaining_usd_cents) + w.remaining_usd_cents
      ).toString();
    }

    const velocityTable = Object.values(byBand);
    const totalCentsNum = Number(totalCents);
    if (totalCentsNum > 0) {
      for (const row of velocityTable) {
        const cents = Number(BigInt(row.remaining_usd_cents));
        row.pct_of_book = Math.round((cents / totalCentsNum) * 10_000) / 100;
      }
    }

    const kpis: DiamondKpiCard[] = [
      {
        label: 'Open Diamond Wallets',
        value: wallets.length.toLocaleString('en-US'),
        trend: 'FLAT',
        reason_code: 'DIAMOND_LIQUIDITY_SNAPSHOT',
      },
      {
        label: 'Tokens in Flight',
        value: totalTokens.toLocaleString('en-US'),
        trend: 'FLAT',
        reason_code: 'DIAMOND_LIQUIDITY_SNAPSHOT',
      },
      {
        label: 'USD Exposure',
        value: this.formatUsdCents(totalCents),
        trend: 'FLAT',
        reason_code: 'DIAMOND_LIQUIDITY_SNAPSHOT',
      },
      {
        label: 'Expiring in 48h',
        value: expiringSoon.toLocaleString('en-US'),
        trend: expiringSoon > 0 ? 'UP' : 'FLAT',
        reason_code: 'DIAMOND_48H_WINDOW',
      },
      {
        label: 'High-Balance Concierge',
        value: highBalance.toLocaleString('en-US'),
        trend: 'FLAT',
        reason_code: 'DIAMOND_PERSONAL_TOUCH',
      },
    ];

    return {
      generated_at_utc: now.toISOString(),
      open_diamond_wallets: wallets.length,
      total_remaining_tokens: totalTokens.toString(),
      total_remaining_usd_cents: totalCents.toString(),
      expiring_within_48h: expiringSoon,
      high_balance_wallets: highBalance,
      velocity_table: velocityTable,
      kpis,
      rule_applied_id: this.RULE_ID,
    };
  }

  buildWarningQueue(
    wallets: OpenDiamondWalletInput[],
    now: Date,
    warningHours: number,
  ): Diamond48HQueueRow[] {
    const windowMs = warningHours * 60 * 60 * 1000;
    const nowMs = now.getTime();
    const rows: Diamond48HQueueRow[] = [];
    for (const w of wallets) {
      const expires = new Date(w.expires_at_utc).getTime();
      if (expires <= nowMs || expires > nowMs + windowMs) continue;
      const hours = Math.max(0, Math.round(((expires - nowMs) / (60 * 60 * 1000)) * 10) / 10);
      rows.push({
        wallet_id: w.wallet_id,
        user_id: w.user_id,
        expires_at_utc: w.expires_at_utc,
        remaining_tokens: w.remaining_tokens.toString(),
        remaining_usd_cents: w.remaining_usd_cents.toString(),
        hours_until_expiry: hours,
        severity: hours <= 12 ? 'CRITICAL' : 'WARNING',
      });
    }
    rows.sort((a, b) => a.hours_until_expiry - b.hours_until_expiry);
    return rows;
  }

  buildPersonalTouchQueue(
    wallets: OpenDiamondWalletInput[],
    threshold: bigint,
    notes: Record<string, string>,
    lastTouch: Record<string, string>,
  ): DiamondHighBalanceRow[] {
    const rows: DiamondHighBalanceRow[] = [];
    for (const w of wallets) {
      if (w.remaining_usd_cents <= threshold) continue;
      const cents = w.remaining_usd_cents;
      let escalation: 'GOLD' | 'PLATINUM' | 'BLACK' = 'GOLD';
      if (cents >= BigInt(100_000 * 100)) escalation = 'BLACK';
      else if (cents >= BigInt(25_000 * 100)) escalation = 'PLATINUM';
      rows.push({
        wallet_id: w.wallet_id,
        user_id: w.user_id,
        remaining_usd_cents: w.remaining_usd_cents.toString(),
        last_touch_at_utc: lastTouch[w.wallet_id] ?? null,
        concierge_notes: notes[w.wallet_id] ?? null,
        escalation_tier: escalation,
      });
    }
    rows.sort((a, b) => Number(BigInt(b.remaining_usd_cents) - BigInt(a.remaining_usd_cents)));
    return rows;
  }

  buildGateGuardFeed(events: GateGuardEventInput[]): GateGuardTelemetryRow[] {
    return [...events]
      .sort((a, b) => b.captured_at_utc.localeCompare(a.captured_at_utc))
      .slice(0, 50)
      .map((e) => ({
        event_id: e.event_id,
        actor_id: e.actor_id,
        action: e.action,
        decision: e.decision,
        fraud_score: e.fraud_score,
        welfare_score: e.welfare_score,
        reason_codes: [...e.reason_codes],
        captured_at_utc: e.captured_at_utc,
      }));
  }

  buildWelfarePanel(cohort: WelfareCohortInput, now: Date): WelfareGuardianPanel {
    return {
      generated_at_utc: now.toISOString(),
      cohort_average_welfare_score: cohort.cohort_average_welfare_score,
      cohort_average_fraud_score: cohort.cohort_average_fraud_score,
      active_cooldowns: cohort.active_cooldowns,
      active_hard_declines: cohort.active_hard_declines,
      active_human_escalations: cohort.active_human_escalations,
      trending_reason_codes: [...cohort.trending_reason_codes],
      rule_applied_id: 'WELFARE_GUARDIAN_v1',
    };
  }

  buildAuditChainWindow(events: AuditEventInput[]): AuditChainRow[] {
    return [...events]
      .sort((a, b) => (a.sequence_number < b.sequence_number ? 1 : -1))
      .slice(0, 100)
      .map((e) => ({
        event_id: e.event_id,
        sequence_number: e.sequence_number.toString(),
        event_type: e.event_type,
        correlation_id: e.correlation_id,
        actor_id: e.actor_id,
        occurred_at_utc: e.occurred_at_utc,
        payload_hash: e.payload_hash,
        hash_prior: e.hash_prior,
        hash_current: e.hash_current,
      }));
  }

  private readonly toTokenBridgeCard = (o: TokenBridgeOfferInput): TokenBridgeCtaCard => ({
    case_id: o.case_id,
    wallet_id: o.wallet_id,
    user_id: o.user_id,
    current_balance_tokens: o.current_balance_tokens.toString(),
    bonus_tokens: o.bonus_tokens.toString(),
    bonus_pct: o.bonus_pct,
    restriction_window_hours: o.restriction_window_hours,
    requires_waiver_signature: o.requires_waiver_signature,
    offer_expires_at_utc: o.offer_expires_at_utc,
    rule_applied_id: o.rule_applied_id,
  });

  private readonly toThreeFifthsCard = (o: ThreeFifthsExitOfferInput): ThreeFifthsExitCtaCard => ({
    case_id: o.case_id,
    wallet_id: o.wallet_id,
    user_id: o.user_id,
    refund_percentage: o.refund_percentage,
    lock_hours: o.lock_hours,
    processing_business_days: o.processing_business_days,
    permanent_flag: o.permanent_flag,
    policy_gated: o.policy_gated,
    policy_gate_reference: o.policy_gate_reference,
    rule_applied_id: o.rule_applied_id,
  });

  private emptyVelocityRow(band: DiamondVelocityBand): DiamondVelocityRow {
    return {
      velocity_band: band,
      open_wallets: 0,
      remaining_tokens: '0',
      remaining_usd_cents: '0',
      pct_of_book: 0,
    };
  }

  private formatUsdCents(cents: bigint): string {
    const whole = cents / 100n;
    const frac = cents % 100n;
    const neg = whole < 0n || frac < 0n;
    const absWhole = whole < 0n ? -whole : whole;
    const absFrac = frac < 0n ? -frac : frac;
    const fracStr = absFrac.toString().padStart(2, '0');
    return `${neg ? '-' : ''}$${absWhole.toLocaleString('en-US')}.${fracStr}`;
  }
}

export class RecoveryPresenter {
  private readonly RULE_ID = RECOVERY_PRESENTER_RULE_ID;

  /** Aggregate builder for /admin/recovery. */
  buildRecoveryCommandCenterView(params: {
    now_utc?: Date;
    cases: RecoveryCaseInput[];
    audit_window: AuditEventInput[];
  }): RecoveryCommandCenterView {
    const now = params.now_utc ?? new Date();
    const casesByStage = this.aggregateByStage(params.cases);
    const openCases = params.cases
      .filter((c) => c.stage !== 'RESOLVED' && c.stage !== 'EXPIRATION_PROCESSED')
      .map((c) => ({
        case_id: c.case_id,
        wallet_id: c.wallet_id,
        user_id: c.user_id,
        stage: c.stage,
        opened_at_utc: c.opened_at_utc,
        remaining_balance_tokens: c.remaining_balance_tokens.toString(),
        original_purchase_price_usd_cents: c.original_purchase_price_usd_cents.toString(),
        flags: [...c.flags],
      }))
      .sort((a, b) => b.opened_at_utc.localeCompare(a.opened_at_utc));

    const presenter = new DiamondConciergePresenter();
    const audit_trail_window = presenter.buildAuditChainWindow(params.audit_window);

    return {
      generated_at_utc: now.toISOString(),
      cases_by_stage: casesByStage,
      open_cases: openCases,
      audit_trail_window,
      rule_applied_id: this.RULE_ID,
    };
  }

  private aggregateByStage(cases: RecoveryCaseInput[]): Record<RecoveryStageTag, number> {
    const result: Record<RecoveryStageTag, number> = {
      OPEN: 0,
      TOKEN_BRIDGE_OFFERED: 0,
      TOKEN_BRIDGE_ACCEPTED: 0,
      THREE_FIFTHS_EXIT_POLICY_GATED: 0,
      THREE_FIFTHS_EXIT_OFFERED: 0,
      EXPIRATION_PROCESSED: 0,
      RESOLVED: 0,
    };
    for (const c of cases) {
      result[c.stage] = (result[c.stage] ?? 0) + 1;
    }
    return result;
  }
}
