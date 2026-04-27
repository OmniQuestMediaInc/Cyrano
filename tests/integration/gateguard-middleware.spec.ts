/**
 * gateguard-middleware.spec.ts
 * PAYLOAD 3: Pre-Processor middleware — /purchase, /spend, /payout.
 */
import { Request, Response, NextFunction } from 'express';
import { GateGuardMiddleware } from '../../services/core-api/src/gateguard/gateguard.middleware';
import type { GateGuardResult } from '../../services/core-api/src/gateguard/gateguard.types';

function buildResponse() {
  const res: Partial<Response> & { __body?: unknown; __status?: number } = {};
  res.status = jest.fn((code: number) => {
    res.__status = code;
    return res as Response;
  }) as unknown as Response['status'];
  res.json = jest.fn((body: unknown) => {
    res.__body = body;
    return res as Response;
  }) as unknown as Response['json'];
  return res as Response & { __status?: number; __body?: unknown };
}

function buildRequest(overrides: Partial<Request> = {}): Request {
  return {
    path: '/purchase',
    headers: {},
    body: {},
    ...overrides,
  } as Request;
}

function gateGuardStub(result: GateGuardResult | Error) {
  return {
    evaluate: jest.fn(async () => {
      if (result instanceof Error) throw result;
      return result;
    }),
  } as any;
}

