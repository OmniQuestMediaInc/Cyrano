// FIZ: F-024 — GateGuard Sentinel™ for RedRoom Rewards
// Pre-processor that runs WGS-style scoring + fraud-pattern detection on every
// earn / purchase / award / burn before the points ledger is mutated. Mirrors
// the doctrine of the canonical GateGuard pre-processor (services/core-api):
//
//   • Deterministic — equal inputs yield equal decisions.
//   • Pre-processor — callers route through evaluateTransaction() *before*
//     any ledger work; HARD_DECLINE throws and the ledger is never touched.
//   • Append-only via the injectable signal sink — fraud signals are emitted
//     as events; never mutated in place.
//
// The full canonical Welfare Guardian Score lives in core-api. To keep
// rewards-api free of a cross-service import, this module embeds an
// equivalent four-band decision table and accepts an injectable scorer for
// callers that want to delegate to the core scorer at runtime.
//
// CEO addendum (2026-04-27): full Sentinel monitoring is now active on
// EARN, PURCHASE, AWARD, and BURN. Unusual patterns trigger fraud signals
// and HARD_DECLINE on the worst offenders.

import { Injectable, Logger } from '@nestjs/common';

export type SentinelActionType = 'EARN' | 'PURCHASE' | 'AWARD' | 'BURN';

export type SentinelDecision = 'APPROVE' | 'COOLDOWN' | 'HARD_DECLINE' | 'HUMAN_ESCALATE';

export const SENTINEL_RULE_ID = 'GATEGUARD_SENTINEL_RRR_v1';

/**
 * Threshold bands. Configurable from a CEO governance update without code
 * changes — the only knobs the F-024 flag governs.
 */
export const SENTINEL_THRESHOLDS = {
  cooldownAt: 40,
  hardDeclineAt: 70,
  humanEscalateAt: 90,
  /** Points value above which the fraud-signal pattern fires. */
  highValuePoints: 5_000,
};

export interface SentinelContext {
  /** Free-form reason supplied by the caller (e.g. promotion title). */
  reason?: string;
  /** Bundle id for PURCHASE actions. */
  bundleId?: string;
  /** Promotion type for AWARD actions. */
  promotionType?: string;
  /** Caller-set high-velocity hint — short-circuits to a fraud signal. */
  velocityHigh?: boolean;
  /** Trailing 60-minute earn/spend total in points. */
  velocity60m?: number;
  /** Trailing 24-hour earn/spend total in points. */
  velocity24h?: number;
  /** Account age in days (new accounts amplify fraud risk). */
  accountAgeDays?: number;
  /** True if a prior chargeback exists. Auto-bars regardless of score. */
  priorChargeback?: boolean;
  [k: string]: unknown;
}

export interface SentinelResult {
  transactionId: string;
  guestId: string;
  actionType: SentinelActionType;
  points: number;
  fraudScore: number;
  welfareScore: number;
  decision: SentinelDecision;
  reasonCodes: string[];
  ruleAppliedId: string;
  evaluatedAtUtc: string;
}

export interface FraudSignalEvent {
  type: 'fraud.signal';
  guestId: string;
  actionType: SentinelActionType;
  points: number;
  reasonCodes: string[];
  ruleAppliedId: string;
  emittedAtUtc: string;
}

export interface FraudSignalSink {
  emit(event: FraudSignalEvent): void | Promise<void>;
}

/**
 * Default sink: console-warn. Production wiring substitutes a NATS publisher
 * targeting the canonical fraud.signal topic (C-012 pattern).
 */
export class ConsoleFraudSignalSink implements FraudSignalSink {
  private readonly logger = new Logger('GateGuardSentinel/FraudSignalSink');
  emit(event: FraudSignalEvent): void {
    this.logger.warn('GateGuardSentinel: fraud signal emitted', event);
  }
}

/**
 * Optional adapter — callers may inject a richer scorer (the canonical
 * Welfare Guardian Score from core-api) and have the Sentinel use its
 * fraud/welfare bands instead of the embedded heuristics.
 */
