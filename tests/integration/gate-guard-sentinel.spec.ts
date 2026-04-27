// FIZ: F-024 — GateGuard Sentinel integration tests
// Covers: scoring bands, fraud-signal emission on high-value/velocity,
// HARD_DECLINE throwing, AV gate on award path, points-purchase Sentinel
// gating, creator-gifting flow, and ordering invariants.

import {
  GateGuardSentinelService,
  SentinelDeclineError,
  SENTINEL_THRESHOLDS,
  type FraudSignalEvent,
  type FraudSignalSink,
} from '../../services/rewards-api/src/services/gate-guard-sentinel.service';
import {
  RedRoomLedgerService,
  InMemoryPointsLedgerSink,
  AvVerificationRequiredError,
} from '../../services/rewards-api/src/services/redroom-ledger.service';
import {
  PointsPurchaseService,
  InMemoryPointsAuditSink,
} from '../../services/rewards-api/src/services/points-purchase.service';
import { CreatorGiftingService } from '../../services/rewards-api/src/services/creator-gifting.service';
import { InProcessAccountVerificationService } from '../../services/rewards-api/src/services/account-verification.service';

class CapturingFraudSink implements FraudSignalSink {
  events: FraudSignalEvent[] = [];
  emit(event: FraudSignalEvent): void {
    this.events.push(event);
  }
}

describe('GateGuardSentinelService (F-024)', () => {
  it('returns APPROVE for low-value, low-risk transactions', async () => {
    const sink = new CapturingFraudSink();
    const sentinel = new GateGuardSentinelService(sink);
    const result = await sentinel.evaluateTransaction('guest_1', 100, 'EARN');

    expect(result.decision).toBe('APPROVE');
    expect(result.fraudScore).toBe(0);
    expect(result.welfareScore).toBe(0);
    expect(sink.events).toHaveLength(0);
  });

  it('emits a fraud signal when points exceed the high-value threshold', async () => {
    const sink = new CapturingFraudSink();
    const sentinel = new GateGuardSentinelService(sink);
    await sentinel.evaluateTransaction('guest_2', SENTINEL_THRESHOLDS.highValuePoints + 1, 'AWARD');

    expect(sink.events).toHaveLength(1);
    const event = sink.events[0];
    expect(event.type).toBe('fraud.signal');
    expect(event.guestId).toBe('guest_2');
    expect(event.actionType).toBe('AWARD');
    expect(event.reasonCodes).toContain('HIGH_VALUE_POINTS');
  });

  it('emits a fraud signal when context.velocityHigh is true', async () => {
    const sink = new CapturingFraudSink();
    const sentinel = new GateGuardSentinelService(sink);
    await sentinel.evaluateTransaction('guest_3', 100, 'EARN', {
      velocityHigh: true,
    });
    expect(sink.events).toHaveLength(1);
    expect(sink.events[0].reasonCodes).toContain('VELOCITY_HIGH_HINT');
  });

  it('throws SentinelDeclineError on HARD_DECLINE', async () => {
    const sink = new CapturingFraudSink();
    const sentinel = new GateGuardSentinelService(sink);
    // accountAgeDays=0 (25) + high-value (20) + velocityHigh (25) = fraud 70
    // → HARD_DECLINE band [70, 90).
    await expect(
      sentinel.evaluateTransaction('guest_4', 6_000, 'PURCHASE', {
        accountAgeDays: 0,
        velocityHigh: true,
      }),
    ).rejects.toBeInstanceOf(SentinelDeclineError);
  });

  it('decline error carries the full result envelope', async () => {
    const sentinel = new GateGuardSentinelService();
    try {
      await sentinel.evaluateTransaction('guest_5', 6_000, 'PURCHASE', {
        accountAgeDays: 0,
        velocityHigh: true,
      });
      fail('expected SentinelDeclineError');
    } catch (err) {
      expect(err).toBeInstanceOf(SentinelDeclineError);
      const decline = err as SentinelDeclineError;
      expect(decline.result.decision).toBe('HARD_DECLINE');
      expect(decline.result.reasonCodes).toEqual(
        expect.arrayContaining(['NEW_ACCOUNT_24H', 'HIGH_VALUE_POINTS', 'VELOCITY_HIGH_HINT']),
      );
    }
  });

  it('escalates to HUMAN_ESCALATE on prior chargeback (fraud=100)', async () => {
    const sentinel = new GateGuardSentinelService(new CapturingFraudSink());
    const result = await sentinel.evaluateTransaction('guest_chargeback', 100, 'PURCHASE', {
      priorChargeback: true,
    });
    expect(result.decision).toBe('HUMAN_ESCALATE');
    expect(result.reasonCodes).toContain('PRIOR_CHARGEBACK_AUTO_BAR');
  });

  it('uses an injected external scorer when supplied', async () => {
    const externalScorer = {
      scoreTransaction: jest.fn().mockResolvedValue({
        fraudScore: 95,
        welfareScore: 0,
        reasonCodes: ['EXTERNAL_HUMAN_ESCALATE'],
      }),
    };
    const sentinel = new GateGuardSentinelService(new CapturingFraudSink(), externalScorer);
    const result = await sentinel.evaluateTransaction('guest_6', 100, 'EARN');
    expect(externalScorer.scoreTransaction).toHaveBeenCalledTimes(1);
    expect(result.decision).toBe('HUMAN_ESCALATE');
    expect(result.reasonCodes).toEqual(['EXTERNAL_HUMAN_ESCALATE']);
  });

  it('rejects malformed input', async () => {
    const sentinel = new GateGuardSentinelService();
    await expect(sentinel.evaluateTransaction('', 100, 'EARN')).rejects.toThrow(
      /guestId is required/,
    );
    await expect(sentinel.evaluateTransaction('guest_x', -1, 'EARN')).rejects.toThrow(
      /non-negative/,
    );
  });

  it('does not abort the transaction if the fraud-signal sink throws', async () => {
    const sink: FraudSignalSink = {
      emit: () => {
        throw new Error('sink down');
      },
    };
    const sentinel = new GateGuardSentinelService(sink);
    const result = await sentinel.evaluateTransaction(
      'guest_7',
      SENTINEL_THRESHOLDS.highValuePoints + 1,
      'AWARD',
    );
    // The signal sink failed, but the evaluation still produced a decision.
    expect(['APPROVE', 'COOLDOWN']).toContain(result.decision);
  });
});

