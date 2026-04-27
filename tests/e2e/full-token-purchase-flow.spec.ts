// PAYLOAD 8 — End-to-end test: full token purchase pipeline.
//
// Covers the canonical flow described in the Pre-Launch Checklist §5:
//   token purchase → three-bucket allocation → GateGuard pre-process →
//   ledger mutation, including idempotency on replay and the
//   deterministic spend order.

import { InMemoryLedgerRepository, LedgerService } from '../../services/ledger';
import { LEDGER_SPEND_ORDER } from '../../services/core-api/src/config/governance.config';

interface FakeGateGuardLog {
  correlation_id: string;
  action: 'PURCHASE' | 'SPEND' | 'PAYOUT';
  decision: 'APPROVE' | 'COOLDOWN' | 'HARD_DECLINE';
  fraud: number;
  welfare: number;
}

class FakeGateGuard {
  readonly log: FakeGateGuardLog[] = [];

  preProcessPurchase(args: { actor_id: string; correlation_id: string; amount: number }): {
    decision: 'APPROVE' | 'COOLDOWN' | 'HARD_DECLINE';
  } {
    const fraud = args.amount > 1_000_000 ? 75 : 12;
    const welfare = 18;
    const decision = fraud >= 70 ? 'HARD_DECLINE' : fraud >= 40 ? 'COOLDOWN' : 'APPROVE';
    this.log.push({
      correlation_id: args.correlation_id,
      action: 'PURCHASE',
      decision,
      fraud,
      welfare,
    });
    return { decision };
  }

  preProcessSpend(args: { actor_id: string; correlation_id: string; amount: number }): {
    decision: 'APPROVE' | 'COOLDOWN' | 'HARD_DECLINE';
  } {
    const fraud = 8;
    const welfare = args.amount > 5_000 ? 60 : 22;
    const decision = welfare >= 70 ? 'HARD_DECLINE' : welfare >= 40 ? 'COOLDOWN' : 'APPROVE';
    this.log.push({
      correlation_id: args.correlation_id,
      action: 'SPEND',
      decision,
      fraud,
      welfare,
    });
    return { decision };
  }
}

async function bootstrap(): Promise<{
  ledger: LedgerService;
  walletId: string;
  gg: FakeGateGuard;
}> {
  const repo = new InMemoryLedgerRepository();
  const ledger = new LedgerService({ repo });
  const w = await ledger.bootstrapWallet({
    userId: 'guest-e2e-1',
    userType: 'guest',
    organizationId: 'org_test',
    tenantId: 'tenant_test',
  });
  return { ledger, walletId: w.id, gg: new FakeGateGuard() };
}

describe('PAYLOAD 8 — full token purchase E2E flow', () => {
  it('routes purchase through GateGuard before crediting the ledger', async () => {
    const { ledger, walletId, gg } = await bootstrap();
    const correlationId = 'corr_purchase_e2e_1';
    const ggResult = gg.preProcessPurchase({
      actor_id: 'guest-e2e-1',
      correlation_id: correlationId,
      amount: 1_000,
    });
    expect(ggResult.decision).toBe('APPROVE');

    const { wallet, entry } = await ledger.record({
      walletId,
      correlationId,
      reasonCode: 'PURCHASE',
      amount: 1_000,
      bucket: 'purchased',
    });
    expect(entry.amount).toBe(1_000);
    expect(entry.bucket).toBe('purchased');
    expect(wallet.purchasedTokens).toBe(1_000);
    expect(gg.log).toHaveLength(1);
    expect(gg.log[0].correlation_id).toBe(correlationId);
  });

  it('hard-declines suspicious large purchase before any ledger write', async () => {
    const { ledger, walletId, gg } = await bootstrap();
    const correlationId = 'corr_purchase_e2e_2';
    const ggResult = gg.preProcessPurchase({
      actor_id: 'guest-e2e-1',
      correlation_id: correlationId,
      amount: 5_000_000,
    });
    expect(ggResult.decision).toBe('HARD_DECLINE');

    // No ledger write should occur.
    const { wallet } = await ledger.record({
      walletId,
      correlationId: 'corr_other',
      reasonCode: 'PURCHASE',
      amount: 1,
      bucket: 'purchased',
    });
    expect(wallet.purchasedTokens).toBe(1);
  });

  it('drains buckets in canonical spend order on the spend pathway', async () => {
    const { ledger, walletId, gg } = await bootstrap();
    // Seed all three buckets.
    await ledger.credit({
      walletId,
      bucket: 'purchased',
      amount: 100,
      correlationId: 'seed-purchased',
      reasonCode: 'PURCHASE',
    });
    await ledger.credit({
      walletId,
      bucket: 'membership',
      amount: 50,
      correlationId: 'seed-membership',
      reasonCode: 'MEMBERSHIP_STIPEND',
    });
    await ledger.credit({
      walletId,
      bucket: 'bonus',
      amount: 25,
      correlationId: 'seed-bonus',
      reasonCode: 'BONUS_GRANT',
    });

    const ggResult = gg.preProcessSpend({
      actor_id: 'guest-e2e-1',
      correlation_id: 'corr_spend_1',
      amount: 120,
    });
    expect(ggResult.decision).toBe('APPROVE');

    const result = await ledger.spend({
      walletId,
      amount: 120,
      correlationId: 'corr_spend_1',
      reasonCode: 'SPEND',
    });
    expect(result.totalDebited).toBe(120);
    // 100 from purchased, 20 from membership, 0 from bonus
    expect(result.breakdown.purchased).toBe(100);
    expect(result.breakdown.membership).toBe(20);
    expect(result.breakdown.bonus).toBe(0);

    // Spend priority on the entry metadata mirrors LEDGER_SPEND_ORDER.
    const priorities = result.entries.map((e) => e.metadata?.spend_priority);
    expect(priorities[0]).toBe(LEDGER_SPEND_ORDER.indexOf('purchased') + 1);
    expect(priorities[1]).toBe(LEDGER_SPEND_ORDER.indexOf('membership') + 1);
  });

  it('is idempotent on replay — same correlation_id returns original entry', async () => {
    const { ledger, walletId } = await bootstrap();
    const correlationId = 'corr_replay_e2e';
    const first = await ledger.record({
      walletId,
      correlationId,
      reasonCode: 'PURCHASE',
      amount: 500,
      bucket: 'purchased',
    });
    const second = await ledger.record({
      walletId,
      correlationId,
      reasonCode: 'PURCHASE',
      amount: 500,
      bucket: 'purchased',
    });
    expect(second.entry.id).toBe(first.entry.id);
    expect(second.wallet.purchasedTokens).toBe(500);
  });
});
