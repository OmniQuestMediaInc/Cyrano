// services/core-api/src/gateguard/welfare-guardian.scorer.ts
// PAYLOAD 3: Welfare Guardian Score — real-time composite score.
// Canonical Corpus: Pre-Processor Risk / Welfare / AV section.
//
// Two independent 0..100 bands:
//   fraudScore    — higher means more likely fraudulent
//   welfareScore  — higher means more likely harmful to the user
// Both feed the decisioner; either band alone can cool-down or hard-decline.
//
// ALL weights live here and here only — never hardcoded at callers.
// Any weight change is a governance increment of RULE_ID.

import {
  FraudSignals,
  RiskFactorEnvelope,
  WelfareSignals,
  AvStatus,
  FederatedIntelligence,
  GateGuardAction,
} from './gateguard.types';

export const WELFARE_GUARDIAN_RULE_ID = 'WELFARE_GUARDIAN_v1';

/**
 * Threshold bands drive the decisioner. They are expressed against the
 * *max* of fraud and welfare bands — either dimension on its own can
 * promote the transaction to a stricter decision.
 *
 *   [0 .. cooldownAt)          → APPROVE
 *   [cooldownAt .. hardDecline) → COOLDOWN
 *   [hardDeclineAt .. humanEscalateAt) → HARD_DECLINE
 *   [humanEscalateAt .. 100]   → HUMAN_ESCALATE
 */
export const DECISION_THRESHOLDS = {
  cooldownAt: 40,
  hardDeclineAt: 70,
  humanEscalateAt: 90,
};

/**
 * Velocity thresholds — token counts. BigInt-safe. Scaled per action:
 * payouts use larger velocity bands than purchases (creators move larger
 * values but at lower frequency).
 */
const VELOCITY_BANDS = {
  PURCHASE: {
    low: 5_000n,
    medium: 25_000n,
    high: 75_000n,
  },
  SPEND: {
    low: 2_500n,
    medium: 10_000n,
    high: 40_000n,
  },
  PAYOUT: {
    low: 50_000n,
    medium: 200_000n,
    high: 500_000n,
  },
};

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Velocity penalty: 0 for amounts under `low`, 15 at medium, 30 at high.
 * Caller's amount contributes; trailing 60-minute velocity amplifies it.
 */
function velocityPenalty(
  action: GateGuardAction,
  amountTokens: bigint,
  v60m?: bigint,
  v24h?: bigint,
): number {
  const bands = VELOCITY_BANDS[action];
  const combined = amountTokens + (v60m ?? 0n) + (v24h ?? 0n) / 24n;

  if (combined < bands.low) return 0;
  if (combined < bands.medium) return 15;
  if (combined < bands.high) return 30;
  return 45;
}

/**
 * Overnight sessions (01:00–05:59 local) contribute a welfare penalty —
 * classic sleep-deprivation / impulsive-spend window.
 */
function hoursOfDayPenalty(hourLocal?: number): number {
  if (hourLocal === undefined) return 0;
  if (hourLocal >= 1 && hourLocal <= 5) return 15;
  if (hourLocal === 0 || hourLocal === 6) return 8;
  return 0;
}

/**
 * Continuous sessions past 120 minutes begin to accumulate a welfare penalty.
 * 120+ → 8, 180+ → 16, 240+ → 24.
 */
function dwellPenalty(minutes?: number): number {
  if (minutes === undefined || minutes < 120) return 0;
  if (minutes < 180) return 8;
  if (minutes < 240) return 16;
  return 24;
}

/**
 * Fraud penalties compose the fraud side of the score.
 */
