// FIZ: PAYLOAD-001 — Recovery Engine integration tests
// Covers 48h warning surfacing, extension / recovery markers, Token Bridge
// 20% bonus, 3/5ths Exit 60% refund + lock, and 70/30 expiry redistribution.

import {
  InMemoryLedgerRepository,
  LedgerService,
  RecoveryService,
} from '../../services/ledger';
import { RECOVERY_ENGINE } from '../../services/core-api/src/config/governance.config';

async function setup(now: Date) {
  const repo = new InMemoryLedgerRepository();
  const clock = () => now;
  const ledger = new LedgerService({ repo, clock });
  const recovery = new RecoveryService({ repo, ledger, clock });
  const wallet = await ledger.bootstrapWallet({
    userId: `u-${Math.random().toString(36).slice(2)}`,
    userType: 'diamond',
    organizationId: 'org',
    tenantId: 'tenant',
  });
  return { repo, ledger, recovery, wallet, clock };
}

describe('RecoveryService — 48h expiry warning window', () => {
  it('surfaces an expiration that lapses within 48 hours', async () => {
    const now = new Date('2026-04-24T12:00:00Z');
    const { repo, recovery, wallet } = await setup(now);

    const expiresAt = new Date(now.getTime() + 24 * 3_600_000);
    await repo.createExpiration({ walletId: wallet.id, tokens: 1_000, expiresAt });

    const pending = await recovery.findExpirationsNeedingWarning(wallet.id);
    expect(pending).toHaveLength(1);
    expect(pending[0].warningWindowOpen).toBe(true);
    expect(pending[0].hoursUntilExpiry).toBeCloseTo(24, 5);
  });

  it('ignores expirations outside the 48h window', async () => {
    const now = new Date('2026-04-24T12:00:00Z');
    const { repo, recovery, wallet } = await setup(now);
    await repo.createExpiration({
      walletId: wallet.id,
      tokens: 500,
      expiresAt: new Date(now.getTime() + 72 * 3_600_000),
    });
    const pending = await recovery.findExpirationsNeedingWarning(wallet.id);
    expect(pending).toHaveLength(0);
  });
});

describe('RecoveryService — extension ($49) and recovery ($79)', () => {
  it('extends an active expiration by EXTENSION_GRANT_DAYS and marks it extended', async () => {
    const now = new Date('2026-04-24T12:00:00Z');
    const { repo, recovery, wallet } = await setup(now);
    const expiresAt = new Date(now.getTime() + 12 * 3_600_000);
    const exp = await repo.createExpiration({ walletId: wallet.id, tokens: 1_000, expiresAt });

    const result = await recovery.extendExpiration({
      walletId: wallet.id,
      expirationId: exp.id,
    });
    expect(result.feeUsd).toBe(RECOVERY_ENGINE.EXTENSION_FEE_USD);
    expect(result.newExpiresAt.getTime()).toBe(
      expiresAt.getTime() + RECOVERY_ENGINE.EXTENSION_GRANT_DAYS * 24 * 3_600_000,
    );

    const active = await repo.listActiveExpirations(wallet.id);
    expect(active).toHaveLength(0);            // extended status is not in "active"
  });

  it('rejects an extension attempt on an already-lapsed expiration', async () => {
    const now = new Date('2026-04-24T12:00:00Z');
    const { repo, recovery, wallet } = await setup(now);
    const exp = await repo.createExpiration({
      walletId: wallet.id,
      tokens: 100,
      expiresAt: new Date(now.getTime() - 3_600_000),      // already expired
    });
    await expect(
      recovery.extendExpiration({ walletId: wallet.id, expirationId: exp.id }),
    ).rejects.toThrow(/ALREADY_EXPIRED/);
  });
});

describe('RecoveryService — Token Bridge', () => {
  it('grants a 20% bonus credit and waives the recovery fee', async () => {
    const now = new Date('2026-04-24T12:00:00Z');
    const { repo, recovery, wallet } = await setup(now);
    const result = await recovery.tokenBridge({
      walletId: wallet.id,
      lapsedTokens: 1_000,
      bridgeId: 'bridge-1',
    });
    expect(result.bonusTokensGranted).toBe(
      Math.floor(1_000 * RECOVERY_ENGINE.TOKEN_BRIDGE_BONUS_PCT),
    );
    expect(result.waived).toBe(true);

    const updatedWallet = await repo.findWalletById(wallet.id);
    expect(updatedWallet?.bonusTokens).toBe(200);
  });

  it('is idempotent on bridgeId', async () => {
    const now = new Date('2026-04-24T12:00:00Z');
    const { repo, recovery, wallet } = await setup(now);
    await recovery.tokenBridge({ walletId: wallet.id, lapsedTokens: 500, bridgeId: 'b-2' });
    await recovery.tokenBridge({ walletId: wallet.id, lapsedTokens: 500, bridgeId: 'b-2' });
    const updated = await repo.findWalletById(wallet.id);
    expect(updated?.bonusTokens).toBe(100);    // 20% of 500, credited exactly once
  });
});

describe('RecoveryService — 3/5ths Exit', () => {
  it('refunds 60% of purchased-bucket CZT and emits a 24h lock', async () => {
    const now = new Date('2026-04-24T12:00:00Z');
    const { repo, ledger, recovery, wallet } = await setup(now);
    await ledger.credit({
      walletId: wallet.id,
      bucket: 'purchased',
      amount: 1_000,
      correlationId: 'seed-purchase',
      reasonCode: 'PURCHASE',
    });

    const result = await recovery.threeFifthsExit({
      walletId: wallet.id,
      purchasedCzt: 1_000,
      unitPriceUsd: 0.12,
      exitId: 'exit-1',
    });
    expect(result.refundedTokens).toBe(600);
    expect(result.refundUsd).toBe(72.0);
    expect(result.lockUntil.getTime()).toBe(
      now.getTime() + RECOVERY_ENGINE.THREE_FIFTHS_LOCK_HOURS * 3_600_000,
    );

    const after = await repo.findWalletById(wallet.id);
    expect(after?.purchasedTokens).toBe(400);   // 1000 - 600 refunded
  });
});

describe('RecoveryService — 70/30 expiry redistribution', () => {
  it('splits expired tokens 70% creator pool / 30% platform', async () => {
    const now = new Date('2026-04-24T12:00:00Z');
    const { repo, ledger, recovery } = await setup(now);

    const creatorPool = await ledger.bootstrapWallet({
      userId: 'creator_pool',
      userType: 'creator',
      organizationId: 'org',
      tenantId: 'tenant',
    });
    const platform = await ledger.bootstrapWallet({
      userId: 'platform_treasury',
      userType: 'creator',
      organizationId: 'org',
      tenantId: 'tenant',
    });

    const subject = await repo.createExpiration({
      walletId: creatorPool.id,
      tokens: 1_000,
      expiresAt: new Date(now.getTime() - 3_600_000),
    });

    const result = await recovery.redistributeExpired({
      expirationId: subject.id,
      tokens: 1_000,
      creatorPoolWalletId: creatorPool.id,
      platformWalletId: platform.id,
    });
    expect(result.creatorPoolCzt).toBe(700);
    expect(result.platformCzt).toBe(300);

    const creatorAfter = await repo.findWalletById(creatorPool.id);
    const platformAfter = await repo.findWalletById(platform.id);
    expect(creatorAfter?.bonusTokens).toBe(700);
    expect(platformAfter?.bonusTokens).toBe(300);
  });
});
