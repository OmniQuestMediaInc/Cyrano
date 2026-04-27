// services/core-api/src/gateguard/gateguard.service.ts
// PAYLOAD 3: GateGuard Sentinel™ Pre-Processor
// Business Plan B.5 + Canonical Corpus (Pre-Processor Risk/Welfare/AV).
//
// Every purchase / spend / payout is routed through GateGuard BEFORE the
// ledger. GateGuard produces a Welfare Guardian Score and a deterministic
// decision, persists both to append-only tables, publishes NATS events,
// and (on hard decline or escalation) halts the action via a typed error.
//
// Doctrine:
//   - Append-only. Never mutate a prior score or log row.
//   - Deterministic. Re-evaluating the same input yields the same decision.
//   - Idempotent. Evaluating the same transaction_id twice is a no-op.
//   - Auditable. Log rows are SHA-256 hash-chained; tampering is detectable.
//   - Pre-Processor. Wrappers must clear GateGuard before any ledger mutation.

import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma.service';
import { NatsService } from '../nats/nats.service';
import { NATS_TOPICS } from '../../../nats/topics.registry';
import {
  GateGuardAction,
  GateGuardDecision,
  GateGuardInput,
  GateGuardResult,
  RiskFactorEnvelope,
} from './gateguard.types';
import {
  computeWelfareGuardianScore,
  DECISION_THRESHOLDS,
  WELFARE_GUARDIAN_RULE_ID,
} from './welfare-guardian.scorer';

/** Genesis hash for the GateGuard append-only log chain. */
export const GATEGUARD_GENESIS_HASH = '0'.repeat(64);

/** Sole writer of rule_applied_id for this service. */
const RULE_ID = 'GATEGUARD_SENTINEL_v1';

/**
 * Thin Prisma delegate surface used for the two new models. We access them
 * via a typed wrapper so existing compilation does not require a regenerated
 * Prisma client at every checkout. This mirrors SafetyService pattern.
 */
type DelegateShape = {
  findUnique: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  findFirst: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  create: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

function delegate(prisma: PrismaService, name: string): DelegateShape {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model = (prisma as any)[name] as DelegateShape | undefined;
  if (!model || typeof model.create !== 'function') {
    throw new Error(`GateGuardService: Prisma delegate missing for '${name}'`);
  }
  return model;
}

/**
 * Deterministic decisioner: maps (fraud, welfare) → single decision.
 * Pure function; exported for the unit tests.
 */
export function decide(fraud: number, welfare: number): GateGuardDecision {
  const max = Math.max(fraud, welfare);
  if (max >= DECISION_THRESHOLDS.humanEscalateAt) return 'HUMAN_ESCALATE';
  if (max >= DECISION_THRESHOLDS.hardDeclineAt) return 'HARD_DECLINE';
  if (max >= DECISION_THRESHOLDS.cooldownAt) return 'COOLDOWN';
  return 'APPROVE';
}

/**
 * Canonicalises the payload before hashing so equivalent objects produce
 * identical bytes. Keys are sorted; BigInt is serialised as string.
 */
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (typeof v === 'bigint') return v.toString();
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(v).sort()) {
        sorted[key] = (v as Record<string, unknown>)[key];
      }
      return sorted;
    }
    return v;
  });
}

@Injectable()
export class GateGuardService {
  private readonly logger = new Logger(GateGuardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly nats: NatsService,
  ) {}

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Evaluates a single financial attempt. Idempotent — repeat calls for the
   * same transaction_id return the stored score unchanged.
   */
  async evaluate(input: GateGuardInput): Promise<GateGuardResult> {
    this.assertInput(input);

    // Idempotency — if we already scored this transaction, return it.
    const existing = await delegate(this.prisma, 'welfareGuardianScore').findUnique({
      where: { transaction_id: input.transactionId },
    });
    if (existing) {
      this.logger.warn('GateGuardService: transaction already evaluated — returning stored decision', {
        transaction_id: input.transactionId,
        correlation_id: input.correlationId,
        rule_applied_id: RULE_ID,
      });
      return this.hydrateStored(existing, input);
    }

    const { fraudScore, welfareScore, riskFactors } = computeWelfareGuardianScore({
      action: input.action,
      amountTokens: input.amountTokens,
      welfareSignals: input.welfareSignals,
      fraudSignals: input.fraudSignals,
      avStatus: input.avStatus,
      federated: input.federated,
    });

    const decision = decide(fraudScore, welfareScore);
    const evaluatedAtUtc = new Date().toISOString();

    const result: GateGuardResult = {
      transactionId: input.transactionId,
      correlationId: input.correlationId,
      userId: input.userId,
      action: input.action,
      amountTokens: input.amountTokens,
      fraudScore,
      welfareScore,
      decision,
      riskFactors,
      ruleAppliedId: RULE_ID,
      evaluatedAtUtc,
    };

    await this.persistScore(result);
    await this.appendLog(result);
    await this.publishEvents(result);

    return result;
  }