export interface ExternalWgsScorer {
  scoreTransaction(input: {
    transactionId: string;
    guestId: string;
    amountCzt: number;
    context: SentinelContext & { actionType: SentinelActionType };
  }): Promise<{
    fraudScore: number;
    welfareScore: number;
    reasonCodes?: string[];
  }>;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function decide(fraud: number, welfare: number): SentinelDecision {
  const max = Math.max(fraud, welfare);
  if (max >= SENTINEL_THRESHOLDS.humanEscalateAt) return 'HUMAN_ESCALATE';
  if (max >= SENTINEL_THRESHOLDS.hardDeclineAt) return 'HARD_DECLINE';
  if (max >= SENTINEL_THRESHOLDS.cooldownAt) return 'COOLDOWN';
  return 'APPROVE';
}

function embeddedScore(
  actionType: SentinelActionType,
  points: number,
  context: SentinelContext,
): { fraudScore: number; welfareScore: number; reasonCodes: string[] } {
  const reasonCodes: string[] = [];

  // Fraud band
  let fraud = 0;
  if (context.priorChargeback) {
    fraud = 100;
    reasonCodes.push('PRIOR_CHARGEBACK_AUTO_BAR');
  } else {
    if (context.accountAgeDays !== undefined) {
      if (context.accountAgeDays < 1) {
        fraud += 25;
        reasonCodes.push('NEW_ACCOUNT_24H');
      } else if (context.accountAgeDays < 7) {
        fraud += 15;
        reasonCodes.push('NEW_ACCOUNT_7D');
      } else if (context.accountAgeDays < 30) {
        fraud += 8;
      }
    }
    if (points > SENTINEL_THRESHOLDS.highValuePoints) {
      fraud += 20;
      reasonCodes.push('HIGH_VALUE_POINTS');
    }
    if (context.velocityHigh) {
      fraud += 25;
      reasonCodes.push('VELOCITY_HIGH_HINT');
    }
  }

  // Welfare band — primarily velocity-driven for EARN/SPEND-style actions.
  let welfare = 0;
  const v60 = context.velocity60m ?? 0;
  const v24 = context.velocity24h ?? 0;
  const combined = points + v60 + Math.floor(v24 / 24);
  if (actionType === 'BURN' || actionType === 'PURCHASE') {
    if (combined >= 75_000) {
      welfare += 45;
      reasonCodes.push('VELOCITY_BAND_HIGH');
    } else if (combined >= 25_000) {
      welfare += 30;
      reasonCodes.push('VELOCITY_BAND_MEDIUM');
    } else if (combined >= 5_000) {
      welfare += 15;
      reasonCodes.push('VELOCITY_BAND_LOW');
    }
  }
  // Awards and earns past the high-value threshold also contribute a
  // modest welfare penalty — the user is accumulating exposure.
  if (
    (actionType === 'AWARD' || actionType === 'EARN') &&
    points > SENTINEL_THRESHOLDS.highValuePoints
  ) {
    welfare += 10;
    reasonCodes.push('AWARD_EXPOSURE_HIGH');
  }

  return {
    fraudScore: clamp(fraud, 0, 100),
    welfareScore: clamp(welfare, 0, 100),
    reasonCodes,
  };
}

@Injectable()
export class GateGuardSentinelService {
  private readonly logger = new Logger(GateGuardSentinelService.name);
  private readonly clock: () => Date;

  constructor(
    private readonly fraudSink: FraudSignalSink = new ConsoleFraudSignalSink(),
    private readonly externalScorer?: ExternalWgsScorer,
    deps: { clock?: () => Date } = {},
  ) {
    this.clock = deps.clock ?? (() => new Date());
  }