describe('RedRoomLedgerService.awardPointsWithCompliance (F-024)', () => {
  it('throws AvVerificationRequiredError if AV fails', async () => {
    const sentinel = new GateGuardSentinelService(new CapturingFraudSink());
    const av = new InProcessAccountVerificationService();
    av.block('guest_blocked');

    const ledger = new RedRoomLedgerService(new InMemoryPointsLedgerSink(), {
      sentinel,
      av,
    });

    await expect(
      ledger.awardPointsWithCompliance('guest_blocked', 100, 'welcome'),
    ).rejects.toBeInstanceOf(AvVerificationRequiredError);
    expect(await ledger.getBalance('guest_blocked')).toBe(0);
  });

  it('credits the ledger when AV passes and Sentinel approves', async () => {
    const sentinel = new GateGuardSentinelService(new CapturingFraudSink());
    const ledger = new RedRoomLedgerService(new InMemoryPointsLedgerSink(), {
      sentinel,
    });

    const ok = await ledger.awardPointsWithCompliance('guest_ok', 100, 'welcome');
    expect(ok).toBe(true);
    expect(await ledger.getBalance('guest_ok')).toBe(100);
  });

  it('hard-declines when Sentinel returns HARD_DECLINE — no credit applied', async () => {
    const sentinel = new GateGuardSentinelService(new CapturingFraudSink());
    const ledger = new RedRoomLedgerService(new InMemoryPointsLedgerSink(), {
      sentinel,
    });

    await expect(
      ledger.awardPointsWithCompliance('guest_bad', 6_000, 'milestone', {
        accountAgeDays: 0,
        velocityHigh: true,
      }),
    ).rejects.toBeInstanceOf(SentinelDeclineError);
    expect(await ledger.getBalance('guest_bad')).toBe(0);
  });

  it('legacy zero-arg construction still works (Noop sentinel approves all)', async () => {
    const ledger = new RedRoomLedgerService();
    const ok = await ledger.awardPointsWithCompliance('legacy', 100, 'legacy-grant');
    expect(ok).toBe(true);
    expect(await ledger.getBalance('legacy')).toBe(100);
  });
});

