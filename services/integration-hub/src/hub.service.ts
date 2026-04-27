// PAYLOAD 5 + PAYLOAD 9 — Integration Hub (final wiring for Payloads 1–8)
// Business Plan B.3 + B.4 + B.5 — single point of cross-service orchestration.
//
// Canonical cross-service invariants enforced here:
//   1. GateGuard Sentinel pre-processes EVERY transaction before the ledger
//      ever sees it (Payload 3). The Hub refuses to forward to the ledger
//      when GateGuard hard-declines.
//   2. Three-bucket spend order (LEDGER_SPEND_ORDER) is authoritative; the
//      Hub never re-orders or bypasses it (Payload 1 — FIZ-003).
//   3. Append-only: the Hub publishes decision + handoff events but never
//      mutates a prior ledger entry, GateGuard score, or audit record.
//   4. Every financial / guarded event MUST emit an immutable audit topic
//      (Payload 6 — AUDIT_IMMUTABLE_*).
//   5. Recovery (Payload 2) ↔ Diamond Concierge bridge is emit-only — the
//      Hub does not execute Recovery or Concierge logic directly.
//   6. Cyrano latency budget (≤ 350 ms) must be respected when the Hub
//      joins Flicker n'Flame Scoring (FFS) output into a Cyrano evaluate() call (Payload 5).
//   7. REDBOOK rate cards and RECOVERY_ENGINE constants are read-only
//      references from `governance.config.ts` — never inlined.

import { Injectable, Logger } from '@nestjs/common';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { NATS_TOPICS } from '../../nats/topics.registry';
import {
  LEDGER_SPEND_ORDER,
  RECOVERY_ENGINE,
  REDBOOK_RATE_CARDS,
} from '../../core-api/src/config/governance.config';
import type { FfsScore, FfsTier, FfsSample } from '../../creator-control/src/ffs.engine';
import type { CyranoInputFrame, CyranoSuggestion } from '../../cyrano/src/cyrano.types';
import type { CreatorControlService } from '../../creator-control/src/creator-control.service';
import type { CyranoService } from '../../cyrano/src/cyrano.service';

// PAYLOAD 9 — version bump: final consolidation release of the Hub.
export const HUB_RULE_ID = 'INTEGRATION_HUB_v2';

/**
 * GateGuard decision shape accepted by the Hub. Mirrors
 * `services/core-api/src/gateguard/gateguard.types.ts` without a runtime
 * import so the Hub stays module-boundary-clean.
 */
export type GateGuardDecision =
  | 'APPROVED'
  | 'COOLDOWN'
  | 'HARD_DECLINE'
  | 'HUMAN_ESCALATE';

export interface GateGuardEvaluation {
  decision: GateGuardDecision;
  welfare_guardian_score: number;
  reason_code: string;
  correlation_id: string;
}

/**
 * Every ledger-touching request must pass this pre-processor guard before
 * reaching the ledger repository. The Hub does not implement the scoring
 * — it consumes it. This type is the canonical interface downstream
 * services use when they ask the Hub to route a transaction.
 */
export interface GuardedLedgerRequest {
  intent: 'PURCHASE' | 'SPEND' | 'EXTENSION' | 'RECOVERY' | 'DIAMOND_QUOTE';
  wallet_id: string;
  actor_user_id: string;
  amount_tokens: number;
  amount_usd_cents: bigint;
  correlation_id: string;
  reason_code: string;
  captured_at_utc: string;
  gateguard: GateGuardEvaluation;
}

export interface GuardedLedgerDecision {
  forwarded: boolean;
  spend_order: readonly string[];
  gateguard_decision: GateGuardDecision;
  reason_code: string;
  correlation_id: string;
  rule_applied_id: string;
  captured_at_utc: string;
}

/**
 * Deterministic payout scaling bump per heat tier. Flat percentage applied
 * atop the creator's normal REDBOOK rate. The Hub does NOT write this to
 * the ledger — it publishes HUB_PAYOUT_SCALING_APPLIED so the payout
 * service can enrich the next statement cycle.
 */
const PAYOUT_SCALING_PCT_BY_TIER: Record<FfsTier, number> = {
  COLD:    0.00,
  WARM:    0.00,
  HOT:     0.05,
  INFERNO: 0.10,
};

/** Minimum heat tier that triggers a monetization handoff to Cyrano. */
const MONETIZATION_TRIGGER_TIERS: ReadonlySet<FfsTier> = new Set(['HOT', 'INFERNO']);

export interface HighHeatFlowInput {
  /** Telemetry sample — CreatorControl is the authoritative scorer. */
  sample: FfsSample;
  /** Cyrano frame, less the heat score which is injected post-scoring. */
  frame: Omit<CyranoInputFrame, 'heat'>;
  creator_payout_rate_per_token_usd: number;
  base_wallet_id: string;
}

