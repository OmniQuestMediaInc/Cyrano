/**
 * gateguard-service.spec.ts
 * PAYLOAD 3: GateGuardService — evaluation, persistence, hash chain, NATS.
 *
 * Uses an in-memory Prisma delegate and a stubbed NatsService. No real
 * database or broker connection is required; these are deterministic and
 * hermetic integration tests suitable for CI.
 */
import { createHash } from 'crypto';
import {
  GateGuardService,
  GATEGUARD_GENESIS_HASH,
} from '../../services/core-api/src/gateguard/gateguard.service';
import { GateGuardDeclineError } from '../../services/core-api/src/gateguard/gateguard.types';
import { NATS_TOPICS } from '../../services/nats/topics.registry';

type Row = Record<string, unknown>;

function buildMemoryPrisma() {
  const welfareStore: Row[] = [];
  const logStore: Row[] = [];

  return {
    welfareGuardianScore: {
      findUnique: jest.fn(async ({ where }: { where: Row }) => {
        return welfareStore.find(r => r.transaction_id === where.transaction_id) ?? null;
      }),
      findFirst: jest.fn(async () => null),
      create: jest.fn(async ({ data }: { data: Row }) => {
        const row = { ...data, created_at: new Date() };
        welfareStore.push(row);
        return row;
      }),
    },
    gateGuardLog: {
      findUnique: jest.fn(async () => null),
      findFirst: jest.fn(
        async ({ where, orderBy }: { where: Row; orderBy: Row }) => {
          void orderBy;
          const hits = logStore
            .filter(r => r.transaction_id === where.transaction_id)
            .sort(
              (a, b) =>
                (b.created_at as Date).getTime() -
                (a.created_at as Date).getTime(),
            );
          return hits[0] ?? null;
        },
      ),
      create: jest.fn(async ({ data }: { data: Row }) => {
        const row = { ...data, created_at: new Date() };
        logStore.push(row);
        return row;
      }),
    },
    __stores: { welfareStore, logStore },
  };
}

function buildNatsStub() {
  const published: Array<{ topic: string; payload: unknown }> = [];
  return {
    publish: jest.fn((topic: string, payload: unknown) => {
      published.push({ topic, payload });
    }),
    __published: published,
  };
}

function makeService() {
  const prisma = buildMemoryPrisma();
  const nats = buildNatsStub();
  const svc = new GateGuardService(prisma as any, nats as any);
  return { svc, prisma, nats };
}

describe('GateGuardService.evaluate', () => {
  it('APPROVES a clean purchase and publishes the approval topic', async () => {
    const { svc, prisma, nats } = makeService();
    const result = await svc.evaluate({
      transactionId: 'tx-approve-001',
      correlationId: 'corr-001',
      userId: 'user-001',
      action: 'PURCHASE',
      amountTokens: 100n,
      avStatus: 'VERIFIED',
    });

    expect(result.decision).toBe('APPROVE');
    expect(result.fraudScore).toBe(0);
    expect(result.welfareScore).toBe(0);
    expect(result.ruleAppliedId).toBe('GATEGUARD_SENTINEL_v1');

    // Persisted to both tables.
    expect(prisma.__stores.welfareStore).toHaveLength(1);
    expect(prisma.__stores.logStore).toHaveLength(1);

    // NATS emits APPROVED + evaluation_completed + welfare_signal.
    const topics = nats.__published.map(p => p.topic);
    expect(topics).toContain(NATS_TOPICS.GATEGUARD_EVALUATION_COMPLETED);
    expect(topics).toContain(NATS_TOPICS.GATEGUARD_DECISION_APPROVED);
    expect(topics).toContain(NATS_TOPICS.GATEGUARD_WELFARE_SIGNAL);
  });

  it('routes chargeback-auto-bar to HUMAN_ESCALATE and emits Human Contact Zone event', async () => {
    const { svc, nats } = makeService();
    const result = await svc.evaluate({
      transactionId: 'tx-cb-001',
      correlationId: 'corr-002',
      userId: 'user-002',
      action: 'PURCHASE',
      amountTokens: 100n,
      avStatus: 'VERIFIED',
      fraudSignals: { priorChargeback: true },
    });
    expect(result.decision).toBe('HUMAN_ESCALATE');
    expect(result.fraudScore).toBe(100);

    const topics = nats.__published.map(p => p.topic);
    expect(topics).toContain(NATS_TOPICS.GATEGUARD_DECISION_HUMAN_ESCALATE);
    expect(topics).toContain(NATS_TOPICS.GATEGUARD_HUMAN_CONTACT_ZONE);
  });

  it('COOLDOWN on PENDING AV with a small purchase', async () => {
    const { svc } = makeService();
    const result = await svc.evaluate({
      transactionId: 'tx-cool-001',
      correlationId: 'corr-003',
      userId: 'user-003',
      action: 'PURCHASE',
      amountTokens: 100n,
      avStatus: 'PENDING',
    });
    expect(result.decision).toBe('COOLDOWN');
    expect(result.riskFactors.reasonCodes).toContain('AV_PENDING');
  });

  it('HARD_DECLINE on federated shared-ban list', async () => {
    const { svc } = makeService();
    const result = await svc.evaluate({
      transactionId: 'tx-fed-001',
      correlationId: 'corr-004',
      userId: 'user-004',
      action: 'PURCHASE',
      amountTokens: 100n,
      avStatus: 'VERIFIED',
      federated: { sharedBanList: true },
    });
    expect(result.decision).toBe('HARD_DECLINE');
    expect(result.riskFactors.reasonCodes).toContain('FEDERATED_SHARED_BAN');
  });

  it('idempotent — second call for same transaction_id returns the stored record', async () => {
    const { svc, prisma } = makeService();
    const first = await svc.evaluate({
      transactionId: 'tx-idem-001',
      correlationId: 'corr-005',
      userId: 'user-005',
      action: 'PURCHASE',
      amountTokens: 100n,
      avStatus: 'VERIFIED',
    });

    const second = await svc.evaluate({
      transactionId: 'tx-idem-001',
      correlationId: 'corr-005',
      userId: 'user-005',
      action: 'PURCHASE',
      amountTokens: 100n,
      avStatus: 'VERIFIED',
    });

    expect(second.decision).toBe(first.decision);
    expect(prisma.__stores.welfareStore).toHaveLength(1);
    expect(prisma.__stores.logStore).toHaveLength(1); // no duplicate log append
  });
});

