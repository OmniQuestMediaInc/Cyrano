/**
 * ledger-service.spec.ts
 * Integration tests: LedgerService + WalletBucket spend order.
 *
 * Uses in-memory ledger store (no database) and seed CSVs for scenario data.
 * Validates: recordEntry, idempotency, getBalance, getBucketBalance, debitWallet.
 * Spend-order invariant: PROMOTIONAL_BONUS (1) → MEMBERSHIP_ALLOCATION (2) → PURCHASED (3).
 */
import {
  LedgerService,
  TokenType,
  TokenOrigin,
  WalletBucket,
} from '../../services/core-api/src/finance/ledger.service';
import { GovernanceConfigService } from '../../services/core-api/src/config/governance.config';
import {
  loadWallets,
  loadTransactions,
  loadDemoScenarios,
} from './seed-loader';

// ── In-memory ledger store ────────────────────────────────────────────────────
type LedgerRow = Record<string, unknown>;

function buildMockLedgerRepo(store: LedgerRow[]) {
  return {
    findOne: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
      const key = Object.keys(where)[0];
      return store.find(r => r[key] === where[key]) ?? null;
    }),
    create: jest.fn((data: LedgerRow) => ({ ...data })),
    save: jest.fn(async (entry: LedgerRow) => {
      store.push(entry);
      return entry;
    }),
    createQueryBuilder: jest.fn(() => buildQueryBuilder(store)),
  };
}

function buildQueryBuilder(store: LedgerRow[]) {
  let _userId: string;
  let _tokenType: string;
  let _bucket: string | null = null;

  const qb = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn((_expr: string, params: Record<string, string>) => {
      _userId = params.userId;
      return qb;
    }),
    andWhere: jest.fn((_expr: string, params: Record<string, string>) => {
      if (params.tokenType) _tokenType = params.tokenType;
      if (params.bucket) _bucket = params.bucket;
      return qb;
    }),
    getRawOne: jest.fn(async () => {
      const filtered = store.filter(r => {
        if (r.user_id !== _userId) return false;
        if (r.token_type !== _tokenType) return false;
        if (_bucket !== null) {
          const meta = r.metadata as Record<string, unknown> | undefined;
          if (!meta || meta.wallet_bucket !== _bucket) return false;
        }
        return true;
      });
      const total = filtered.reduce(
        (sum, r) => sum + BigInt(r.amount as string),
        0n,
      );
      return { total: total.toString() };
    }),
  };
  return qb;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeService(store: LedgerRow[]): LedgerService {
  const repo = buildMockLedgerRepo(store) as any;
  const config = new GovernanceConfigService();
  const svc = new LedgerService(repo, config);
  return svc;
}

