// services/core-api/src/gateguard/gateguard.types.ts
// PAYLOAD 3: GateGuard Sentinel Pre-Processor + Welfare Guardian Score
// Canonical types shared by the scorer, pre-processor, and middleware.

/**
 * Every financial action routes through GateGuard. The action value becomes
 * part of the append-only GateGuardLog and drives per-action signal weighting.
 */
export type GateGuardAction = 'PURCHASE' | 'SPEND' | 'PAYOUT';

/**
 * Deterministic decision vocabulary. These are the only four outcomes a
 * caller must handle. Any new outcome requires a governance increment.
 */
export type GateGuardDecision =
  | 'APPROVE'
  | 'COOLDOWN'
  | 'HARD_DECLINE'
  | 'HUMAN_ESCALATE';

/**
 * Welfare signals are continuous per-user observations captured at session
 * close, purchase attempt, or via streaming telemetry. They feed the
 * Welfare Guardian Score's real-time component.
 *
 * Every field is optional — callers supply what they have, the scorer gates
 * on what matters most (velocity, hours-of-day, dwell, chase loss).
 */
export interface WelfareSignals {
  /** Tokens spent in the trailing 60 minutes. */
  spendVelocity60m?: bigint;
  /** Tokens spent in the trailing 24 hours. */
  spendVelocity24h?: bigint;
  /** Number of discrete sessions in the trailing 24 hours. */
  sessionCount24h?: number;
  /** Continuous active session time, in minutes (dwell-style). */
  sessionDwellMinutes?: number;
  /** 24h hour-of-day (0..23) in the user's billing timezone. */
  localHourOfDay?: number;
  /** True if user has cancelled & re-opened a top-up within 15 min (chase). */
  chaseLossPattern?: boolean;
  /** True if the user has requested help from the Welfare Guardian recently. */
  selfReportedDistress?: boolean;
  /** Prior declines in the trailing 72 hours. */
  recentDeclines72h?: number;
}

/**
 * Fraud signals — the traditional payments-risk surface. Most fields are
 * drop-in from the DFSP risk scoring engine; GateGuard composes them with
 * welfare signals to produce a single authoritative decision.
 */
export interface FraudSignals {
  /** Account age in days. New accounts amplify other risk signals. */
  accountAgeDays?: number;
  /** Number of distinct device fingerprints in the trailing 7 days. */
  deviceFingerprintCount7d?: number;
  /** Whether the IP country differs from the billing country. */
  ipCountryMismatch?: boolean;
  /** Whether a VPN / Tor / residential-proxy hit was detected. */
  vpnDetected?: boolean;
  /** Prior chargeback ever (auto-bar trigger if true). */
  priorChargeback?: boolean;
  /** Prior disputes in the trailing 180 days (not yet chargebacks). */
  priorDisputes180d?: number;
  /** Structuring / smurfing pattern detected by the DFSP engine. */
  structuringPattern?: boolean;
  /** Bound to the risk-engine output if caller has it; optional otherwise. */
  baselineRiskScore?: number;
}

/**
 * Zero-knowledge age-verification stub. The service layer emits AV check
 * requests on NATS; an external AV provider returns a signed result that
 * GateGuard consumes via onAvResult(). Until a provider is wired, callers
 * pass the AV status inline — PENDING counts as a soft cooldown, FAILED as
 * a hard decline.
 */
export type AvStatus = 'VERIFIED' | 'PENDING' | 'FAILED' | 'UNKNOWN';

/**
 * Federated intelligence stub. When enabled, GateGuard will fan out a
 * lookup to a federated registry (cross-platform bans, known-fraud lists).
 * For now the signal is supplied inline or defaults to "unknown".
 */
export interface FederatedIntelligence {
  sharedBanList?: boolean;
  crossPlatformFraud?: boolean;
  federationVersion?: string;
}

/**
 * Caller-supplied input to evaluate a single financial attempt.
 */
export interface GateGuardInput {
  /** Unique per attempt — the ledger reference_id or pre-authorisation id. */
  transactionId: string;
  /** Correlation id stitched across services (ledger, NATS, audit). */
  correlationId: string;
  /** User / account under evaluation. */
  userId: string;
  /** The financial action being gated. */
  action: GateGuardAction;
  /** Requested gross amount, in platform tokens (CZT). BigInt-only. */
  amountTokens: bigint;
  /** Currency — always 'CZT' today; retained for future multi-currency. */
  currency?: 'CZT';
  welfareSignals?: WelfareSignals;
  fraudSignals?: FraudSignals;
  avStatus?: AvStatus;
  federated?: FederatedIntelligence;
  /** Free-form bag for downstream observers. */
  metadata?: Record<string, unknown>;
}

/**
 * Structured risk factors persisted alongside the score. These values are
 * the evidence-of-record for why a decision was made; the audit chain covers
 * integrity of the record, this envelope covers its legibility.
 */
export interface RiskFactorEnvelope {
  welfare: {
    score: number;
    velocityPenalty: number;
    hoursOfDayPenalty: number;
    dwellPenalty: number;
    chaseLossPenalty: number;
    distressPenalty: number;
    declinesPenalty: number;
  };
  fraud: {
    score: number;
    newAccountPenalty: number;
    deviceChurnPenalty: number;
    geoMismatchPenalty: number;
    vpnPenalty: number;
    chargebackAutoBar: boolean;
    disputesPenalty: number;
    structuringPenalty: number;
    baselinePenalty: number;
  };
  avStatus: AvStatus;
  federated: Required<FederatedIntelligence>;
  thresholds: {
    cooldownAt: number;
    hardDeclineAt: number;
    humanEscalateAt: number;
  };
  reasonCodes: string[];
}

/**
 * Authoritative evaluation result — the single source of truth returned
 * to callers AND persisted to WelfareGuardianScore.
 */
export interface GateGuardResult {
  transactionId: string;
  correlationId: string;
  userId: string;
  action: GateGuardAction;
  amountTokens: bigint;
  fraudScore: number;
  welfareScore: number;
  decision: GateGuardDecision;
  riskFactors: RiskFactorEnvelope;
  ruleAppliedId: string;
  evaluatedAtUtc: string;
}

/**
 * Raised by the pre-processor when a caller attempts to mutate the ledger
 * without first clearing GateGuard. Never caught inside GateGuard itself —
 * it is surfaced to the request handler.
 */
export class GateGuardDeclineError extends Error {
  public readonly decision: GateGuardDecision;
  public readonly result: GateGuardResult;
  constructor(result: GateGuardResult) {
    super(
      `GATEGUARD_${result.decision}: transaction ${result.transactionId} ` +
        `blocked by GateGuard (welfare=${result.welfareScore}, ` +
        `fraud=${result.fraudScore}).`,
    );
    this.name = 'GateGuardDeclineError';
    this.decision = result.decision;
    this.result = result;
  }
}
