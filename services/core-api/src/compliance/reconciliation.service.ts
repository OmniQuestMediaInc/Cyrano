// services/core-api/src/compliance/reconciliation.service.ts
// INFRA-004: Wallet reconciliation — drift detection only.
// Canonical Corpus v10 Chapter 10, S2.2 + Appendix F (L0 ship-gate).
// Replays the append-only ledger to derive the three-bucket wallet balance
// and compares it against a caller-supplied stored balance. Publishes NATS
// on drift. NO correction logic. NO writes to ledger or balance columns.
//
// Design note: no "stored wallet" table exists in the current schema — all
// balances are derived from ledger history (see LedgerService). The stored
// balance must therefore be provided by the caller (for example, a cache
// snapshot, a denormalized projection, or an external reconciliation input).
// detectDrift() and buildReport() take an explicit stored_balance parameter
// for this reason.
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NatsService } from '../nats/nats.service';
import { NATS_TOPICS } from '../../../nats/topics.registry';
import { PrismaService } from '../prisma.service';

const RULE_ID = 'RECONCILIATION_v1';

export type WalletBucket = 'PROMOTIONAL' | 'MEMBERSHIP' | 'PURCHASED';

export interface WalletBalance {
  user_id: string;
  promotional_bonus_cents: bigint;
  membership_allocation_cents: bigint;
  purchased_tokens_cents: bigint;
  computed_at_utc: string;
}

export interface DriftByBucket {
  promotional_bonus_cents: bigint;
  membership_allocation_cents: bigint;
  purchased_tokens_cents: bigint;
}

export interface ReconciliationResult {
  drift_detected: boolean;
  drift_by_bucket: DriftByBucket;
  rule_applied_id: string;
}

export interface ReconciliationReport {
  report_id: string;
  user_id: string;
  drift_detected: boolean;
  computed_balance: WalletBalance;
  stored_balance: WalletBalance;
  drift_by_bucket: DriftByBucket;
  generated_at_utc: string;
  rule_applied_id: string;
}

/**
 * Normalizes the wallet_bucket metadata value (as emitted by LedgerService
 * in the three-bucket debit path, WO-032) to the canonical reconciliation
 * bucket identifier. Returns null when the entry is not bucket-tagged and
 * must therefore be excluded from reconciliation.
 */