describe('PointsPurchaseService Sentinel gating (F-024)', () => {
  it('runs Sentinel BEFORE writing the audit record on PURCHASE', async () => {
    const events: string[] = [];
    const sentinel = new GateGuardSentinelService({
      emit: () => {
        events.push('signal');
      },
    });
    const sentinelEvalSpy = jest
      .spyOn(sentinel, 'evaluateTransaction')
      .mockImplementation(async (...args) => {
        events.push('sentinel');
        return {
          transactionId: 't',
          guestId: args[0] as string,
          actionType: args[2] as 'PURCHASE',
          points: args[1] as number,
          fraudScore: 0,
          welfareScore: 0,
          decision: 'APPROVE',
          reasonCodes: [],
          ruleAppliedId: 'TEST',
          evaluatedAtUtc: new Date().toISOString(),
        };
      });

    const auditSink = new InMemoryPointsAuditSink();
    const orderingSink = {
      records: auditSink.records,
      async createAuditRecord(record: Parameters<typeof auditSink.createAuditRecord>[0]) {
        events.push('audit');
        return auditSink.createAuditRecord(record);
      },
    };

    const ledger = new RedRoomLedgerService(new InMemoryPointsLedgerSink());
    const originalCredit = ledger.creditPoints.bind(ledger);
    ledger.creditPoints = async (...args) => {
      events.push('credit');
      return originalCredit(...args);
    };

    const purchase = new PointsPurchaseService(ledger, orderingSink, { sentinel });
    await purchase.purchaseBundle('creator_pos', 'starter', true);

    expect(sentinelEvalSpy).toHaveBeenCalledTimes(1);
    expect(events).toEqual(['sentinel', 'audit', 'credit']);
  });

  it('blocks the purchase (no audit, no credit) when Sentinel HARD_DECLINEs', async () => {
    const sentinel = new GateGuardSentinelService(new CapturingFraudSink());
    jest.spyOn(sentinel, 'evaluateTransaction').mockRejectedValueOnce(
      new SentinelDeclineError({
        transactionId: 't',
        guestId: 'creator_neg',
        actionType: 'PURCHASE',
        points: 5_000,
        fraudScore: 100,
        welfareScore: 0,
        decision: 'HARD_DECLINE',
        reasonCodes: ['PRIOR_CHARGEBACK_AUTO_BAR'],
        ruleAppliedId: 'TEST',
        evaluatedAtUtc: new Date().toISOString(),
      }),
    );

    const auditSink = new InMemoryPointsAuditSink();
    const ledger = new RedRoomLedgerService(new InMemoryPointsLedgerSink());
    const purchase = new PointsPurchaseService(ledger, auditSink, { sentinel });

    await expect(purchase.purchaseBundle('creator_neg', 'popular', true)).rejects.toBeInstanceOf(
      SentinelDeclineError,
    );
    expect(auditSink.records).toHaveLength(0);
    expect(await ledger.getBalance('creator_neg')).toBe(0);
  });
});

describe('CreatorGiftingService.createPromotion (F-024)', () => {
  function bootstrap() {
    const ledger = new RedRoomLedgerService(new InMemoryPointsLedgerSink());
    const sentinel = new GateGuardSentinelService(new CapturingFraudSink());
    const gifting = new CreatorGiftingService(ledger, { sentinel });
    return { ledger, sentinel, gifting };
  }

  it('credits the ledger when Sentinel approves', async () => {
    const { ledger, gifting } = bootstrap();
    const result = await gifting.createPromotion('creator_g1', {
      title: 'Spring shoutout',
      pointsAwarded: 250,
    });
    expect(result.ok).toBe(true);
    expect(result.pointsAwarded).toBe(250);
    expect(await ledger.getBalance('creator_g1')).toBe(250);
  });

  it('rejects non-positive point amounts', async () => {
    const { gifting } = bootstrap();
    await expect(
      gifting.createPromotion('creator_g2', { title: 'bad', pointsAwarded: 0 }),
    ).rejects.toThrow(/positive integer/);
  });

  it('blocks creator-initiated awards on HARD_DECLINE', async () => {
    const { ledger, sentinel, gifting } = bootstrap();
    jest.spyOn(sentinel, 'evaluateTransaction').mockRejectedValueOnce(
      new SentinelDeclineError({
        transactionId: 't',
        guestId: 'creator_g3',
        actionType: 'AWARD',
        points: 9_999,
        fraudScore: 100,
        welfareScore: 0,
        decision: 'HARD_DECLINE',
        reasonCodes: ['HIGH_VALUE_POINTS'],
        ruleAppliedId: 'TEST',
        evaluatedAtUtc: new Date().toISOString(),
      }),
    );

    await expect(
      gifting.createPromotion('creator_g3', {
        title: 'Suspicious bonus',
        pointsAwarded: 9_999,
      }),
    ).rejects.toBeInstanceOf(SentinelDeclineError);
    expect(await ledger.getBalance('creator_g3')).toBe(0);
  });
});