describe('GateGuardService input validation', () => {
  it('rejects non-BigInt amount', async () => {
    const { svc } = makeService();
    await expect(
      svc.evaluate({
        transactionId: 'tx',
        correlationId: 'corr',
        userId: 'user',
        action: 'PURCHASE',
        // @ts-expect-error — intentional to exercise the guard
        amountTokens: 100,
      }),
    ).rejects.toThrow('amountTokens must be a BigInt');
  });

  it('rejects negative amount', async () => {
    const { svc } = makeService();
    await expect(
      svc.evaluate({
        transactionId: 'tx',
        correlationId: 'corr',
        userId: 'user',
        action: 'PURCHASE',
        amountTokens: -1n,
      }),
    ).rejects.toThrow('amountTokens must be non-negative');
  });

  it('rejects unsupported action', async () => {
    const { svc } = makeService();
    await expect(
      svc.evaluate({
        transactionId: 'tx',
        correlationId: 'corr',
        userId: 'user',
        // @ts-expect-error — intentional to exercise the guard
        action: 'WITHDRAW',
        amountTokens: 10n,
      }),
    ).rejects.toThrow("unsupported action 'WITHDRAW'");
  });

  it('rejects missing required fields', async () => {
    const { svc } = makeService();
    await expect(
      svc.evaluate({
        transactionId: '',
        correlationId: 'corr',
        userId: 'user',
        action: 'PURCHASE',
        amountTokens: 10n,
      }),
    ).rejects.toThrow('transactionId is required');
  });
});

describe('GateGuardService.preProcess', () => {
  it('runs the ledger action only when APPROVED', async () => {
    const { svc } = makeService();
    const ledgerFn = jest.fn(async () => 'LEDGER_OK');

    const { output } = await svc.preProcess(
      {
        transactionId: 'tx-pre-001',
        correlationId: 'corr-pre-001',
        userId: 'user-pre-001',
        action: 'SPEND',
        amountTokens: 50n,
        avStatus: 'VERIFIED',
      },
      ledgerFn,
    );

    expect(output).toBe('LEDGER_OK');
    expect(ledgerFn).toHaveBeenCalledTimes(1);
  });

  it('throws GateGuardDeclineError on HARD_DECLINE and never invokes the ledger', async () => {
    const { svc } = makeService();
    const ledgerFn = jest.fn(async () => 'LEDGER_OK');

    await expect(
      svc.preProcess(
        {
          transactionId: 'tx-pre-002',
          correlationId: 'corr-pre-002',
          userId: 'user-pre-002',
          action: 'PURCHASE',
          amountTokens: 100n,
          avStatus: 'VERIFIED',
          fraudSignals: { priorChargeback: true },
        },
        ledgerFn,
      ),
    ).rejects.toBeInstanceOf(GateGuardDeclineError);

    expect(ledgerFn).not.toHaveBeenCalled();
  });

  it('throws GateGuardDeclineError on COOLDOWN and never invokes the ledger', async () => {
    const { svc } = makeService();
    const ledgerFn = jest.fn(async () => 'LEDGER_OK');

    await expect(
      svc.preProcess(
        {
          transactionId: 'tx-pre-003',
          correlationId: 'corr-pre-003',
          userId: 'user-pre-003',
          action: 'PURCHASE',
          amountTokens: 100n,
          avStatus: 'PENDING',
        },
        ledgerFn,
      ),
    ).rejects.toMatchObject({ decision: 'COOLDOWN' });

    expect(ledgerFn).not.toHaveBeenCalled();
  });
});