  /**
   * Run WGS scoring + fraud-pattern detection. Throws on HARD_DECLINE so the
   * caller never proceeds to ledger mutation. COOLDOWN and HUMAN_ESCALATE
   * are returned to the caller — the audit/ledger flow continues only on
   * APPROVE; callers convert non-APPROVE into a typed decline at the API
   * boundary.
   */
  async evaluateTransaction(
    guestId: string,
    points: number,
    actionType: SentinelActionType,
    context: SentinelContext = {},
  ): Promise<SentinelResult> {
    if (!guestId) {
      throw new Error('GateGuardSentinel: guestId is required');
    }
    if (!Number.isFinite(points) || points < 0) {
      throw new Error('GateGuardSentinel: points must be a non-negative number');
    }

    const transactionId = `rr-${this.clock().getTime()}-${guestId}`;

    let fraudScore: number;
    let welfareScore: number;
    let reasonCodes: string[];

    if (this.externalScorer) {
      const external = await this.externalScorer.scoreTransaction({
        transactionId,
        guestId,
        amountCzt: points,
        context: { ...context, actionType },
      });
      fraudScore = clamp(external.fraudScore, 0, 100);
      welfareScore = clamp(external.welfareScore, 0, 100);
      reasonCodes = external.reasonCodes ?? [];
    } else {
      const embedded = embeddedScore(actionType, points, context);
      fraudScore = embedded.fraudScore;
      welfareScore = embedded.welfareScore;
      reasonCodes = embedded.reasonCodes;
    }

    const decision = decide(fraudScore, welfareScore);

    // Fraud-pattern detection: high-value or velocity-flagged attempts
    // emit a fraud signal regardless of final decision.
    if (points > SENTINEL_THRESHOLDS.highValuePoints || context.velocityHigh === true) {
      this.logger.warn(
        `[GateGuard Sentinel] High-risk pattern detected for ${guestId}: ${actionType} ${points} points`,
        { reason_codes: reasonCodes, rule_applied_id: SENTINEL_RULE_ID },
      );
      const event: FraudSignalEvent = {
        type: 'fraud.signal',
        guestId,
        actionType,
        points,
        reasonCodes,
        ruleAppliedId: SENTINEL_RULE_ID,
        emittedAtUtc: this.clock().toISOString(),
      };
      // Do not let a sink failure block the ledger evaluation — observability
      // is best-effort. Decisioning is the contract.
      try {
        await this.fraudSink.emit(event);
      } catch (err) {
        this.logger.error('GateGuardSentinel: fraud-signal sink failed (non-fatal)', {
          error: String(err),
          transaction_id: transactionId,
        });
      }
    }

    const result: SentinelResult = {
      transactionId,
      guestId,
      actionType,
      points,
      fraudScore,
      welfareScore,
      decision,
      reasonCodes,
      ruleAppliedId: SENTINEL_RULE_ID,
      evaluatedAtUtc: this.clock().toISOString(),
    };

    if (decision === 'HARD_DECLINE') {
      throw new SentinelDeclineError(result);
    }

    return result;
  }
}

export class SentinelDeclineError extends Error {
  public readonly result: SentinelResult;
  constructor(result: SentinelResult) {
    super('Transaction blocked by GateGuard Sentinel');
    this.name = 'SentinelDeclineError';
    this.result = result;
  }
}

/**
 * No-op sentinel — the default for legacy call sites that have not yet
 * adopted Sentinel evaluation. Returns APPROVE for every input. New
 * production wiring MUST inject a real GateGuardSentinelService.
 */
export class NoopGateGuardSentinel extends GateGuardSentinelService {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  constructor() {
    super({ emit: () => {} });
  }

  override async evaluateTransaction(
    guestId: string,
    points: number,
    actionType: SentinelActionType,
  ): Promise<SentinelResult> {
    return {
      transactionId: `rr-noop-${guestId}`,
      guestId,
      actionType,
      points,
      fraudScore: 0,
      welfareScore: 0,
      decision: 'APPROVE',
      reasonCodes: [],
      ruleAppliedId: SENTINEL_RULE_ID,
      evaluatedAtUtc: new Date().toISOString(),
    };
  }
}