  /**
   * Pre-Processor wrapper. Callers hand in an evaluation input AND the
   * (async) ledger-mutating function. GateGuard runs the gate first; if the
   * decision is not APPROVE, the ledger work NEVER executes and a typed
   * GateGuardDeclineError is thrown with the full result attached.
   *
   * COOLDOWN is treated as "soft decline" — the attempt is blocked, but
   * the client may retry after a cool-off window (messaged via reason codes).
   * HUMAN_ESCALATE routes to the Human Contact Zone (NATS event) and throws.
   * HARD_DECLINE is terminal.
   */
  async preProcess<T>(
    input: GateGuardInput,
    ledgerAction: (result: GateGuardResult) => Promise<T>,
  ): Promise<{ result: GateGuardResult; output: T }> {
    const result = await this.evaluate(input);

    if (result.decision !== 'APPROVE') {
      // Lazy-import to avoid the circular of types in the throw path.
      const { GateGuardDeclineError } = await import('./gateguard.types');
      throw new GateGuardDeclineError(result);
    }

    const output = await ledgerAction(result);
    return { result, output };
  }

  /**
   * Zero-knowledge AV callback. External providers POST signed results here
   * via a controller; GateGuard records the delta to the log chain so that
   * a reconciliation of AV state is always possible.
   *
   * Nothing in this service performs the cryptographic verification — that
   * is the AV provider adapter's job. We only append the authoritative
   * status change once the signature has cleared.
   */
  async onAvResult(params: {
    transactionId: string;
    correlationId: string;
    userId: string;
    action: GateGuardAction;
    avStatus: 'VERIFIED' | 'FAILED';
    providerSignatureId: string;
  }): Promise<void> {
    const payload = {
      ...params,
      recorded_at_utc: new Date().toISOString(),
      rule_applied_id: RULE_ID,
    };
    this.logger.log('GateGuardService: AV result recorded', payload);

    await this.appendLogRaw({
      transactionId: params.transactionId,
      correlationId: params.correlationId,
      action: 'AV_CALLBACK',
      decision: params.avStatus === 'VERIFIED' ? 'APPROVE' : 'HARD_DECLINE',
      score: payload,
    });

    this.nats.publish(NATS_TOPICS.GATEGUARD_AV_CHECK_RETURNED, payload);
  }

  /**
   * Federated-intelligence fan-out stub. Emits a NATS lookup event that a
   * federation adapter (future) consumes, returning results via onFederated.
   */
  requestFederatedLookup(params: {
    correlationId: string;
    userId: string;
    action: GateGuardAction;
    federationVersion: string;
  }): void {
    this.nats.publish(NATS_TOPICS.GATEGUARD_FEDERATED_LOOKUP, {
      ...params,
      requested_at_utc: new Date().toISOString(),
      rule_applied_id: RULE_ID,
    });
  }

  /**
   * Human Contact Zone hand-off. The on-call Welfare Guardian team subscribes
   * to this topic and opens a live session with the user.
   */
  escalateToHumanContactZone(result: GateGuardResult, reason: string): void {
    this.nats.publish(NATS_TOPICS.GATEGUARD_HUMAN_CONTACT_ZONE, {
      transaction_id: result.transactionId,
      correlation_id: result.correlationId,
      user_id: result.userId,
      action: result.action,
      reason,
      decision: result.decision,
      fraud_score: result.fraudScore,
      welfare_score: result.welfareScore,
      reason_codes: result.riskFactors.reasonCodes,
      escalated_at_utc: new Date().toISOString(),
      rule_applied_id: RULE_ID,
    });
  }

  // ---------------------------------------------------------------------------
  // Internal — persistence, hashing, NATS
  // ---------------------------------------------------------------------------

  private async persistScore(result: GateGuardResult): Promise<void> {
    try {
      await delegate(this.prisma, 'welfareGuardianScore').create({
        data: {
          transaction_id: result.transactionId,
          fraud_score: result.fraudScore,
          welfare_score: result.welfareScore,
          risk_factors: result.riskFactors as unknown as Record<string, unknown>,
          decision: result.decision,
          correlation_id: result.correlationId,
          rule_applied_id: result.ruleAppliedId,
        },
      });
    } catch (error) {
      // Persistence failures are structurally important — surface them.
      this.logger.error('GateGuardService: failed to persist WelfareGuardianScore', {
        transaction_id: result.transactionId,
        error: String(error),
      });
      throw error;
    }
  }

  private async appendLog(result: GateGuardResult): Promise<void> {
    await this.appendLogRaw({
      transactionId: result.transactionId,
      correlationId: result.correlationId,
      action: result.action,
      decision: result.decision,
      score: {
        fraud_score: result.fraudScore,
        welfare_score: result.welfareScore,
        risk_factors: result.riskFactors,
        evaluated_at_utc: result.evaluatedAtUtc,
      },
    });
  }

