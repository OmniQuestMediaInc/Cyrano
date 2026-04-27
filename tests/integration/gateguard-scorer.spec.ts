/**
 * gateguard-scorer.spec.ts
 * PAYLOAD 3: Welfare Guardian Scorer — pure-function contract.
 *
 * Exhaustive coverage of the scorer's deterministic contract:
 *   - Each welfare penalty branch and threshold.
 *   - Each fraud penalty branch and threshold.
 *   - AV-status overrides (VERIFIED / PENDING / FAILED / UNKNOWN).
 *   - Federated intelligence overrides.
 *   - Chargeback auto-bar takes precedence over all other fraud signals.
 *   - Reason code attribution.
 */
import {
  computeWelfareGuardianScore,
  DECISION_THRESHOLDS,
} from '../../services/core-api/src/gateguard/welfare-guardian.scorer';
import { decide } from '../../services/core-api/src/gateguard/gateguard.service';

describe('computeWelfareGuardianScore — baseline', () => {
  it('returns (0, 0) for a clean purchase', () => {
    const r = computeWelfareGuardianScore({
      action: 'PURCHASE',
      amountTokens: 100n,
    });
    expect(r.fraudScore).toBe(0);
    expect(r.welfareScore).toBe(10); // AV_UNKNOWN adds +10 by default
    expect(r.riskFactors.reasonCodes).toContain('AV_UNKNOWN');
  });

  it('returns clean scores with VERIFIED AV', () => {
    const r = computeWelfareGuardianScore({
      action: 'PURCHASE',
      amountTokens: 100n,
      avStatus: 'VERIFIED',
    });
    expect(r.fraudScore).toBe(0);
    expect(r.welfareScore).toBe(0);
    expect(r.riskFactors.reasonCodes).toEqual([]);
  });
});

describe('welfare penalties', () => {
  it('velocity band: low → medium → high produces stepped penalty', () => {
    const low = computeWelfareGuardianScore({
      action: 'PURCHASE',
      amountTokens: 1_000n,
      avStatus: 'VERIFIED',
    });
    const medium = computeWelfareGuardianScore({
      action: 'PURCHASE',
      amountTokens: 10_000n,
      avStatus: 'VERIFIED',
    });
    const high = computeWelfareGuardianScore({
      action: 'PURCHASE',
      amountTokens: 50_000n,
      avStatus: 'VERIFIED',
    });
    expect(low.welfareScore).toBe(0);
    expect(medium.welfareScore).toBe(15);
    expect(high.welfareScore).toBe(30);
  });

  it('overnight hour penalty fires only in the 01:00-05:59 band', () => {
    const overnight = computeWelfareGuardianScore({
      action: 'SPEND',
      amountTokens: 100n,
      avStatus: 'VERIFIED',
      welfareSignals: { localHourOfDay: 3 },
    });
    const morning = computeWelfareGuardianScore({
      action: 'SPEND',
      amountTokens: 100n,
      avStatus: 'VERIFIED',
      welfareSignals: { localHourOfDay: 9 },
    });
    expect(overnight.welfareScore).toBe(15);
    expect(overnight.riskFactors.reasonCodes).toContain('OVERNIGHT_SESSION');
    expect(morning.welfareScore).toBe(0);
  });

  it('dwell penalty escalates in 60-minute steps past 120 minutes', () => {
    const under = computeWelfareGuardianScore({
      action: 'SPEND',
      amountTokens: 100n,
      avStatus: 'VERIFIED',
      welfareSignals: { sessionDwellMinutes: 60 },
    });
    const tier1 = computeWelfareGuardianScore({
      action: 'SPEND',
      amountTokens: 100n,
      avStatus: 'VERIFIED',
      welfareSignals: { sessionDwellMinutes: 150 },
    });
    const tier2 = computeWelfareGuardianScore({
      action: 'SPEND',
      amountTokens: 100n,
      avStatus: 'VERIFIED',
      welfareSignals: { sessionDwellMinutes: 200 },
    });
    const tier3 = computeWelfareGuardianScore({
      action: 'SPEND',
      amountTokens: 100n,
      avStatus: 'VERIFIED',
      welfareSignals: { sessionDwellMinutes: 300 },
    });
    expect(under.welfareScore).toBe(0);
    expect(tier1.welfareScore).toBe(8);
    expect(tier2.welfareScore).toBe(16);
    expect(tier3.welfareScore).toBe(24);
  });

  it('self-reported distress alone pushes welfare past the COOLDOWN threshold', () => {
    const r = computeWelfareGuardianScore({
      action: 'PURCHASE',
      amountTokens: 100n,
      avStatus: 'VERIFIED',
      welfareSignals: { selfReportedDistress: true },
    });
    expect(r.welfareScore).toBeGreaterThanOrEqual(DECISION_THRESHOLDS.cooldownAt);
    expect(r.riskFactors.reasonCodes).toContain('SELF_REPORTED_DISTRESS');
  });

  it('chase-loss pattern contributes 25 points to welfare', () => {
    const r = computeWelfareGuardianScore({
      action: 'PURCHASE',
      amountTokens: 100n,
      avStatus: 'VERIFIED',
      welfareSignals: { chaseLossPattern: true },
    });
    expect(r.welfareScore).toBe(25);
    expect(r.riskFactors.reasonCodes).toContain('CHASE_LOSS_PATTERN');
  });
});

