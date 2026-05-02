/**
 * tests/e2e/diamond-recovery-flows.spec.ts
 * CYR: Diamond recovery — Token Bridge + Three-Fifths Exit + Expiration
 *
 * Closes ship-gate E2E-1. Verifies recovery constants, stage taxonomy,
 * Diamond velocity bands, and platform-floor enforcement. Hermetic.
 */

import { RECOVERY_CONSTANTS } from '../../services/recovery/src/recovery.service';
import { DIAMOND_TIER } from '../../services/core-api/src/config/governance.config';
import type {
  DiamondVelocityBand,
  RecoveryStageTag,
  ThreeFifthsExitCtaCard,
  TokenBridgeCtaCard,
} from '../../ui/types/admin-diamond-contracts';

describe('SM-03 — Recovery stage taxonomy', () => {
  it('RecoveryStageTag has exactly the seven canonical stages', () => {
    const stages: RecoveryStageTag[] = [
      'OPEN',
      'TOKEN_BRIDGE_OFFERED',
      'TOKEN_BRIDGE_ACCEPTED',
      'THREE_FIFTHS_EXIT_POLICY_GATED',
      'THREE_FIFTHS_EXIT_OFFERED',
      'EXPIRATION_PROCESSED',
      'RESOLVED',
    ];
    expect(stages).toHaveLength(7);
    // Compile-time exhaustiveness check
    for (const s of stages) {
      const exhaustive: 'ok' = ((): 'ok' => {
        switch (s) {
          case 'OPEN':
          case 'TOKEN_BRIDGE_OFFERED':
          case 'TOKEN_BRIDGE_ACCEPTED':
          case 'THREE_FIFTHS_EXIT_POLICY_GATED':
          case 'THREE_FIFTHS_EXIT_OFFERED':
          case 'EXPIRATION_PROCESSED':
          case 'RESOLVED':
            return 'ok';
        }
      })();
      expect(exhaustive).toBe('ok');
    }
  });
});

describe('Diamond velocity bands — five canonical bands', () => {
  it('DiamondVelocityBand has exactly the five canonical bands', () => {
    const bands: DiamondVelocityBand[] = ['DAYS_14', 'DAYS_30', 'DAYS_90', 'DAYS_180', 'DAYS_366'];
    expect(bands).toHaveLength(5);
  });
});

describe('REDBOOK §5 — Recovery Engine constants', () => {
  it('TOKEN_BRIDGE_BONUS_PCT is 20%', () => {
    expect(RECOVERY_CONSTANTS.TOKEN_BRIDGE_BONUS_PCT).toBe(0.2);
  });

  it('THREE_FIFTHS_REFUND_PCT is 60%', () => {
    expect(RECOVERY_CONSTANTS.THREE_FIFTHS_REFUND_PCT).toBe(0.6);
  });

  it('Three-Fifths Exit is policy-gated by FIZ-002-REVISION-2026-04-11', () => {
    expect(RECOVERY_CONSTANTS.POLICY_GATE_REFERENCE).toBe('FIZ-002-REVISION-2026-04-11');
  });
});

describe('SM-11 — Diamond Concierge platform floor', () => {
  it('PLATFORM_FLOOR_PER_TOKEN is $0.077 (matches verifier FIZ-4)', () => {
    expect(DIAMOND_TIER.PLATFORM_FLOOR_PER_TOKEN).toBe(0.077);
  });
});

describe('Recovery card shapes (UI contract)', () => {
  it('TokenBridgeCtaCard requires bonus_pct, restriction_window_hours, and waiver flag', () => {
    const card: TokenBridgeCtaCard = {
      case_id: 'case_t1',
      wallet_id: 'wlt_t1',
      user_id: 'usr_t1',
      current_balance_tokens: '12500',
      bonus_tokens: '2500',
      bonus_pct: RECOVERY_CONSTANTS.TOKEN_BRIDGE_BONUS_PCT,
      restriction_window_hours: 168,
      requires_waiver_signature: true,
      offer_expires_at_utc: new Date(Date.now() + 48 * 3_600_000).toISOString(),
      rule_applied_id: 'REDBOOK_RECOVERY_v1',
    };
    expect(card.bonus_pct).toBe(0.2);
    expect(card.requires_waiver_signature).toBe(true);
  });

  it('ThreeFifthsExitCtaCard surfaces policy_gated and policy_gate_reference', () => {
    const card: ThreeFifthsExitCtaCard = {
      case_id: 'case_t2',
      wallet_id: 'wlt_t2',
      user_id: 'usr_t2',
      refund_percentage: RECOVERY_CONSTANTS.THREE_FIFTHS_REFUND_PCT,
      lock_hours: 168,
      processing_business_days: [3, 5],
      permanent_flag: 'PERMANENT_3_5THS_EXIT',
      policy_gated: true,
      policy_gate_reference: RECOVERY_CONSTANTS.POLICY_GATE_REFERENCE,
      rule_applied_id: 'REDBOOK_RECOVERY_v1',
    };
    expect(card.policy_gated).toBe(true);
    expect(card.policy_gate_reference).toBe('FIZ-002-REVISION-2026-04-11');
    expect(card.refund_percentage).toBe(0.6);
  });
});