  private async appendLogRaw(params: {
    transactionId: string;
    correlationId: string;
    action: string;
    decision: string;
    score: Record<string, unknown>;
  }): Promise<void> {
    const priorHash = await this.tailHash(params.transactionId);
    const canonical = canonicalJson({
      transaction_id: params.transactionId,
      correlation_id: params.correlationId,
      action: params.action,
      decision: params.decision,
      score: params.score,
    });
    const hashCurrent = createHash('sha256')
      .update(priorHash + canonical)
      .digest('hex');

    try {
      await delegate(this.prisma, 'gateGuardLog').create({
        data: {
          transaction_id: params.transactionId,
          action: params.action,
          score: params.score,
          decision: params.decision,
          hash_prior: priorHash,
          hash_current: hashCurrent,
          correlation_id: params.correlationId,
          rule_applied_id: RULE_ID,
        },
      });
    } catch (error) {
      this.logger.error('GateGuardService: failed to append GateGuardLog', {
        transaction_id: params.transactionId,
        action: params.action,
        error: String(error),
      });
      throw error;
    }
  }

  private async tailHash(transactionId: string): Promise<string> {
    const prior = await delegate(this.prisma, 'gateGuardLog').findFirst({
      where: { transaction_id: transactionId },
      orderBy: { created_at: 'desc' },
    });
    return (prior?.hash_current as string | undefined) ?? GATEGUARD_GENESIS_HASH;
  }

  private async publishEvents(result: GateGuardResult): Promise<void> {
    const base = {
      transaction_id: result.transactionId,
      correlation_id: result.correlationId,
      user_id: result.userId,
      action: result.action,
      fraud_score: result.fraudScore,
      welfare_score: result.welfareScore,
      decision: result.decision,
      reason_codes: result.riskFactors.reasonCodes,
      evaluated_at_utc: result.evaluatedAtUtc,
      rule_applied_id: result.ruleAppliedId,
    };

    this.nats.publish(NATS_TOPICS.GATEGUARD_EVALUATION_COMPLETED, base);

    switch (result.decision) {
      case 'APPROVE':
        this.nats.publish(NATS_TOPICS.GATEGUARD_DECISION_APPROVED, base);
        break;
      case 'COOLDOWN':
        this.nats.publish(NATS_TOPICS.GATEGUARD_DECISION_COOLDOWN, base);
        break;
      case 'HARD_DECLINE':
        this.nats.publish(NATS_TOPICS.GATEGUARD_DECISION_HARD_DECLINE, base);
        break;
      case 'HUMAN_ESCALATE':
        this.nats.publish(NATS_TOPICS.GATEGUARD_DECISION_HUMAN_ESCALATE, base);
        this.escalateToHumanContactZone(result, 'SCORE_HUMAN_ESCALATE');
        break;
    }

    // Always emit the welfare-signal topic so downstream observers (dashboards,
    // Cyrano) can react regardless of decision.
    this.nats.publish(NATS_TOPICS.GATEGUARD_WELFARE_SIGNAL, base);
  }

  private assertInput(input: GateGuardInput): void {
    if (!input.transactionId) {
      throw new Error('GateGuardService: transactionId is required');
    }
    if (!input.correlationId) {
      throw new Error('GateGuardService: correlationId is required');
    }
    if (!input.userId) {
      throw new Error('GateGuardService: userId is required');
    }
    if (typeof input.amountTokens !== 'bigint') {
      throw new Error('GateGuardService: amountTokens must be a BigInt');
    }
    if (input.amountTokens < 0n) {
      throw new Error('GateGuardService: amountTokens must be non-negative');
    }
    const validActions: GateGuardAction[] = ['PURCHASE', 'SPEND', 'PAYOUT'];
    if (!validActions.includes(input.action)) {
      throw new Error(`GateGuardService: unsupported action '${input.action}'`);
    }
  }

  private hydrateStored(
    row: Record<string, unknown>,
    input: GateGuardInput,
  ): GateGuardResult {
    const riskFactors = row.risk_factors as unknown as RiskFactorEnvelope;
    return {
      transactionId: row.transaction_id as string,
      correlationId: row.correlation_id as string,
      userId: input.userId,
      action: input.action,
      amountTokens: input.amountTokens,
      fraudScore: row.fraud_score as number,
      welfareScore: row.welfare_score as number,
      decision: row.decision as GateGuardDecision,
      riskFactors,
      ruleAppliedId: (row.rule_applied_id as string) ?? RULE_ID,
      evaluatedAtUtc: ((row.created_at as Date) ?? new Date()).toISOString(),
    };
  }
}

/**
 * Re-export the scorer rule id so callers that persist alongside a score
 * can attach it for lineage without reaching into the scorer module.
 */
export { WELFARE_GUARDIAN_RULE_ID };
