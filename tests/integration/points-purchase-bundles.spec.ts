// FIZ: PAYLOAD-012 — Creator Points Bundles integration tests
// Covers consent gating, immutable audit emission ordering, ledger credit,
// and bundle catalog integrity.

import {
  POINTS_BUNDLES,
  findBundle,
} from '../../services/rewards-api/src/interfaces/redroom-rewards';
import {
  RedRoomLedgerService,
  InMemoryPointsLedgerSink,
} from '../../services/rewards-api/src/services/redroom-ledger.service';
import {
  PointsPurchaseService,
  InMemoryPointsAuditSink,
  ConsentRequiredError,
  InvalidBundleError,
} from '../../services/rewards-api/src/services/points-purchase.service';
import { RrrClientService } from '../../services/core-api/src/rewards/rrr-client.service';

function bootstrap() {
  const ledgerSink = new InMemoryPointsLedgerSink();
  const ledger = new RedRoomLedgerService(ledgerSink);
  const auditSink = new InMemoryPointsAuditSink();
  const purchase = new PointsPurchaseService(ledger, auditSink);
  const client = new RrrClientService(purchase);
  return { ledgerSink, ledger, auditSink, purchase, client };
}

describe('Points bundle catalog (Payload 12)', () => {
  it('exposes the four canonical bundles with correct discount tiers', () => {
    const ids = POINTS_BUNDLES.map((b) => b.id);
    expect(ids).toEqual(['starter', 'popular', 'value', 'elite']);
    expect(findBundle('elite')?.discountPercent).toBe(33);
  });

  it('discount tiers are monotonically non-decreasing as price climbs', () => {
    for (let i = 1; i < POINTS_BUNDLES.length; i++) {
      expect(POINTS_BUNDLES[i].priceUsd).toBeGreaterThan(POINTS_BUNDLES[i - 1].priceUsd);
      expect(POINTS_BUNDLES[i].discountPercent).toBeGreaterThanOrEqual(
        POINTS_BUNDLES[i - 1].discountPercent,
      );
    }
  });
});

describe('PointsPurchaseService (Payload 12)', () => {
  it('rejects purchase without explicit consent — no audit, no credit', async () => {
    const { purchase, auditSink, ledger } = bootstrap();
    await expect(
      purchase.purchaseBundle('creator_1', 'popular', false, '203.0.113.7'),
    ).rejects.toBeInstanceOf(ConsentRequiredError);
    expect(auditSink.records).toHaveLength(0);
    expect(await ledger.getBalance('creator_1')).toBe(0);
  });

  it('rejects unknown bundle id', async () => {
    const { purchase } = bootstrap();
    await expect(purchase.purchaseBundle('creator_1', 'galactic', true)).rejects.toBeInstanceOf(
      InvalidBundleError,
    );
  });

  it('credits points and writes an immutable audit record on consent', async () => {
    const { purchase, ledger, auditSink } = bootstrap();
    const result = await purchase.purchaseBundle('creator_1', 'value', true, '198.51.100.4');

    expect(result.ok).toBe(true);
    expect(result.pointsCredited).toBe(10000);
    expect(result.amountUsdDeductedFromPayout).toBe(95);
    expect(await ledger.getBalance('creator_1')).toBe(10000);

    expect(auditSink.records).toHaveLength(1);
    const record = auditSink.records[0];
    expect(record.type).toBe('POINTS_PURCHASE_AUTHORIZATION');
    expect(record.creatorId).toBe('creator_1');
    expect(record.bundleId).toBe('value');
    expect(record.amountUsd).toBe(95);
    expect(record.pointsAwarded).toBe(10000);
    expect(record.ip).toBe('198.51.100.4');
    expect(record.userAgent).toBe('CNZ-creator-dashboard');
    expect(record.consentTimestamp).toBeInstanceOf(Date);
  });

  it('writes the audit record BEFORE crediting the ledger', async () => {
    const { ledger, auditSink } = bootstrap();
    let auditWrittenAt: number | null = null;
    let creditAttemptedBeforeAudit = false;

    const orderingAudit = {
      records: auditSink.records,
      async createAuditRecord(record: Parameters<typeof auditSink.createAuditRecord>[0]) {
        if (creditAttemptedBeforeAudit) throw new Error('credit fired before audit');
        auditWrittenAt = Date.now();
        await auditSink.createAuditRecord(record);
      },
    };

    const originalCredit = ledger.creditPoints.bind(ledger);
    ledger.creditPoints = async (...args) => {
      if (auditWrittenAt === null) creditAttemptedBeforeAudit = true;
      return originalCredit(...args);
    };

    const purchase = new PointsPurchaseService(ledger, orderingAudit);
    await purchase.purchaseBundle('creator_2', 'starter', true);

    expect(creditAttemptedBeforeAudit).toBe(false);
    expect(auditWrittenAt).not.toBeNull();
  });
});

describe('RrrClientService (CNZ → RRR bridge, Payload 12)', () => {
  it('forwards purchaseBundle through to the underlying service', async () => {
    const { client, auditSink, ledger } = bootstrap();
    const result = await client.purchaseBundle('creator_3', 'elite', true, '192.0.2.10');
    expect(result.pointsCredited).toBe(25000);
    expect(await ledger.getBalance('creator_3')).toBe(25000);
    expect(auditSink.records[0].ip).toBe('192.0.2.10');
  });

  it('exposes the canonical bundle catalog through listBundles()', () => {
    const { client } = bootstrap();
    expect(client.listBundles()).toEqual(POINTS_BUNDLES);
  });
});