function normalizeBucket(raw: unknown): WalletBucket | null {
  if (typeof raw !== 'string') return null;
  const upper = raw.toUpperCase();
  if (upper === 'PROMOTIONAL' || upper === 'PROMOTIONAL_BONUS') {
    return 'PROMOTIONAL';
  }
  if (upper === 'MEMBERSHIP' || upper === 'MEMBERSHIP_ALLOCATION') {
    return 'MEMBERSHIP';
  }
  if (upper === 'PURCHASED' || upper === 'PURCHASED_TOKENS') {
    return 'PURCHASED';
  }
  return null;
}

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    private readonly nats: NatsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Replays the append-only ledger for a user and derives the three-bucket
   * wallet balance. Read-only — issues a single findMany and sums in memory.
   * Entries without a recognizable wallet_bucket in metadata are excluded.
   */
  async computeBalanceFromLedger(accountId: string): Promise<WalletBalance> {
    const entries = await this.prisma.ledgerEntry.findMany({
      where: { user_id: accountId },
      select: {
        net_amount_cents: true,
        metadata: true,
      },
    });

    let promotional = 0n;
    let membership = 0n;
    let purchased = 0n;

    for (const entry of entries) {
      const meta = (entry.metadata ?? {}) as Record<string, unknown>;
      const bucket = normalizeBucket(meta.wallet_bucket);
      if (bucket === null) continue;

      // net_amount_cents is a signed BigInt — positive = credit, negative = debit.
      // Append-only reversal entries are stored as negative amounts by the
      // LedgerService dispute-reversal path, so summation naturally handles them.
      const amount = BigInt(entry.net_amount_cents);

      if (bucket === 'PROMOTIONAL') promotional += amount;
      else if (bucket === 'MEMBERSHIP') membership += amount;
      else purchased += amount;
    }

    const balance: WalletBalance = {
      user_id: accountId,
      promotional_bonus_cents: promotional,
      membership_allocation_cents: membership,
      purchased_tokens_cents: purchased,
      computed_at_utc: new Date().toISOString(),
    };

    this.logger.log('ReconciliationService: balance computed from ledger', {
      user_id: accountId,
      entries_replayed: entries.length,
      promotional_bonus_cents: promotional.toString(),
      membership_allocation_cents: membership.toString(),
      purchased_tokens_cents: purchased.toString(),
      rule_applied_id: RULE_ID,
    });

    return balance;
  }

  /**
   * Detects drift between the ledger-computed balance and a caller-supplied
   * stored balance. Publishes NATS on drift. DRIFT DETECTION ONLY — this
   * method never writes to any ledger or balance column and contains no
   * correction logic.
   */
  async detectDrift(
    accountId: string,
    stored_balance: WalletBalance,
  ): Promise<ReconciliationResult> {
    const computed = await this.computeBalanceFromLedger(accountId);

    const drift_by_bucket: DriftByBucket = {
      promotional_bonus_cents:
        computed.promotional_bonus_cents - stored_balance.promotional_bonus_cents,
      membership_allocation_cents:
        computed.membership_allocation_cents - stored_balance.membership_allocation_cents,
      purchased_tokens_cents:
        computed.purchased_tokens_cents - stored_balance.purchased_tokens_cents,
    };

    const drift_detected =
      drift_by_bucket.promotional_bonus_cents !== 0n ||
      drift_by_bucket.membership_allocation_cents !== 0n ||
      drift_by_bucket.purchased_tokens_cents !== 0n;

    if (drift_detected) {
      const detected_at_utc = new Date().toISOString();
      this.logger.error('ReconciliationService: DRIFT DETECTED', {
        user_id: accountId,
        drift_by_bucket: {
          promotional_bonus_cents: drift_by_bucket.promotional_bonus_cents.toString(),
          membership_allocation_cents: drift_by_bucket.membership_allocation_cents.toString(),
          purchased_tokens_cents: drift_by_bucket.purchased_tokens_cents.toString(),
        },
        detected_at_utc,
        rule_applied_id: RULE_ID,
      });

      this.nats.publish(NATS_TOPICS.RECONCILIATION_DRIFT_DETECTED, {
        user_id: accountId,
        computed_balance: {
          promotional_bonus_cents: computed.promotional_bonus_cents.toString(),
          membership_allocation_cents: computed.membership_allocation_cents.toString(),
          purchased_tokens_cents: computed.purchased_tokens_cents.toString(),
          computed_at_utc: computed.computed_at_utc,
        },
        stored_balance: {
          promotional_bonus_cents: stored_balance.promotional_bonus_cents.toString(),
          membership_allocation_cents: stored_balance.membership_allocation_cents.toString(),
          purchased_tokens_cents: stored_balance.purchased_tokens_cents.toString(),
          computed_at_utc: stored_balance.computed_at_utc,
        },
        drift_by_bucket: {
          promotional_bonus_cents: drift_by_bucket.promotional_bonus_cents.toString(),
          membership_allocation_cents: drift_by_bucket.membership_allocation_cents.toString(),
          purchased_tokens_cents: drift_by_bucket.purchased_tokens_cents.toString(),
        },
        detected_at_utc,
        rule_applied_id: RULE_ID,
      });
    }

    return {
      drift_detected,
      drift_by_bucket,
      rule_applied_id: RULE_ID,
    };
  }

  /**
   * Produces a structured reconciliation report for the given user against a
   * caller-supplied stored balance. Read-only — no writes anywhere. The
   * returned report carries both balances and the per-bucket drift.
   */
  async buildReport(params: {
    user_id: string;
    stored_balance: WalletBalance;
  }): Promise<ReconciliationReport> {
    const computed = await this.computeBalanceFromLedger(params.user_id);

    const drift_by_bucket: DriftByBucket = {
      promotional_bonus_cents:
        computed.promotional_bonus_cents - params.stored_balance.promotional_bonus_cents,
      membership_allocation_cents:
        computed.membership_allocation_cents - params.stored_balance.membership_allocation_cents,
      purchased_tokens_cents:
        computed.purchased_tokens_cents - params.stored_balance.purchased_tokens_cents,
    };

    const drift_detected =
      drift_by_bucket.promotional_bonus_cents !== 0n ||
      drift_by_bucket.membership_allocation_cents !== 0n ||
      drift_by_bucket.purchased_tokens_cents !== 0n;

    if (drift_detected) {
      // Re-emit the NATS event via detectDrift's pathway equivalent so that
      // building a report is also an alerting action — preserves the invariant
      // that any drift observation escalates.
      const detected_at_utc = new Date().toISOString();
      this.logger.error('ReconciliationService: report generated with drift', {
        user_id: params.user_id,
        rule_applied_id: RULE_ID,
      });
      this.nats.publish(NATS_TOPICS.RECONCILIATION_DRIFT_DETECTED, {
        user_id: params.user_id,
        computed_balance: {
          promotional_bonus_cents: computed.promotional_bonus_cents.toString(),
          membership_allocation_cents: computed.membership_allocation_cents.toString(),
          purchased_tokens_cents: computed.purchased_tokens_cents.toString(),
          computed_at_utc: computed.computed_at_utc,
        },
        stored_balance: {
          promotional_bonus_cents: params.stored_balance.promotional_bonus_cents.toString(),
          membership_allocation_cents: params.stored_balance.membership_allocation_cents.toString(),
          purchased_tokens_cents: params.stored_balance.purchased_tokens_cents.toString(),
          computed_at_utc: params.stored_balance.computed_at_utc,
        },
        drift_by_bucket: {
          promotional_bonus_cents: drift_by_bucket.promotional_bonus_cents.toString(),
          membership_allocation_cents: drift_by_bucket.membership_allocation_cents.toString(),
          purchased_tokens_cents: drift_by_bucket.purchased_tokens_cents.toString(),
        },
        detected_at_utc,
        rule_applied_id: RULE_ID,
      });
    }

    return {
      report_id: randomUUID(),
      user_id: params.user_id,
      drift_detected,
      computed_balance: computed,
      stored_balance: params.stored_balance,
      drift_by_bucket,
      generated_at_utc: new Date().toISOString(),
      rule_applied_id: RULE_ID,
    };
  }
}