describe('GateGuardService log hash chain', () => {
  it('first entry links to the genesis hash', async () => {
    const { svc, prisma } = makeService();
    await svc.evaluate({
      transactionId: 'tx-hash-001',
      correlationId: 'corr-hash-001',
      userId: 'user-hash-001',
      action: 'PURCHASE',
      amountTokens: 100n,
      avStatus: 'VERIFIED',
    });

    const log = prisma.__stores.logStore[0];
    expect(log.hash_prior).toBe(GATEGUARD_GENESIS_HASH);
    expect(typeof log.hash_current).toBe('string');
    expect((log.hash_current as string).length).toBe(64);
  });

  it('AV callback appends a link to the same transaction chain', async () => {
    const { svc, prisma } = makeService();
    await svc.evaluate({
      transactionId: 'tx-hash-002',
      correlationId: 'corr-hash-002',
      userId: 'user-hash-002',
      action: 'PURCHASE',
      amountTokens: 100n,
      avStatus: 'PENDING',
    });

    await svc.onAvResult({
      transactionId: 'tx-hash-002',
      correlationId: 'corr-hash-002',
      userId: 'user-hash-002',
      action: 'PURCHASE',
      avStatus: 'VERIFIED',
      providerSignatureId: 'sig-abc-123',
    });

    const logs = prisma.__stores.logStore.filter(
      r => r.transaction_id === 'tx-hash-002',
    );
    expect(logs).toHaveLength(2);
    // Second entry's prior == first entry's current.
    expect(logs[1].hash_prior).toBe(logs[0].hash_current);
  });

  it('current hash is deterministic — recomputing from payload matches stored value', async () => {
    const { svc, prisma } = makeService();
    await svc.evaluate({
      transactionId: 'tx-hash-003',
      correlationId: 'corr-hash-003',
      userId: 'user-hash-003',
      action: 'PURCHASE',
      amountTokens: 100n,
      avStatus: 'VERIFIED',
    });

    const log = prisma.__stores.logStore[0];
    // Re-compute canonical hash (sorted-keys + BigInt-as-string JSON of same shape).
    const canonicalize = (v: unknown): string =>
      JSON.stringify(v, (_k, val) => {
        if (typeof val === 'bigint') return val.toString();
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          const sorted: Record<string, unknown> = {};
          for (const key of Object.keys(val).sort()) {
            sorted[key] = (val as Record<string, unknown>)[key];
          }
          return sorted;
        }
        return val;
      });

    const canonical = canonicalize({
      transaction_id: log.transaction_id,
      correlation_id: log.correlation_id,
      action: log.action,
      decision: log.decision,
      score: log.score,
    });
    const expected = createHash('sha256')
      .update((log.hash_prior as string) + canonical)
      .digest('hex');

    expect(log.hash_current).toBe(expected);
  });
});

describe('GateGuardService AV + escalation integration', () => {
  it('requestFederatedLookup emits a NATS event', () => {
    const { svc, nats } = makeService();
    svc.requestFederatedLookup({
      correlationId: 'corr-fed-001',
      userId: 'user-fed-001',
      action: 'PURCHASE',
      federationVersion: 'v1.0',
    });
    const topics = nats.__published.map(p => p.topic);
    expect(topics).toContain(NATS_TOPICS.GATEGUARD_FEDERATED_LOOKUP);
  });

  it('escalateToHumanContactZone emits the HCZ event with reason codes', () => {
    const { svc, nats } = makeService();
    svc.escalateToHumanContactZone(
      {
        transactionId: 'tx-esc-001',
        correlationId: 'corr-esc-001',
        userId: 'user-esc-001',
        action: 'PURCHASE',
        amountTokens: 500n,
        fraudScore: 50,
        welfareScore: 95,
        decision: 'HUMAN_ESCALATE',
        riskFactors: {
          welfare: {
            score: 95,
            velocityPenalty: 0,
            hoursOfDayPenalty: 0,
            dwellPenalty: 0,
            chaseLossPenalty: 0,
            distressPenalty: 40,
            declinesPenalty: 0,
          },
          fraud: {
            score: 50,
            newAccountPenalty: 0,
            deviceChurnPenalty: 0,
            geoMismatchPenalty: 0,
            vpnPenalty: 0,
            chargebackAutoBar: false,
            disputesPenalty: 0,
            structuringPenalty: 0,
            baselinePenalty: 0,
          },
          avStatus: 'VERIFIED',
          federated: {
            sharedBanList: false,
            crossPlatformFraud: false,
            federationVersion: 'NONE',
          },
          thresholds: { cooldownAt: 40, hardDeclineAt: 70, humanEscalateAt: 90 },
          reasonCodes: ['SELF_REPORTED_DISTRESS'],
        },
        ruleAppliedId: 'GATEGUARD_SENTINEL_v1',
        evaluatedAtUtc: new Date().toISOString(),
      },
      'MANUAL_ESCALATION_TEST',
    );
    const hcz = nats.__published.find(
      p => p.topic === NATS_TOPICS.GATEGUARD_HUMAN_CONTACT_ZONE,
    );
    expect(hcz).toBeDefined();
    expect((hcz!.payload as any).reason_codes).toContain('SELF_REPORTED_DISTRESS');
  });
});