function approvedResult(
  action: 'PURCHASE' | 'SPEND' | 'PAYOUT',
  overrides: Partial<GateGuardResult> = {},
): GateGuardResult {
  return {
    transactionId: overrides.transactionId ?? 'tx',
    correlationId: overrides.correlationId ?? 'corr',
    userId: overrides.userId ?? 'user',
    action,
    amountTokens: 100n,
    fraudScore: 0,
    welfareScore: 0,
    decision: 'APPROVE',
    riskFactors: {
      welfare: {
        score: 0,
        velocityPenalty: 0,
        hoursOfDayPenalty: 0,
        dwellPenalty: 0,
        chaseLossPenalty: 0,
        distressPenalty: 0,
        declinesPenalty: 0,
      },
      fraud: {
        score: 0,
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
      reasonCodes: [],
    },
    ruleAppliedId: 'GATEGUARD_SENTINEL_v1',
    evaluatedAtUtc: new Date().toISOString(),
  };
}

describe('GateGuardMiddleware routing', () => {
  it('passes through non-gated routes without calling the service', async () => {
    const svc = gateGuardStub(new Error('should not run'));
    const mw = new GateGuardMiddleware(svc);
    const req = buildRequest({ path: '/some-other-route' });
    const res = buildResponse();
    const next = jest.fn() as NextFunction;

    await mw.use(req as any, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(svc.evaluate).not.toHaveBeenCalled();
  });

  it.each(['/purchase', '/spend', '/payout'])(
    'evaluates on %s and calls next() when APPROVED',
    async (path) => {
      const action = path.slice(1).toUpperCase() as 'PURCHASE' | 'SPEND' | 'PAYOUT';
      const svc = gateGuardStub(approvedResult(action));
      const mw = new GateGuardMiddleware(svc);
      const req = buildRequest({
        path,
        body: {
          transactionId: 'tx-001',
          correlationId: 'corr-001',
          userId: 'user-001',
          amountTokens: '100',
        },
      });
      const res = buildResponse();
      const next = jest.fn() as NextFunction;

      await mw.use(req as any, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(svc.evaluate).toHaveBeenCalledWith(
        expect.objectContaining({
          action,
          transactionId: 'tx-001',
          amountTokens: 100n,
        }),
      );
    },
  );
});

describe('GateGuardMiddleware decline paths', () => {
  it('returns 402 on HARD_DECLINE and does NOT call next()', async () => {
    const result: GateGuardResult = {
      ...approvedResult('PURCHASE', { transactionId: 'tx-hd', correlationId: 'corr-hd' }),
      decision: 'HARD_DECLINE',
    };
    const svc = gateGuardStub(result);
    const mw = new GateGuardMiddleware(svc);
    const req = buildRequest({
      body: {
        transactionId: 'tx-hd',
        correlationId: 'corr-hd',
        userId: 'user-hd',
        amountTokens: '100',
      },
    });
    const res = buildResponse();
    const next = jest.fn() as NextFunction;

    await mw.use(req as any, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.__status).toBe(402);
    expect(res.__body).toMatchObject({
      error: 'GATEGUARD_HARD_DECLINE',
      decision: 'HARD_DECLINE',
      transaction_id: 'tx-hd',
    });
  });

  it('returns 402 on HUMAN_ESCALATE (non-retryable)', async () => {
    const result: GateGuardResult = {
      ...approvedResult('PURCHASE', { transactionId: 'tx-he' }),
      decision: 'HUMAN_ESCALATE',
    };
    const svc = gateGuardStub(result);
    const mw = new GateGuardMiddleware(svc);
    const req = buildRequest({
      body: {
        transactionId: 'tx-he',
        correlationId: 'corr-he',
        userId: 'user-he',
        amountTokens: '100',
      },
    });
    const res = buildResponse();
    const next = jest.fn() as NextFunction;

    await mw.use(req as any, res, next);

    expect(res.__status).toBe(402);
    expect(res.__body).toMatchObject({ decision: 'HUMAN_ESCALATE' });
  });

  it('returns 409 on COOLDOWN (retryable after cool-off)', async () => {
    const result: GateGuardResult = {
      ...approvedResult('PURCHASE', { transactionId: 'tx-cd' }),
      decision: 'COOLDOWN',
    };
    const svc = gateGuardStub(result);
    const mw = new GateGuardMiddleware(svc);
    const req = buildRequest({
      body: {
        transactionId: 'tx-cd',
        correlationId: 'corr-cd',
        userId: 'user-cd',
        amountTokens: '100',
      },
    });
    const res = buildResponse();
    const next = jest.fn() as NextFunction;

    await mw.use(req as any, res, next);

    expect(res.__status).toBe(409);
    expect(res.__body).toMatchObject({ decision: 'COOLDOWN' });
  });
});

describe('GateGuardMiddleware input handling', () => {
  it('rejects malformed amount with 400', async () => {
    const svc = gateGuardStub(approvedResult('PURCHASE'));
    const mw = new GateGuardMiddleware(svc);
    const req = buildRequest({
      body: {
        transactionId: 'tx-bad',
        correlationId: 'corr-bad',
        userId: 'user-bad',
        amountTokens: 'not-a-number',
      },
    });
    const res = buildResponse();
    const next = jest.fn() as NextFunction;

    await mw.use(req as any, res, next);

    expect(svc.evaluate).not.toHaveBeenCalled();
    expect(res.__status).toBe(400);
    expect(res.__body).toMatchObject({ error: 'GATEGUARD_BAD_REQUEST' });
  });

  it('rejects missing transactionId with 400', async () => {
    const svc = gateGuardStub(approvedResult('PURCHASE'));
    const mw = new GateGuardMiddleware(svc);
    const req = buildRequest({
      body: {
        correlationId: 'corr',
        userId: 'user',
        amountTokens: '100',
      },
    });
    const res = buildResponse();
    const next = jest.fn() as NextFunction;

    await mw.use(req as any, res, next);

    expect(res.__status).toBe(400);
    expect(res.__body).toMatchObject({ error: 'GATEGUARD_BAD_REQUEST' });
  });

  it('falls back to headers when body fields are missing', async () => {
    const svc = gateGuardStub(approvedResult('SPEND'));
    const mw = new GateGuardMiddleware(svc);
    const req = buildRequest({
      path: '/spend',
      headers: {
        'x-transaction-id': 'tx-hdr',
        'x-correlation-id': 'corr-hdr',
        'x-user-id': 'user-hdr',
      },
      body: { amountTokens: 50 },
    });
    const res = buildResponse();
    const next = jest.fn() as NextFunction;

    await mw.use(req as any, res, next);

    expect(svc.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: 'tx-hdr',
        correlationId: 'corr-hdr',
        userId: 'user-hdr',
        amountTokens: 50n,
      }),
    );
    expect(next).toHaveBeenCalled();
  });

  it('returns 500 when evaluation itself throws an unexpected error', async () => {
    const svc = gateGuardStub(new Error('database is down'));
    const mw = new GateGuardMiddleware(svc);
    const req = buildRequest({
      body: {
        transactionId: 'tx',
        correlationId: 'corr',
        userId: 'user',
        amountTokens: '100',
      },
    });
    const res = buildResponse();
    const next = jest.fn() as NextFunction;

    await mw.use(req as any, res, next);

    expect(res.__status).toBe(500);
    expect(res.__body).toMatchObject({ error: 'GATEGUARD_EVALUATION_FAILED' });
  });
});