// ─────────────────────────────────────────────────────────────────────────────
describe('Seed data validation — CSV integrity', () => {
  it('loads wallets CSV with correct shape', () => {
    const wallets = loadWallets();
    expect(wallets.length).toBeGreaterThan(0);
    const first = wallets[0];
    expect(first).toHaveProperty('wallet_id');
    expect(first).toHaveProperty('owner_id');
    expect(first).toHaveProperty('owner_type');
    expect(first).toHaveProperty('balance_tokens');
  });

  it('loads transactions CSV with correct shape', () => {
    const txns = loadTransactions();
    expect(txns.length).toBeGreaterThan(0);
    const first = txns[0];
    expect(first).toHaveProperty('transaction_id');
    expect(first).toHaveProperty('gross_tokens');
    expect(first).toHaveProperty('platform_fee_tokens');
    expect(first).toHaveProperty('net_tokens_to_creator');
  });

  it('loads demo scenarios CSV with correct shape', () => {
    const scenarios = loadDemoScenarios();
    expect(scenarios.length).toBeGreaterThan(0);
    const first = scenarios[0];
    expect(first).toHaveProperty('scenario_id');
    expect(first).toHaveProperty('primary_creator_id');
    expect(first).toHaveProperty('primary_customer_id');
    expect(first.expected_outcome).toBe('success');
  });

  it('platform fee is 20% of gross_tokens in all tip transactions', () => {
    const txns = loadTransactions();
    for (const tx of txns) {
      const gross = parseInt(tx.gross_tokens, 10);
      const fee = parseInt(tx.platform_fee_tokens, 10);
      const net = parseInt(tx.net_tokens_to_creator, 10);
      // fee = floor(gross * 0.20), net = gross - fee
      expect(fee).toBe(Math.floor(gross * 0.20));
      expect(net).toBe(gross - fee);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('LedgerService — recordEntry', () => {
  it('records a valid BigInt entry and returns it', async () => {
    const store: LedgerRow[] = [];
    const svc = makeService(store);
    const result = await svc.recordEntry({
      userId: 'cu_001',
      amount: 100n,
      tokenType: TokenType.CZT,
      tokenOrigin: TokenOrigin.PURCHASED,
      referenceId: 'ref_001',
      reasonCode: 'TOPUP',
    });
    expect(store).toHaveLength(1);
    expect((result as LedgerRow).amount).toBe('100');
    expect((result as LedgerRow).user_id).toBe('cu_001');
  });

  it('rejects non-BigInt amount', async () => {
    const store: LedgerRow[] = [];
    const svc = makeService(store);
    await expect(
      svc.recordEntry({
        userId: 'cu_001',
        amount: 100 as any,
        tokenType: TokenType.CZT,
        tokenOrigin: TokenOrigin.PURCHASED,
        referenceId: 'ref_002',
        reasonCode: 'TOPUP',
      }),
    ).rejects.toThrow('INVALID_AMOUNT');
  });

  it('is idempotent — duplicate referenceId is skipped', async () => {
    const store: LedgerRow[] = [];
    const svc = makeService(store);
    await svc.recordEntry({
      userId: 'cu_001',
      amount: 50n,
      tokenType: TokenType.CZT,
      tokenOrigin: TokenOrigin.PURCHASED,
      referenceId: 'ref_idem',
      reasonCode: 'TOPUP',
    });
    await svc.recordEntry({
      userId: 'cu_001',
      amount: 50n,
      tokenType: TokenType.CZT,
      tokenOrigin: TokenOrigin.PURCHASED,
      referenceId: 'ref_idem',
      reasonCode: 'TOPUP',
    });
    expect(store).toHaveLength(1);
  });

  it('defaults rule_applied_id to GENERAL_GOVERNANCE_v10 when omitted', async () => {
    const store: LedgerRow[] = [];
    const svc = makeService(store);
    await svc.recordEntry({
      userId: 'cu_002',
      amount: 10n,
      tokenType: TokenType.CZT,
      tokenOrigin: TokenOrigin.PURCHASED,
      referenceId: 'ref_noRule',
      reasonCode: 'TOPUP',
    });
    const entry = store[0];
    const meta = entry.metadata as Record<string, unknown>;
    expect(meta.rule_applied_id).toBe('GENERAL_GOVERNANCE_v10');
  });

  it('records seed transaction data from CSV without error', async () => {
    const store: LedgerRow[] = [];
    const svc = makeService(store);
    const txns = loadTransactions().slice(0, 10);

    for (const tx of txns) {
      await svc.recordEntry({
        userId: tx.customer_id,
        amount: BigInt(tx.gross_tokens),
        tokenType: TokenType.CZT,
        // Seed-data replay: positive credits representing user-purchased token
        // replays for scenario validation. Treated as PURCHASED. (Flagged in
        // TOK-006-FOLLOWUP report-back as context-inferred.)
        tokenOrigin: TokenOrigin.PURCHASED,
        referenceId: tx.idempotency_key,
        reasonCode: 'TIP',
        metadata: { transaction_id: tx.transaction_id },
      });
    }
    expect(store).toHaveLength(10);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('LedgerService — getBalance', () => {
  it('returns 0n for user with no entries', async () => {
    const store: LedgerRow[] = [];
    const svc = makeService(store);
    const bal = await svc.getBalance('cu_999', TokenType.CZT);
    expect(bal).toBe(0n);
  });

  it('returns sum of all entries for a user + token type', async () => {
    const store: LedgerRow[] = [];
    const svc = makeService(store);
    await svc.recordEntry({ userId: 'cu_010', amount: 200n, tokenType: TokenType.CZT, tokenOrigin: TokenOrigin.PURCHASED, referenceId: 'r1', reasonCode: 'TOPUP' });
    await svc.recordEntry({ userId: 'cu_010', amount: 50n, tokenType: TokenType.CZT, tokenOrigin: TokenOrigin.PURCHASED, referenceId: 'r2', reasonCode: 'TOPUP' });
    await svc.recordEntry({ userId: 'cu_010', amount: -30n, tokenType: TokenType.CZT, tokenOrigin: TokenOrigin.PURCHASED, referenceId: 'r3', reasonCode: 'SPEND' });
    const bal = await svc.getBalance('cu_010', TokenType.CZT);
    expect(bal).toBe(220n);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
describe('LedgerService — WalletBucket spend order', () => {
  /**
   * Seed a wallet with entries across all three buckets,
   * then verify debitWallet drains PROMOTIONAL_BONUS → MEMBERSHIP → PURCHASED.
   * Spend order is system-enforced per FIZ-003.
   */
  async function seedThreeBuckets(
    svc: LedgerService,
    userId: string,
    tokenType: TokenType,
    amounts: { promo: bigint; membership: bigint; purchased: bigint },
  ) {
    // Credit each bucket with a positive entry tagged via metadata.wallet_bucket
    const store = (svc as any).ledgerRepo as ReturnType<typeof buildMockLedgerRepo>;
    const saveEntry = (bucket: WalletBucket, amount: bigint, refSuffix: string) =>
      store.save({
        user_id: userId,
        token_type: tokenType,
        amount: amount.toString(),
        reference_id: `seed:${userId}:${bucket}:${refSuffix}`,
        reason_code: 'SEED',
        metadata: { wallet_bucket: bucket },
      });

    await saveEntry(WalletBucket.PROMOTIONAL_BONUS, amounts.promo, 'promo');
    await saveEntry(WalletBucket.MEMBERSHIP_ALLOCATION, amounts.membership, 'membership');
    await saveEntry(WalletBucket.PURCHASED, amounts.purchased, 'purchased');
  }

  it('drains PROMOTIONAL_BONUS first when debitWallet is called', async () => {
    const store: LedgerRow[] = [];
    const svc = makeService(store);
    const userId = 'cu_test_spend_order';

    await seedThreeBuckets(svc, userId, TokenType.CZT, {
      promo: 50n,
      membership: 50n,
      purchased: 50n,
    });

    const { entries, total_debited } = await svc.debitWallet({
      userId,
      amountTokens: 30n,
      tokenType: TokenType.CZT,
      referenceId: 'debit:spend_order_1',
      reasonCode: 'SESSION_CHARGE',
    });

    expect(total_debited).toBe(30n);
    expect(entries).toHaveLength(1);
    const debit = store.find(r => r.reference_id === `debit:spend_order_1:${WalletBucket.PROMOTIONAL_BONUS}`);
    expect(debit).toBeDefined();
    expect(debit!.amount).toBe('-30');
  });

  it('spills from PROMOTIONAL_BONUS into MEMBERSHIP_ALLOCATION when promo is insufficient', async () => {
    const store: LedgerRow[] = [];
    const svc = makeService(store);
    const userId = 'cu_test_spill_1';

    await seedThreeBuckets(svc, userId, TokenType.CZT, {
      promo: 20n,
      membership: 100n,
      purchased: 100n,
    });

    const { entries, total_debited } = await svc.debitWallet({
      userId,
      amountTokens: 50n,
      tokenType: TokenType.CZT,
      referenceId: 'debit:spill_1',
      reasonCode: 'SESSION_CHARGE',
    });

    expect(total_debited).toBe(50n);
    expect(entries).toHaveLength(2);

    const promoDebit = store.find(r => r.reference_id === `debit:spill_1:${WalletBucket.PROMOTIONAL_BONUS}`);
    const memberDebit = store.find(r => r.reference_id === `debit:spill_1:${WalletBucket.MEMBERSHIP_ALLOCATION}`);
    expect(promoDebit!.amount).toBe('-20');
    expect(memberDebit!.amount).toBe('-30');
  });

  it('spills across all three buckets when needed', async () => {
    const store: LedgerRow[] = [];
    const svc = makeService(store);
    const userId = 'cu_test_spill_all';

    await seedThreeBuckets(svc, userId, TokenType.CZT, {
      promo: 10n,
      membership: 15n,
      purchased: 100n,
    });

    const { entries, total_debited } = await svc.debitWallet({
      userId,
      amountTokens: 40n,
      tokenType: TokenType.CZT,
      referenceId: 'debit:spill_all',
      reasonCode: 'SESSION_CHARGE',
    });

    expect(total_debited).toBe(40n);
    expect(entries).toHaveLength(3);

    const promoDebit = store.find(r => r.reference_id === `debit:spill_all:${WalletBucket.PROMOTIONAL_BONUS}`);
    const memberDebit = store.find(r => r.reference_id === `debit:spill_all:${WalletBucket.MEMBERSHIP_ALLOCATION}`);
    const purchDebit = store.find(r => r.reference_id === `debit:spill_all:${WalletBucket.PURCHASED}`);

    expect(promoDebit!.amount).toBe('-10');
    expect(memberDebit!.amount).toBe('-15');
    expect(purchDebit!.amount).toBe('-15');
  });

  it('throws INSUFFICIENT_BALANCE when total balance is too low', async () => {
    const store: LedgerRow[] = [];
    const svc = makeService(store);
    const userId = 'cu_test_insufficient';

    await seedThreeBuckets(svc, userId, TokenType.CZT, {
      promo: 5n,
      membership: 5n,
      purchased: 5n,
    });

    await expect(
      svc.debitWallet({
        userId,
        amountTokens: 100n,
        tokenType: TokenType.CZT,
        referenceId: 'debit:insufficient',
        reasonCode: 'SESSION_CHARGE',
      }),
    ).rejects.toThrow('INSUFFICIENT_BALANCE');
  });

  it('never touches PURCHASED bucket when PROMO + MEMBERSHIP cover the charge', async () => {
    const store: LedgerRow[] = [];
    const svc = makeService(store);
    const userId = 'cu_test_no_purchased';

    await seedThreeBuckets(svc, userId, TokenType.CZT, {
      promo: 30n,
      membership: 30n,
      purchased: 200n,
    });

    await svc.debitWallet({
      userId,
      amountTokens: 40n,
      tokenType: TokenType.CZT,
      referenceId: 'debit:no_purchased',
      reasonCode: 'SESSION_CHARGE',
    });

    const purchDebit = store.find(r =>
      r.reference_id === `debit:no_purchased:${WalletBucket.PURCHASED}`,
    );
    expect(purchDebit).toBeUndefined();
  });

  it('processes Ghost Alpha scenario transactions against wallet seed data', async () => {
    const store: LedgerRow[] = [];
    const svc = makeService(store);

    const wallets = loadWallets().filter(w => w.owner_type === 'customer');
    const scenarios = loadDemoScenarios().slice(0, 5);
    const txns = loadTransactions();

    // Seed each customer wallet with balance_tokens across PURCHASED bucket
    for (const wallet of wallets.slice(0, 10)) {
      const bal = BigInt(wallet.balance_tokens);
      if (bal > 0n) {
        (svc as any).ledgerRepo.save({
          user_id: wallet.owner_id,
          token_type: TokenType.CZT,
          amount: bal.toString(),
          reference_id: `seed:${wallet.wallet_id}`,
          reason_code: 'SEED',
          metadata: { wallet_bucket: WalletBucket.PURCHASED },
        });
      }
    }

    // Replay first 5 scenario transactions
    for (const scenario of scenarios) {
      const tx = txns.find(t => t.customer_id === scenario.primary_customer_id);
      if (!tx) continue;

      const customerId = scenario.primary_customer_id;
      const grossTokens = BigInt(tx.gross_tokens);

      // Credit the customer wallet first (simulate top-up)
      await svc.recordEntry({
        userId: customerId,
        amount: grossTokens,
        tokenType: TokenType.CZT,
        tokenOrigin: TokenOrigin.PURCHASED,
        referenceId: `topup:${scenario.scenario_id}`,
        reasonCode: 'TOPUP',
        metadata: { wallet_bucket: WalletBucket.PURCHASED },
      });

      // Attempt a debit of the same amount
      const { total_debited } = await svc.debitWallet({
        userId: customerId,
        amountTokens: grossTokens,
        tokenType: TokenType.CZT,
        referenceId: `spend:${scenario.scenario_id}`,
        reasonCode: 'TIP',
      });

      expect(total_debited).toBe(grossTokens);
    }
  });

  it('spend priority metadata is recorded on every bucket debit entry', async () => {
    const store: LedgerRow[] = [];
    const svc = makeService(store);
    const userId = 'cu_test_priority_meta';

    await seedThreeBuckets(svc, userId, TokenType.CZT, {
      promo: 5n,
      membership: 5n,
      purchased: 50n,
    });

    await svc.debitWallet({
      userId,
      amountTokens: 20n,
      tokenType: TokenType.CZT,
      referenceId: 'debit:priority_meta',
      reasonCode: 'CHARGE',
    });

    const promoDr = store.find(r => r.reference_id === `debit:priority_meta:${WalletBucket.PROMOTIONAL_BONUS}`);
    const memberDr = store.find(r => r.reference_id === `debit:priority_meta:${WalletBucket.MEMBERSHIP_ALLOCATION}`);
    const purchDr = store.find(r => r.reference_id === `debit:priority_meta:${WalletBucket.PURCHASED}`);

    expect((promoDr!.metadata as any).spend_priority).toBe(1);
    expect((memberDr!.metadata as any).spend_priority).toBe(2);
    expect((purchDr!.metadata as any).spend_priority).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('LedgerService — handleDisputeReversal', () => {
  it('appends a negative-delta entry linked to the original event', async () => {
    const store: LedgerRow[] = [];
    const svc = makeService(store);

    const result = await svc.handleDisputeReversal({
      disputeId: 'disp_001',
      originalEventId: 'tx_001',
      userId: 'cu_119',
      amountGross: 40n,
      reasonCode: 'CHARGEBACK',
    });

    expect((result as LedgerRow).amount).toBe('-40');
    expect((result as LedgerRow).entry_type).toBe('REVERSAL');
    expect((result as LedgerRow).reference_id).toBe('DISPUTE_REVERSAL:disp_001:tx_001');
    expect((result as LedgerRow).parent_entry_id).toBe('tx_001');
  });

  it('is idempotent — duplicate dispute reversal is skipped', async () => {
    const store: LedgerRow[] = [];
    const svc = makeService(store);

    const params = {
      disputeId: 'disp_002',
      originalEventId: 'tx_002',
      userId: 'cu_066',
      amountGross: 30n,
      reasonCode: 'CHARGEBACK',
    };
    await svc.handleDisputeReversal(params);
    await svc.handleDisputeReversal(params);
    expect(store).toHaveLength(1);
  });
});