describe('fraud penalties', () => {
  it('chargeback auto-bars fraud score to 100 regardless of other signals', () => {
    const r = computeWelfareGuardianScore({
      action: 'PURCHASE',
      amountTokens: 100n,
      avStatus: 'VERIFIED',
      fraudSignals: { priorChargeback: true },
    });
    expect(r.fraudScore).toBe(100);
    expect(r.riskFactors.fraud.chargebackAutoBar).toBe(true);
    expect(r.riskFactors.reasonCodes).toContain('PRIOR_CHARGEBACK_AUTO_BAR');
  });

  it('new-account penalty scales with account age', () => {
    const day0 = computeWelfareGuardianScore({
      action: 'PURCHASE',
      amountTokens: 100n,
      avStatus: 'VERIFIED',
      fraudSignals: { accountAgeDays: 0 },
    });
    const day3 = computeWelfareGuardianScore({
      action: 'PURCHASE',
      amountTokens: 100n,
      avStatus: 'VERIFIED',
      fraudSignals: { accountAgeDays: 3 },
    });
    const day14 = computeWelfareGuardianScore({
      action: 'PURCHASE',
      amountTokens: 100n,
      avStatus: 'VERIFIED',
      fraudSignals: { accountAgeDays: 14 },
    });
    const day90 = computeWelfareGuardianScore({
      action: 'PURCHASE',
      amountTokens: 100n,
      avStatus: 'VERIFIED',
      fraudSignals: { accountAgeDays: 90 },
    });
    expect(day0.fraudScore).toBe(25);
    expect(day3.fraudScore).toBe(15);
    expect(day14.fraudScore).toBe(8);
    expect(day90.fraudScore).toBe(0);
  });

  it('device churn + geo mismatch + VPN compose additively', () => {
    const r = computeWelfareGuardianScore({
      action: 'PURCHASE',
      amountTokens: 100n,
      avStatus: 'VERIFIED',
      fraudSignals: {
        deviceFingerprintCount7d: 5,
        ipCountryMismatch: true,
        vpnDetected: true,
      },
    });
    expect(r.fraudScore).toBe(18 + 12 + 10);
    expect(r.riskFactors.reasonCodes).toEqual(
      expect.arrayContaining(['DEVICE_CHURN', 'GEO_MISMATCH', 'VPN_DETECTED']),
    );
  });

  it('structuring pattern contributes 25 and attributes a reason code', () => {
    const r = computeWelfareGuardianScore({
      action: 'PURCHASE',
      amountTokens: 100n,
      avStatus: 'VERIFIED',
      fraudSignals: { structuringPattern: true },
    });
    expect(r.fraudScore).toBe(25);
    expect(r.riskFactors.reasonCodes).toContain('STRUCTURING_PATTERN');
  });

  it('baseline risk score scales at /10 with a 30-point cap', () => {
    const r = computeWelfareGuardianScore({
      action: 'PURCHASE',
      amountTokens: 100n,
      avStatus: 'VERIFIED',
      fraudSignals: { baselineRiskScore: 500 },
    });
    expect(r.fraudScore).toBe(30);
  });
});

