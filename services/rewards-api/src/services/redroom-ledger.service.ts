// FIZ: PAYLOAD-012 — RedRoom Rewards points ledger
// Append-only points ledger for creator-owned points. Mirrors the canonical
// LedgerService append-only invariant: entries are never updated or deleted.
//
// Distinct from the three-bucket CZT wallet (services/ledger). The CZT wallet
// is the consumer-facing token economy; this ledger tracks creator REWARDS
// points (RRR). Bundle purchases credit this ledger and queue a USD deduction
// against the creator's next payout (settled by the FFS payout service).

import { Injectable, Logger } from '@nestjs/common';
import {
  GateGuardSentinelService,
  NoopGateGuardSentinel,
  type SentinelContext,
} from './gate-guard-sentinel.service';
import {
  type AccountVerificationService,
  InProcessAccountVerificationService,
} from './account-verification.service';

export type PointsLedgerReason =
  | 'POINTS_PURCHASE'
  | 'POINTS_SPEND'
  | 'POINTS_BONUS'
  | 'POINTS_REFUND'
  | 'REDROOM_REWARDS'
  | 'CREATOR_GIFT';

export interface PointsLedgerEntry {
  id: string;
  creatorId: string;
  amount: number; // signed: +credit, -debit
  reasonCode: PointsLedgerReason;
  description: string;
  createdAt: Date;
}

export interface PointsLedgerSink {
  appendEntry(entry: Omit<PointsLedgerEntry, 'id' | 'createdAt'>): Promise<PointsLedgerEntry>;
  getBalance(creatorId: string): Promise<number>;
}

/**
 * Default in-memory sink. Production wiring substitutes a Prisma-backed
 * implementation; the contract above is the only thing PointsPurchaseService
 * depends on.
 */
export class InMemoryPointsLedgerSink implements PointsLedgerSink {
  private readonly entries: PointsLedgerEntry[] = [];
  private seq = 0;

  async appendEntry(
    entry: Omit<PointsLedgerEntry, 'id' | 'createdAt'>,
  ): Promise<PointsLedgerEntry> {
    const persisted: PointsLedgerEntry = {
      ...entry,
      id: `pts_${++this.seq}`,
      createdAt: new Date(),
    };
    this.entries.push(persisted);
    return persisted;
  }

  async getBalance(creatorId: string): Promise<number> {
    return this.entries
      .filter((e) => e.creatorId === creatorId)
      .reduce((sum, e) => sum + e.amount, 0);
  }

  list(creatorId: string): PointsLedgerEntry[] {
    return this.entries.filter((e) => e.creatorId === creatorId);
  }
}

export class AvVerificationRequiredError extends Error {
  constructor() {
    super('18+ verification required');
    this.name = 'AvVerificationRequiredError';
  }
}

export interface RedRoomLedgerCompliance {
  sentinel?: GateGuardSentinelService;
  av?: AccountVerificationService;
}

@Injectable()
export class RedRoomLedgerService {
  private readonly logger = new Logger(RedRoomLedgerService.name);
  private readonly sentinel: GateGuardSentinelService;
  private readonly av: AccountVerificationService;

  constructor(
    private readonly sink: PointsLedgerSink = new InMemoryPointsLedgerSink(),
    compliance: RedRoomLedgerCompliance = {},
  ) {
    this.sentinel = compliance.sentinel ?? new NoopGateGuardSentinel();
    this.av = compliance.av ?? new InProcessAccountVerificationService();
  }

  async creditPoints(
    creatorId: string,
    points: number,
    reasonCode: PointsLedgerReason,
    description: string,
  ): Promise<boolean> {
    if (!Number.isInteger(points) || points <= 0) {
      throw new Error(`creditPoints: amount must be a positive integer (got ${points})`);
    }
    const entry = await this.sink.appendEntry({
      creatorId,
      amount: points,
      reasonCode,
      description,
    });
    this.logger.log('RedRoomLedgerService: credited points', {
      entry_id: entry.id,
      creator_id: creatorId,
      amount: points,
      reason_code: reasonCode,
    });
    return true;
  }

  async getBalance(creatorId: string): Promise<number> {
    return this.sink.getBalance(creatorId);
  }

  /**
   * Full GateGuard Sentinel-gated award path. Used for system-issued points
   * (RedRoom Rewards onboarding, milestone bonuses, creator-issued promos
   * etc.) where 18+ verification AND fraud/welfare scoring must clear before
   * the ledger is mutated.
   *
   * Throws `AvVerificationRequiredError` if AV fails.
   * Throws `SentinelDeclineError` (from the Sentinel) on HARD_DECLINE.
   */
  async awardPointsWithCompliance(
    guestId: string,
    points: number,
    reason: string,
    context: SentinelContext = {},
  ): Promise<boolean> {
    const avResult = await this.av.verifyAccount(guestId);
    if (!avResult.verified) {
      throw new AvVerificationRequiredError();
    }

    await this.sentinel.evaluateTransaction(guestId, points, 'AWARD', {
      reason,
      ...context,
    });

    return this.creditPoints(guestId, points, 'REDROOM_REWARDS', reason);
  }
}