function fraudEnvelope(
  signals: FraudSignals | undefined,
): RiskFactorEnvelope['fraud'] {
  const s = signals ?? {};

  const newAccountPenalty =
    s.accountAgeDays === undefined
      ? 0
      : s.accountAgeDays < 1
      ? 25
      : s.accountAgeDays < 7
      ? 15
      : s.accountAgeDays < 30
      ? 8
      : 0;

  const deviceChurnPenalty =
    (s.deviceFingerprintCount7d ?? 0) >= 4
      ? 18
      : (s.deviceFingerprintCount7d ?? 0) >= 2
      ? 8
      : 0;

  const geoMismatchPenalty = s.ipCountryMismatch ? 12 : 0;
  const vpnPenalty = s.vpnDetected ? 10 : 0;

  const chargebackAutoBar = !!s.priorChargeback;

  const disputesPenalty =
    (s.priorDisputes180d ?? 0) >= 3
      ? 20
      : (s.priorDisputes180d ?? 0) >= 1
      ? 10
      : 0;

  const structuringPenalty = s.structuringPattern ? 25 : 0;

  // Baseline risk score (from DFSP engine) is folded in as a scaled contribution.
  const baselinePenalty = s.baselineRiskScore
    ? clamp(Math.floor(s.baselineRiskScore / 10), 0, 30)
    : 0;

  const raw =
    (chargebackAutoBar ? 100 : 0) +
    newAccountPenalty +
    deviceChurnPenalty +
    geoMismatchPenalty +
    vpnPenalty +
    disputesPenalty +
    structuringPenalty +
    baselinePenalty;

  return {
    score: clamp(raw, 0, 100),
    newAccountPenalty,
    deviceChurnPenalty,
    geoMismatchPenalty,
    vpnPenalty,
    chargebackAutoBar,
    disputesPenalty,
    structuringPenalty,
    baselinePenalty,
  };
}

/**
 * Welfare penalties compose the welfare side of the score.
 */
function welfareEnvelope(
  action: GateGuardAction,
  amountTokens: bigint,
  signals: WelfareSignals | undefined,
): RiskFactorEnvelope['welfare'] {
  const s = signals ?? {};

  const velPenalty = velocityPenalty(
    action,
    amountTokens,
    s.spendVelocity60m,
    s.spendVelocity24h,
  );
  const hourPenalty = hoursOfDayPenalty(s.localHourOfDay);
  const dwellPen = dwellPenalty(s.sessionDwellMinutes);
  const chaseLossPenalty = s.chaseLossPattern ? 25 : 0;
  const distressPenalty = s.selfReportedDistress ? 40 : 0;

  const declinesPenalty =
    (s.recentDeclines72h ?? 0) >= 3
      ? 20
      : (s.recentDeclines72h ?? 0) >= 1
      ? 10
      : 0;

  const raw =
    velPenalty +
    hourPenalty +
    dwellPen +
    chaseLossPenalty +
    distressPenalty +
    declinesPenalty;

  return {
    score: clamp(raw, 0, 100),
    velocityPenalty: velPenalty,
    hoursOfDayPenalty: hourPenalty,
    dwellPenalty: dwellPen,
    chaseLossPenalty,
    distressPenalty,
    declinesPenalty,
  };
}

/**
 * Applies AV / federated intelligence overrides to the raw envelopes.
 * Returns the reason codes that should accompany a final decline/cooldown.
 */