export interface HighHeatFlowResult {
  heat: FfsScore;
  suggestion: CyranoSuggestion | null;
  payout_scaling_pct: number;
  scaled_payout_per_token_usd: number;
  spend_order: readonly string[];
  rule_applied_id: string;
  captured_at_utc: string;
}

@Injectable()
export class IntegrationHubService {
  private readonly logger = new Logger(IntegrationHubService.name);

  constructor(
    private readonly nats: NatsService,
    private readonly creatorControl: CreatorControlService,
    private readonly cyrano: CyranoService,
  ) {}

  /**
   * End-to-end high-heat path.
   *   1. CreatorControl ingests the raw sample (authoritative scorer).
   *   2. Cyrano evaluates the frame joined with the resulting heat score.
   *   3. If tier qualifies for monetization push, emit HUB_HIGH_HEAT_MONETIZATION.
   *   4. Compute payout scaling on the authoritative REDBOOK floor and emit
   *      HUB_PAYOUT_SCALING_APPLIED for the payout service.
   *
   * Returns a read-only envelope — no ledger mutation here. Three-bucket
   * spend order is returned verbatim from governance so downstream consumers
   * cannot drift.
   */
  async processHighHeatSession(input: HighHeatFlowInput): Promise<HighHeatFlowResult> {
    const { heat } = this.creatorControl.ingestSample(input.sample);
    const suggestion = this.cyrano.evaluate({ ...input.frame, heat });

    const capturedAt = new Date().toISOString();
    const tier: FfsTier = heat.tier;
    const scalingPct = PAYOUT_SCALING_PCT_BY_TIER[tier];
    const scaledRate = +(
      input.creator_payout_rate_per_token_usd * (1 + scalingPct)
    ).toFixed(4);

    if (MONETIZATION_TRIGGER_TIERS.has(tier)) {
      this.nats.publish(NATS_TOPICS.HUB_HIGH_HEAT_MONETIZATION, {
        session_id: input.frame.session_id,
        creator_id: input.frame.creator_id,
        guest_id: input.frame.guest_id,
        tier,
        ffs_score: heat.score,
        suggested_category: suggestion?.category ?? null,
        suggestion_id: suggestion?.suggestion_id ?? null,
        captured_at_utc: capturedAt,
        rule_applied_id: HUB_RULE_ID,
      });
    }

    if (scalingPct > 0) {
      this.nats.publish(NATS_TOPICS.HUB_PAYOUT_SCALING_APPLIED, {
        session_id: input.frame.session_id,
        creator_id: input.frame.creator_id,
        tier,
        scaling_pct: scalingPct,
        base_rate_usd: input.creator_payout_rate_per_token_usd,
        scaled_rate_usd: scaledRate,
        redbook_floor_min: REDBOOK_RATE_CARDS.DIAMOND_FLOOR_PER_TOKEN_MIN,
        captured_at_utc: capturedAt,
        rule_applied_id: HUB_RULE_ID,
      });
    }

    return {
      heat,
      suggestion,
      payout_scaling_pct: scalingPct,
      scaled_payout_per_token_usd: scaledRate,
      spend_order: LEDGER_SPEND_ORDER,
      rule_applied_id: HUB_RULE_ID,
      captured_at_utc: capturedAt,
    };
  }

  /**
   * Recovery ↔ Diamond Concierge bridge.
   * When the Recovery engine flags a lapsed Diamond wallet, the Hub
   * publishes a handoff so Concierge can open a white-glove outreach.
   *
   * This method does NOT invoke Recovery or Concierge directly — it only
   * emits the canonical topic. The owning services subscribe.
   */
  emitDiamondConciergeHandoff(params: {
    wallet_id: string;
    creator_id: string | null;
    lapsed_tokens: number;
    lapsed_usd_cents: bigint;
    reason_code: 'EXPIRY_LAPSED' | 'EXTENSION_MISSED' | 'RECOVERY_WINDOW_OPEN';
  }): void {
    const payload = {
      wallet_id: params.wallet_id,
      creator_id: params.creator_id,
      lapsed_tokens: params.lapsed_tokens,
      lapsed_usd_cents: params.lapsed_usd_cents.toString(),
      reason_code: params.reason_code,
      spend_order: LEDGER_SPEND_ORDER,
      rule_applied_id: HUB_RULE_ID,
      emitted_at_utc: new Date().toISOString(),
    };
    this.logger.log('IntegrationHubService: diamond concierge handoff', payload);
    this.nats.publish(NATS_TOPICS.HUB_DIAMOND_CONCIERGE_HANDOFF, payload);
  }