describe('AV status overrides', () => {
  it('FAILED forces welfare to 100 and adds AV_FAILED code', () => {
    const r = computeWelfareGuardianScore({
      action: 'PURCHASE',
      amountTokens: 100n,
      avStatus: 'FAILED',
    });
    expect(r.welfareScore).toBe(100);
    expect(r.riskFactors.reasonCodes).toContain('AV_FAILED');
  });

  it('PENDING pushes welfare at or above the COOLDOWN line', () => {
    const r = computeWelfareGuardianScore({
      action: 'PURCHASE',
      amountTokens: 100n,
      avStatus: 'PENDING',
    });
    expect(r.welfareScore).toBeGreaterThanOrEqual(DECISION_THRESHOLDS.cooldownAt);
    expect(r.riskFactors.reasonCodes).toContain('AV_PENDING');
  });

  it('UNKNOWN adds 10 welfare points', () => {
    const r = computeWelfareGuardianScore({
      action: 'PURCHASE',
      amountTokens: 100n,
      avStatus: 'UNKNOWN',
    });
    expect(r.welfareScore).toBe(10);
    expect(r.riskFactors.reasonCodes).toContain('AV_UNKNOWN');
  });
});

describe('federated intelligence', () => {
  it('shared ban list forces HARD_DECLINE band on fraud', () => {
    const r = computeWelfareGuardianScore({
      action: 'PURCHASE',
      amountTokens: 100n,
      avStatus: 'VERIFIED',
      federated: { sharedBanList: true },
    });
    expect(r.fraudScore).toBeGreaterThanOrEqual(DECISION_THRESHOLDS.hardDeclineAt);
    expect(r.riskFactors.reasonCodes).toContain('FEDERATED_SHARED_BAN');
  });

  it('cross-platform fraud lifts fraud to at least the HARD_DECLINE floor', () => {
    const r = computeWelfareGuardianScore({
      action: 'PURCHASE',
      amountTokens: 100n,
      avStatus: 'VERIFIED',
      federated: { crossPlatformFraud: true },
    });
    expect(r.fraudScore).toBeGreaterThanOrEqual(DECISION_THRESHOLDS.hardDeclineAt);
    expect(r.riskFactors.reasonCodes).toContain('FEDERATED_CROSS_PLATFORM_FRAUD');
  });
});

describe('decide() decisioner', () => {
  it('APPROVE under cooldown threshold', () => {
    expect(decide(10, 10)).toBe('APPROVE');
    expect(decide(DECISION_THRESHOLDS.cooldownAt - 1, DECISION_THRESHOLDS.cooldownAt - 1))
      .toBe('APPROVE');
  });

  it('COOLDOWN in [cooldown, hardDecline)', () => {
    expect(decide(DECISION_THRESHOLDS.cooldownAt, 0)).toBe('COOLDOWN');
    expect(decide(0, DECISION_THRESHOLDS.cooldownAt)).toBe('COOLDOWN');
    expect(decide(DECISION_THRESHOLDS.hardDeclineAt - 1, 0)).toBe('COOLDOWN');
  });

  it('HARD_DECLINE in [hardDecline, humanEscalate)', () => {
    expect(decide(DECISION_THRESHOLDS.hardDeclineAt, 0)).toBe('HARD_DECLINE');
    expect(decide(0, DECISION_THRESHOLDS.humanEscalateAt - 1)).toBe('HARD_DECLINE');
  });

  it('HUMAN_ESCALATE at or above humanEscalate', () => {
    expect(decide(DECISION_THRESHOLDS.humanEscalateAt, 0)).toBe('HUMAN_ESCALATE');
    expect(decide(100, 100)).toBe('HUMAN_ESCALATE');
  });

  it('either band alone can promote the decision', () => {
    // Welfare clean, fraud at decline — still HARD_DECLINE.
    expect(decide(DECISION_THRESHOLDS.hardDeclineAt, 0)).toBe('HARD_DECLINE');
    // Fraud clean, welfare at decline — still HARD_DECLINE.
    expect(decide(0, DECISION_THRESHOLDS.hardDeclineAt)).toBe('HARD_DECLINE');
  });
});
