// FIZ: PAYLOAD-001 — canonical ledger integration tests
// Covers three-bucket spend order, idempotency, hash chain integrity.

import {
  InMemoryLedgerRepository,
  LedgerService,
  HashChainBrokenError,
  InsufficientBalanceError,
} from '../../services/ledger';

async function bootstrap(userType: 'guest' | 'creator' | 'diamond' = 'guest') {
  const repo = new InMemoryLedgerRepository();
  const ledger = new LedgerService({ repo });
  const wallet = await ledger.bootstrapWallet({
    userId: `user-${Math.random().toString(36).slice(2)}`,
    userType,
    organizationId: 'org_test',
    tenantId: 'tenant_test',
  });
  return { repo, ledger, wallet };
}

async function creditAll(
  ledger: LedgerService,
  walletId: string,
  amounts: { purchased: number; membership: number; bonus: number },
) {
  if (amounts.purchased > 0) {
    await ledger.credit({
      walletId,
      bucket: 'purchased',
      amount: amounts.purchased,
      correlationId: `seed:${walletId}:purchased`,
      reasonCode: 'PURCHASE',
    });
  }
  if (amounts.membership > 0) {
    await ledger.credit({
      walletId,
      bucket: 'membership',
      amount: amounts.membership,
      correlationId: `seed:${walletId}:membership`,
      reasonCode: 'MEMBERSHIP_STIPEND',
    });
  }
  if (amounts.bonus > 0) {
    await ledger.credit({
      walletId,
      bucket: 'bonus',
      amount: amounts.bonus,
      correlationId: `seed:${walletId}:bonus`,
      reasonCode: 'BONUS_GRANT',
    });
  }
}

describe('LedgerService — three-bucket spend order (Payload 1)', () => {
  it('drains PURCHASED first, then MEMBERSHIP, then BONUS', async () => {
    const { ledger, wallet } = await bootstrap();
    await creditAll(ledger, wallet.id, { purchased: 40, membership: 40, bonus: 40 });

    const result = await ledger.spend({
      walletId: wallet.id,
      amount: 30,
      correlationId: 'spend-1',
    });
    expect(result.totalDebited).toBe(30);
    expect(result.breakdown).toEqual({ purchased: 30, membership: 0, bonus: 0 });
  });

  it('spills from PURCHASED into MEMBERSHIP when purchased is exhausted', async () => {
    const { ledger, wallet } = await bootstrap();
    await creditAll(ledger, wallet.id, { purchased: 20, membership: 100, bonus: 100 });

    const result = await ledger.spend({
      walletId: wallet.id,
      amount: 50,
      correlationId: 'spend-2',
    });
    expect(result.breakdown).toEqual({ purchased: 20, membership: 30, bonus: 0 });
  });

  it('spills across all three buckets when needed', async () => {
    const { ledger, wallet } = await bootstrap();
    await creditAll(ledger, wallet.id, { purchased: 10, membership: 15, bonus: 100 });

    const result = await ledger.spend({
      walletId: wallet.id,
      amount: 40,
      correlationId: 'spend-3',
    });
    expect(result.breakdown).toEqual({ purchased: 10, membership: 15, bonus: 15 });
    expect(result.entries).toHaveLength(3);
  });

  it('never touches BONUS when PURCHASED + MEMBERSHIP cover the spend', async () => {
    const { ledger, wallet } = await bootstrap();
    await creditAll(ledger, wallet.id, { purchased: 30, membership: 30, bonus: 200 });

    const result = await ledger.spend({
      walletId: wallet.id,
      amount: 40,
      correlationId: 'spend-4',
    });
    expect(result.breakdown.bonus).toBe(0);
    expect(result.entries).toHaveLength(2);
  });

  it('throws InsufficientBalanceError when total is too low', async () => {
    const { ledger, wallet } = await bootstrap();
    await creditAll(ledger, wallet.id, { purchased: 5, membership: 5, bonus: 5 });

    await expect(
      ledger.spend({ walletId: wallet.id, amount: 100, correlationId: 'spend-5' }),
    ).rejects.toBeInstanceOf(InsufficientBalanceError);
  });

  it('tags every bucket debit with the correct spend_priority (1,2,3)', async () => {
    const { repo, ledger, wallet } = await bootstrap();
    await creditAll(ledger, wallet.id, { purchased: 5, membership: 5, bonus: 50 });

    await ledger.spend({ walletId: wallet.id, amount: 20, correlationId: 'spend-6' });

    const entries = await repo.listLedgerEntries(wallet.id);
    const debits = entries.filter((e) => e.amount < 0);
    const byBucket = Object.fromEntries(
      debits.map((e) => [e.bucket, e.metadata?.spend_priority]),
    );
    expect(byBucket.purchased).toBe(1);
    expect(byBucket.membership).toBe(2);
    expect(byBucket.bonus).toBe(3);
  });
});