  /**
   * PAYLOAD 9 — canonical pre-ledger guard.
   *
   * Every service that wants to write to the ledger MUST route the request
   * through this method first. The Hub:
   *   1. Refuses to forward when GateGuard returns HARD_DECLINE or
   *      HUMAN_ESCALATE (COOLDOWN is permitted but audited).
   *   2. Emits the AUDIT_IMMUTABLE_GATEGUARD hash-chain record so the
   *      decision is written to the WORM audit trail (Payload 6).
   *   3. Publishes GATEGUARD_* decision topics for observability.
   *   4. Returns the authoritative spend order so callers cannot drift.
   *
   * The Hub does NOT perform the debit itself — callers invoke
   * `LedgerService.debitWallet` with the decision attached. That keeps
   * the ledger the only component that mutates balances.
   */
  forwardGuardedLedgerRequest(req: GuardedLedgerRequest): GuardedLedgerDecision {
    const capturedAt = req.captured_at_utc ?? new Date().toISOString();
    const approved =
      req.gateguard.decision === 'APPROVED' ||
      req.gateguard.decision === 'COOLDOWN';

    this.nats.publish(NATS_TOPICS.AUDIT_IMMUTABLE_GATEGUARD, {
      correlation_id: req.correlation_id,
      wallet_id: req.wallet_id,
      actor_user_id: req.actor_user_id,
      intent: req.intent,
      amount_tokens: req.amount_tokens,
      amount_usd_cents: req.amount_usd_cents.toString(),
      decision: req.gateguard.decision,
      welfare_guardian_score: req.gateguard.welfare_guardian_score,
      reason_code: req.gateguard.reason_code,
      spend_order: LEDGER_SPEND_ORDER,
      rule_applied_id: HUB_RULE_ID,
      captured_at_utc: capturedAt,
    });

    const decisionTopic: string =
      req.gateguard.decision === 'APPROVED'
        ? NATS_TOPICS.GATEGUARD_DECISION_APPROVED
        : req.gateguard.decision === 'COOLDOWN'
        ? NATS_TOPICS.GATEGUARD_DECISION_COOLDOWN
        : req.gateguard.decision === 'HARD_DECLINE'
        ? NATS_TOPICS.GATEGUARD_DECISION_HARD_DECLINE
        : NATS_TOPICS.GATEGUARD_DECISION_HUMAN_ESCALATE;

    this.nats.publish(decisionTopic, {
      correlation_id: req.correlation_id,
      wallet_id: req.wallet_id,
      intent: req.intent,
      welfare_guardian_score: req.gateguard.welfare_guardian_score,
      reason_code: req.gateguard.reason_code,
      emitted_at_utc: capturedAt,
    });

    if (!approved) {
      this.logger.warn('IntegrationHubService: GateGuard blocked ledger forward', {
        correlation_id: req.correlation_id,
        decision: req.gateguard.decision,
        reason_code: req.gateguard.reason_code,
      });
    }

    return {
      forwarded: approved,
      spend_order: LEDGER_SPEND_ORDER,
      gateguard_decision: req.gateguard.decision,
      reason_code: req.gateguard.reason_code,
      correlation_id: req.correlation_id,
      rule_applied_id: HUB_RULE_ID,
      captured_at_utc: capturedAt,
    };
  }

  /**
   * PAYLOAD 9 — Recovery expiry tick handoff.
   *
   * When the Recovery service detects a Diamond wallet has crossed the
   * EXPIRY_WARNING_HOURS threshold, the Hub emits the canonical recovery
   * notification so the Notification service + Concierge can co-ordinate
   * outreach. This method honours the authoritative constants in
   * RECOVERY_ENGINE — no local overrides.
   */
  emitRecoveryExpiryWarning(params: {
    wallet_id: string;
    creator_id: string | null;
    tokens_at_risk: number;
    expiry_at_utc: string;
    correlation_id: string;
  }): void {
    const payload = {
      wallet_id: params.wallet_id,
      creator_id: params.creator_id,
      tokens_at_risk: params.tokens_at_risk,
      expiry_at_utc: params.expiry_at_utc,
      warning_window_hours: RECOVERY_ENGINE.EXPIRY_WARNING_HOURS,
      extension_fee_usd: RECOVERY_ENGINE.EXTENSION_FEE_USD,
      recovery_fee_usd: RECOVERY_ENGINE.RECOVERY_FEE_USD,
      three_fifths_refund_pct: RECOVERY_ENGINE.THREE_FIFTHS_REFUND_PCT,
      token_bridge_bonus_pct: RECOVERY_ENGINE.TOKEN_BRIDGE_BONUS_PCT,
      correlation_id: params.correlation_id,
      rule_applied_id: HUB_RULE_ID,
      emitted_at_utc: new Date().toISOString(),
    };
    this.logger.log('IntegrationHubService: recovery expiry warning', payload);
    this.nats.publish(NATS_TOPICS.AUDIT_IMMUTABLE_RECOVERY, payload);
  }
}
