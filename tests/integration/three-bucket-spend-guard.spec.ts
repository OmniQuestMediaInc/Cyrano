/**
 * three-bucket-spend-guard.spec.ts
 * PAYLOAD 6 — Defence-in-depth spend-order middleware.
 */
import { ThreeBucketSpendGuardMiddleware } from '../../services/core-api/src/finance/three-bucket-spend-guard.middleware';

type ReqShape = {
  headers: Record<string, string>;
  body?: Record<string, unknown>;
  path: string;
};

function buildReq(
  spendOrder: string[] | null,
  actorId = 'actor_1',
): ReqShape {
  const headers: Record<string, string> = { 'x-actor-id': actorId };
  const body: Record<string, unknown> = {};
  if (spendOrder) {
    headers['x-spend-order'] = spendOrder.join(',');
    body.spendOrder = spendOrder;
  }
  return {
    headers,
    body,
    path: '/spend/tokens',
  };
}

function buildRes() {
  const status = jest.fn().mockReturnThis();
  const json = jest.fn().mockReturnThis();
  return { status, json } as unknown as {
    status: jest.Mock;
    json: jest.Mock;
  };
}

function buildAudit() {
  const emitted: unknown[] = [];
  return {
    emit: jest.fn(async (params: unknown) => {
      emitted.push(params);
      return { event_id: 'evt', duplicate: false } as never;
    }),
    __emitted: emitted,
  };
}

describe('ThreeBucketSpendGuardMiddleware', () => {
  it('passes through when no explicit plan is attached', async () => {
    const audit = buildAudit();
    const mw = new ThreeBucketSpendGuardMiddleware(audit as never);
    const req = buildReq(null);
    const res = buildRes();
    const next = jest.fn();

    await mw.use(req as never, res as never, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(audit.__emitted).toHaveLength(0);
  });

  it('passes through a canonical spend plan', async () => {
    const audit = buildAudit();
    const mw = new ThreeBucketSpendGuardMiddleware(audit as never);
    const req = buildReq([
      'PROMOTIONAL_BONUS',
      'MEMBERSHIP_ALLOCATION',
      'PURCHASED',
    ]);
    const res = buildRes();
    const next = jest.fn();

    await mw.use(req as never, res as never, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects PURCHASED-before-MEMBERSHIP and emits an audit event', async () => {
    const audit = buildAudit();
    const mw = new ThreeBucketSpendGuardMiddleware(audit as never);
    const req = buildReq(['PURCHASED', 'MEMBERSHIP_ALLOCATION']);
    const res = buildRes();
    const next = jest.fn();

    await mw.use(req as never, res as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(422);
    expect(audit.__emitted).toHaveLength(1);
  });

  it('rejects an unknown bucket name', async () => {
    const audit = buildAudit();
    const mw = new ThreeBucketSpendGuardMiddleware(audit as never);
    const req = buildReq(['LOOT_CRATE']);
    const res = buildRes();
    const next = jest.fn();

    await mw.use(req as never, res as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(422);
  });
});