function applyOverrides(
  avStatus: AvStatus,
  federated: Required<FederatedIntelligence>,
  fraud: RiskFactorEnvelope['fraud'],
  welfare: RiskFactorEnvelope['welfare'],
): { fraudScore: number; welfareScore: number; reasonCodes: string[] } {
  const reasonCodes: string[] = [];

  let fraudScore = fraud.score;
  let welfareScore = welfare.score;

  // AV overrides: welfare-side gate. FAILED AV is terminal; PENDING is a
  // soft cooldown; UNKNOWN adds a mild penalty.
  if (avStatus === 'FAILED') {
    welfareScore = 100;
    reasonCodes.push('AV_FAILED');
  } else if (avStatus === 'PENDING') {
    welfareScore = Math.max(welfareScore, DECISION_THRESHOLDS.cooldownAt + 5);
    reasonCodes.push('AV_PENDING');
  } else if (avStatus === 'UNKNOWN') {
    welfareScore = clamp(welfareScore + 10, 0, 100);
    reasonCodes.push('AV_UNKNOWN');
  }

  // Federated intelligence: cross-platform bans promote to HARD_DECLINE.
  if (federated.sharedBanList) {
    fraudScore = Math.max(fraudScore, DECISION_THRESHOLDS.hardDeclineAt + 5);
    reasonCodes.push('FEDERATED_SHARED_BAN');
  }
  if (federated.crossPlatformFraud) {
    fraudScore = Math.max(fraudScore, DECISION_THRESHOLDS.hardDeclineAt);
    reasonCodes.push('FEDERATED_CROSS_PLATFORM_FRAUD');
  }

  // Chargeback auto-bar overrides every other fraud signal.
  if (fraud.chargebackAutoBar) {
    fraudScore = 100;
    reasonCodes.push('PRIOR_CHARGEBACK_AUTO_BAR');
  }

  // Compose welfare reason codes for any nontrivial contributions.
  if (welfare.distressPenalty > 0) reasonCodes.push('SELF_REPORTED_DISTRESS');
  if (welfare.chaseLossPenalty > 0) reasonCodes.push('CHASE_LOSS_PATTERN');
  if (welfare.dwellPenalty > 0) reasonCodes.push('EXTENDED_DWELL');
  if (welfare.hoursOfDayPenalty > 0) reasonCodes.push('OVERNIGHT_SESSION');
  if (welfare.velocityPenalty > 0) reasonCodes.push('ELEVATED_SPEND_VELOCITY');
  if (welfare.declinesPenalty > 0) reasonCodes.push('RECENT_DECLINES');

  if (fraud.newAccountPenalty >= 15) reasonCodes.push('NEW_ACCOUNT');
  if (fraud.deviceChurnPenalty > 0) reasonCodes.push('DEVICE_CHURN');
  if (fraud.geoMismatchPenalty > 0) reasonCodes.push('GEO_MISMATCH');
  if (fraud.vpnPenalty > 0) reasonCodes.push('VPN_DETECTED');
  if (fraud.disputesPenalty > 0) reasonCodes.push('PRIOR_DISPUTES');
  if (fraud.structuringPenalty > 0) reasonCodes.push('STRUCTURING_PATTERN');

  return {
    fraudScore: clamp(fraudScore, 0, 100),
    welfareScore: clamp(welfareScore, 0, 100),
    reasonCodes,
  };
}

/**
 * Pure scoring function. No I/O, no persistence, no logging — deterministic
 * given identical inputs. Tested exhaustively in the scorer spec.
 */
export function computeWelfareGuardianScore(params: {
  action: GateGuardAction;
  amountTokens: bigint;
  welfareSignals?: WelfareSignals;
  fraudSignals?: FraudSignals;
  avStatus?: AvStatus;
  federated?: FederatedIntelligence;
}): {
  fraudScore: number;
  welfareScore: number;
  riskFactors: RiskFactorEnvelope;
} {
  const welfare = welfareEnvelope(
    params.action,
    params.amountTokens,
    params.welfareSignals,
  );
  const fraud = fraudEnvelope(params.fraudSignals);

  const avStatus: AvStatus = params.avStatus ?? 'UNKNOWN';
  const federated: Required<FederatedIntelligence> = {
    sharedBanList: params.federated?.sharedBanList ?? false,
    crossPlatformFraud: params.federated?.crossPlatformFraud ?? false,
    federationVersion: params.federated?.federationVersion ?? 'NONE',
  };

  const { fraudScore, welfareScore, reasonCodes } = applyOverrides(
    avStatus,
    federated,
    fraud,
    welfare,
  );

  return {
    fraudScore,
    welfareScore,
    riskFactors: {
      welfare: { ...welfare, score: welfareScore },
      fraud: { ...fraud, score: fraudScore },
      avStatus,
      federated,
      thresholds: { ...DECISION_THRESHOLDS },
      reasonCodes,
    },
  };
}
