// FIZ: PAYLOAD-012 — Creator Points Bundle Purchase
// Purchases a points bundle for a creator, recording the transaction as a
// pending payout deduction (USD owed back at next FFS settlement).
//
// CEO addendum (2026-04-27): every purchase MUST carry an explicit creator
// authorization (consentConfirmed=true) and produce an immutable audit record
// before any points are credited. No consent → no audit, no credit, error.

import { Injectable, Logger } from '@nestjs/common';
import { findBundle, type PointsBundle } from '../interfaces/redroom-rewards';
import { RedRoomLedgerService } from './redroom-ledger.service';
import { GateGuardSentinelService, NoopGateGuardSentinel } from './gate-guard-sentinel.service';

export type PointsAuditEventType = 'POINTS_PURCHASE_AUTHORIZATION';

export interface PointsAuditRecord {
  type: PointsAuditEventType;
  creatorId: string;
  bundleId: string;
  amountUsd: number;
  pointsAwarded: number;
  consentTimestamp: Date;
  ip?: string;
  userAgent: string;
}

export interface PointsAuditSink {
  createAuditRecord(record: PointsAuditRecord): Promise<void>;
}

/**
 * Default sink — in-memory list, suitable for tests and the rewards-api
 * stub deployment. Production wiring substitutes a sink that forwards to
 * core-api's ImmutableAuditService (event_type=PURCHASE).
 */
export class InMemoryPointsAuditSink implements PointsAuditSink {
  readonly records: PointsAuditRecord[] = [];

  async createAuditRecord(record: PointsAuditRecord): Promise<void> {
    this.records.push(record);
  }
}

export interface PointsPurchaseResult {
  ok: true;
  bundle: PointsBundle;
  pointsCredited: number;
  amountUsdDeductedFromPayout: number;
}

export class ConsentRequiredError extends Error {
  constructor() {
    super('Explicit authorization required');
    this.name = 'ConsentRequiredError';
  }
}

export class InvalidBundleError extends Error {
  constructor(bundleId: string) {
    super(`Invalid bundle: ${bundleId}`);
    this.name = 'InvalidBundleError';
  }
}

@Injectable()
export class PointsPurchaseService {
  private readonly logger = new Logger(PointsPurchaseService.name);
  private readonly clock: () => Date;
  private readonly sentinel: GateGuardSentinelService;

  constructor(
    private readonly ledger: RedRoomLedgerService,
    private readonly auditSink: PointsAuditSink = new InMemoryPointsAuditSink(),
    deps: { clock?: () => Date; sentinel?: GateGuardSentinelService } = {},
  ) {
    this.clock = deps.clock ?? (() => new Date());
    this.sentinel = deps.sentinel ?? new NoopGateGuardSentinel();
  }

  async purchaseBundle(
    creatorId: string,
    bundleId: string,
    consentConfirmed: boolean,
    consentIp?: string,
  ): Promise<PointsPurchaseResult> {
    if (!consentConfirmed) {
      throw new ConsentRequiredError();
    }

    const bundle = findBundle(bundleId);
    if (!bundle) {
      throw new InvalidBundleError(bundleId);
    }

    // GateGuard Sentinel evaluation — fraud/welfare scoring on the purchase
    // pattern. HARD_DECLINE throws a SentinelDeclineError; nothing past this
    // point runs (no audit row, no ledger credit).
    await this.sentinel.evaluateTransaction(creatorId, bundle.points, 'PURCHASE', {
      bundleId: bundle.id,
    });

    // Immutable audit record FIRST — no points are credited unless the
    // authorization is durably recorded.
    await this.auditSink.createAuditRecord({
      type: 'POINTS_PURCHASE_AUTHORIZATION',
      creatorId,
      bundleId: bundle.id,
      amountUsd: bundle.priceUsd,
      pointsAwarded: bundle.points,
      consentTimestamp: this.clock(),
      ip: consentIp,
      userAgent: 'CNZ-creator-dashboard',
    });

    await this.ledger.creditPoints(
      creatorId,
      bundle.points,
      'POINTS_PURCHASE',
      `Purchased ${bundle.name} bundle — $${bundle.priceUsd} deducted from next payout`,
    );

    this.logger.log('PointsPurchaseService: bundle purchased', {
      creator_id: creatorId,
      bundle_id: bundle.id,
      points: bundle.points,
      amount_usd: bundle.priceUsd,
    });

    return {
      ok: true,
      bundle,
      pointsCredited: bundle.points,
      amountUsdDeductedFromPayout: bundle.priceUsd,
    };
  }
}