describe('LedgerService — idempotency', () => {
  it('returns the same entry on replay of identical credit', async () => {
    const { repo, ledger, wallet } = await bootstrap();
    const a = await ledger.credit({
      walletId: wallet.id,
      bucket: 'purchased',
      amount: 100,
      correlationId: 'dup-1',
      reasonCode: 'PURCHASE',
    });
    const b = await ledger.credit({
      walletId: wallet.id,
      bucket: 'purchased',
      amount: 100,
      correlationId: 'dup-1',
      reasonCode: 'PURCHASE',
    });
    expect(b.entry.id).toBe(a.entry.id);
    const entries = await repo.listLedgerEntries(wallet.id);
    expect(entries).toHaveLength(1);
    expect(entries[0].amount).toBe(100);
  });

  it('replay of spend returns the same breakdown and does not double-debit', async () => {
    const { repo, ledger, wallet } = await bootstrap();
    await creditAll(ledger, wallet.id, { purchased: 50, membership: 50, bonus: 0 });

    const a = await ledger.spend({
      walletId: wallet.id,
      amount: 70,
      correlationId: 'replay-spend',
    });
    const b = await ledger.spend({
      walletId: wallet.id,
      amount: 70,
      correlationId: 'replay-spend',
    });
    expect(b.breakdown).toEqual(a.breakdown);
    expect(b.totalDebited).toBe(a.totalDebited);

    const wallet2 = await repo.findWalletById(wallet.id);
    expect(wallet2?.totalTokens).toBe(30);    // 100 - 70, not 100 - 140
  });

  it('rejects a replay with a diverging payload', async () => {
    const { ledger, wallet } = await bootstrap();
    await ledger.credit({
      walletId: wallet.id,
      bucket: 'purchased',
      amount: 100,
      correlationId: 'diverge-1',
      reasonCode: 'PURCHASE',
    });
    await expect(
      ledger.credit({
        walletId: wallet.id,
        bucket: 'purchased',
        amount: 200,                       // different amount
        correlationId: 'diverge-1',
        reasonCode: 'PURCHASE',
      }),
    ).rejects.toThrow(/IDEMPOTENCY_REPLAY/);
  });
});

describe('LedgerService — hash chain', () => {
  it('computes hash_prev pointing to the previous entry', async () => {
    const { repo, ledger, wallet } = await bootstrap();
    await creditAll(ledger, wallet.id, { purchased: 10, membership: 10, bonus: 10 });

    const entries = await repo.listLedgerEntries(wallet.id);
    expect(entries[0].hashPrev).toBeNull();
    expect(entries[1].hashPrev).toBe(entries[0].hashCurrent);
    expect(entries[2].hashPrev).toBe(entries[1].hashCurrent);
  });

  it('verifyChain() succeeds on a clean wallet', async () => {
    const { ledger, wallet } = await bootstrap();
    await creditAll(ledger, wallet.id, { purchased: 100, membership: 0, bonus: 0 });
    await ledger.spend({ walletId: wallet.id, amount: 30, correlationId: 'sp' });

    await expect(ledger.verifyChain(wallet.id)).resolves.toEqual({ ok: true, entries: 2 });
  });

  it('verifyChain() throws HashChainBrokenError when an entry is tampered', async () => {
    const { repo, ledger, wallet } = await bootstrap();
    await creditAll(ledger, wallet.id, { purchased: 50, membership: 0, bonus: 0 });
    const entries = await repo.listLedgerEntries(wallet.id);
    (entries[0] as { amount: number }).amount = 9999;    // tamper — hash no longer matches

    await expect(ledger.verifyChain(wallet.id)).rejects.toBeInstanceOf(HashChainBrokenError);
  });
});

describe('LedgerService — input validation', () => {
  it('rejects fractional amounts', async () => {
    const { ledger, wallet } = await bootstrap();
    await expect(
      ledger.credit({
        walletId: wallet.id,
        bucket: 'purchased',
        amount: 10.5,
        correlationId: 'frac',
        reasonCode: 'PURCHASE',
      }),
    ).rejects.toThrow(/INVALID_AMOUNT/);
  });

  it('rejects zero-amount entries', async () => {
    const { ledger, wallet } = await bootstrap();
    await expect(
      ledger.record({
        walletId: wallet.id,
        correlationId: 'zero',
        reasonCode: 'PURCHASE',
        amount: 0,
        bucket: 'purchased',
      }),
    ).rejects.toThrow(/INVALID_AMOUNT/);
  });

  it('rejects unknown bucket values', async () => {
    const { ledger, wallet } = await bootstrap();
    await expect(
      ledger.record({
        walletId: wallet.id,
        correlationId: 'badbucket',
        reasonCode: 'PURCHASE',
        amount: 1,
        bucket: 'whatever' as never,
      }),
    ).rejects.toThrow(/INVALID_BUCKET/);
  });
});
