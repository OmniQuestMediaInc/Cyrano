// WO: WO-032
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Decimal from 'decimal.js';
import { GovernanceConfigService } from '../config/governance.config';
import { GovernanceConfig } from '../governance/governance.config';
import { TipTransaction } from './ledger.types';
import { TokenOrigin } from './types/ledger.types';

export { TokenOrigin };

/**
 * WO-003 / WO-032: Deterministic Ledger Service
 * Implementation of OQMI Doctrine: Append-Only, Deterministic, Idempotent.
 * WO-032 additions: BigInt-only amounts; mandatory rule_applied_id.
 */

/**
 * TokenType — CZT is the only platform currency.
 * ShowZoneTokens (SZT), SHOW_THEATER, and BIJOU token types are retired
 * per Tech Debt Delta 2026-04-16 TOK-001 through TOK-004 and the Single CZT
 * Token Economy spec §2 (feature/single-czt-enforcement-v1).
 *
 * The enum is intentionally narrow (single member) so any code attempting to
 * write a non-CZT value fails the type check. The DB-layer CHECK constraints
 * in migrations 20260426010000 + 20260426200000 are the runtime backstop.
 */
export enum TokenType {
  CZT = 'CZT',
}

/**
 * Immutable token-type literal used as the default on every ledger write.
 * Application code MUST NOT override this value; the column is also pinned
 * to 'CZT' by a DB CHECK constraint.
 */
export const CZT_TOKEN_TYPE: TokenType.CZT = TokenType.CZT;

export enum WalletBucket {
  PROMOTIONAL_BONUS = 'PROMOTIONAL_BONUS', // Priority 1 — spend first
  MEMBERSHIP_ALLOCATION = 'MEMBERSHIP', // Priority 2
  PURCHASED = 'PURCHASED', // Priority 3 — spend last
}

export interface BucketBalance {
  bucket: WalletBucket;
  balance: bigint;
  spendPriority: 1 | 2 | 3;
}

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(
    @InjectRepository('ledger_entries' as never)
    private readonly ledgerRepo: Repository<Record<string, unknown>>,
    private readonly config: GovernanceConfigService,
  ) {}

  /**
   * Records a deterministic, append-only transaction.
   * Source: ChatNowZone_Global_Pricing_Spec_v1_1
   * WO-032: amount MUST be a BigInt; fractional tokens are prohibited.
   *         rule_applied_id defaults to GENERAL_GOVERNANCE_v10 when omitted.
   * TOK-006-FOLLOWUP: tokenOrigin is required on every ledger write — no ledger
   *         entry may omit it. PURCHASED for user top-ups/purchases, GIFTED for
   *         platform grants, promotions, and transfers.
   */
  async recordEntry(data: {
    userId: string;
    amount: bigint;
    /**
     * Optional. Single CZT economy: defaults to CZT_TOKEN_TYPE and any other
     * value is rejected at runtime. Retained as a parameter only so existing
     * call sites keep compiling — see Single CZT Enforcement v1.
     */
    tokenType?: TokenType;
    tokenOrigin: TokenOrigin;
    referenceId: string;
    reasonCode: string;
    ruleAppliedId?: string;
    heatScore?: number;
    diamondFloorActive?: boolean;
    metadata?: Record<string, unknown>;
  }): Promise<unknown> {
    // WO-032: Reject any non-BigInt amount to prevent fractional token entries.
    if (typeof data.amount !== 'bigint') {
      throw new Error(
        'INVALID_AMOUNT: amount must be a BigInt. Fractional tokens are not permitted.',
      );
    }

    // Single CZT economy enforcement: token_type is immutable. Reject any
    // attempt to write a non-CZT value before it can reach the DB CHECK.
    const tokenType: TokenType.CZT = CZT_TOKEN_TYPE;
    if (data.tokenType !== undefined && data.tokenType !== CZT_TOKEN_TYPE) {
      throw new Error(
        `INVALID_TOKEN_TYPE: only '${CZT_TOKEN_TYPE}' is accepted (got '${data.tokenType}'). ` +
          `ShowToken / SZT and all other token types are retired.`,
      );
    }

    // TOK-006-FOLLOWUP: tokenOrigin must be PURCHASED or GIFTED on every write.
    // Defence-in-depth: TS already requires the field, but a JS caller could
    // still slip undefined through. ASC 606 / breakage calc depend on this.
    if (
      data.tokenOrigin !== TokenOrigin.PURCHASED &&
      data.tokenOrigin !== TokenOrigin.GIFTED
    ) {
      throw new Error(
        `INVALID_TOKEN_ORIGIN: tokenOrigin must be 'PURCHASED' or 'GIFTED' (got '${data.tokenOrigin}').`,
      );
    }

    // WO-032: rule_applied_id — default to GENERAL_GOVERNANCE_v10 and warn when omitted.
    const ruleAppliedId = data.ruleAppliedId ?? 'GENERAL_GOVERNANCE_v10';
    if (!data.ruleAppliedId) {
      this.logger.warn('REMEDIATION_REQUIRED: no rule_applied_id provided; defaulting', {
        default: 'GENERAL_GOVERNANCE_v10',
        referenceId: data.referenceId,
      });
    }

    // 1. Idempotency Check: reference_id must be unique per WO-002 schema
    const existing = await this.ledgerRepo.findOne({ where: { reference_id: data.referenceId } });
    if (existing) {
      this.logger.warn(`Transaction reference_id ${data.referenceId} already exists. Skipping.`);
      return existing;
    }

    // 2. Prepare Entry (Enforce America/Toronto context in metadata)
    const entry = this.ledgerRepo.create({
      user_id: data.userId,
      amount: data.amount.toString(), // BigInt compatibility
      token_type: tokenType, // immutable CZT — see CZT_TOKEN_TYPE
      token_origin: data.tokenOrigin, // TOK-006-FOLLOWUP: persisted on every write
      reference_id: data.referenceId,
      reason_code: data.reasonCode,
      metadata: {
        ...data.metadata,
        rule_applied_id: ruleAppliedId,
        token_origin: data.tokenOrigin,
        payout_rate_applied: this.resolvePayoutRate(
          data.heatScore ?? 0,
          data.diamondFloorActive ?? false,
        ),
        governance_timezone: this.config.TIMEZONE,
      },
    });

    // 3. Append Only - The source of truth is the log
    return await this.ledgerRepo.save(entry);
  }

  /**
   * WO-035: Dispute Reversal — appends a negative-delta ledger entry linked to
   * the originating event and the dispute case. The original PAYMENT_AUTHORIZED
   * entry is never modified (Append-Only Doctrine).
   */
  async handleDisputeReversal(data: {
    disputeId: string;
    originalEventId: string;
    userId: string;
    amountGross: bigint;
    reasonCode: string;
    metadata?: Record<string, unknown>;
  }): Promise<unknown> {
    const idempotencyKey = `DISPUTE_REVERSAL:${data.disputeId}:${data.originalEventId}`;

    const existing = await this.ledgerRepo.findOne({
      where: { reference_id: idempotencyKey },
    });
    if (existing) {
      this.logger.warn(
        `Dispute reversal already recorded for dispute_id=${data.disputeId}. Skipping.`,
      );
      return existing;
    }

    const entry = this.ledgerRepo.create({
      user_id: data.userId,
      amount: (-data.amountGross).toString(),
      entry_type: 'REVERSAL',
      status: 'PENDING',
      reference_id: idempotencyKey,
      reason_code: data.reasonCode,
      parent_entry_id: data.originalEventId,
      metadata: {
        ...data.metadata,
        dispute_id: data.disputeId,
        original_event_id: data.originalEventId,
        governance_timezone: this.config.TIMEZONE,
      },
    });

    return await this.ledgerRepo.save(entry);
  }

  /**
   * Derives balance from the sum of ledger entries. tokenType is locked to
   * CZT_TOKEN_TYPE — argument retained for back-compat only.
   */
  async getBalance(userId: string, tokenType: TokenType = CZT_TOKEN_TYPE): Promise<bigint> {
    if (tokenType !== CZT_TOKEN_TYPE) {
      throw new Error(`INVALID_TOKEN_TYPE: only '${CZT_TOKEN_TYPE}' is supported.`);
    }
    const result = await this.ledgerRepo
      .createQueryBuilder('ledger')
      .select('SUM(ledger.amount)', 'total')
      .where('ledger.user_id = :userId', { userId })
      .andWhere('ledger.token_type = :tokenType', { tokenType: CZT_TOKEN_TYPE })
      .getRawOne();

    return BigInt(result?.total || 0);
  }

  /**
   * Maps a WalletBucket to the appropriate TokenOrigin.
   * PURCHASED bucket → PURCHASED (user bought tokens with real money).
   * PROMOTIONAL_BONUS / MEMBERSHIP_ALLOCATION → GIFTED (platform grant or allocation).
   */
  private bucketToOrigin(bucket: WalletBucket): TokenOrigin {
    return bucket === WalletBucket.PURCHASED ? TokenOrigin.PURCHASED : TokenOrigin.GIFTED;
  }

  /**
   * FIZ-003: Three-Bucket Wallet — deterministic spend-order debit.
   * Spend order: PROMOTIONAL_BONUS (1) → MEMBERSHIP_ALLOCATION (2) → PURCHASED (3).
   * This order is system-enforced and cannot be user-selected.
   * Each bucket debit is a separate append-only ledger entry.
   */
  async debitWallet(data: {
    userId: string;
    amountTokens: bigint;
    /** Optional. CZT only — see CZT_TOKEN_TYPE. */
    tokenType?: TokenType;
    referenceId: string;
    reasonCode: string;
    ruleAppliedId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ entries: unknown[]; total_debited: bigint }> {
    if (data.tokenType !== undefined && data.tokenType !== CZT_TOKEN_TYPE) {
      throw new Error(`INVALID_TOKEN_TYPE: only '${CZT_TOKEN_TYPE}' is supported.`);
    }
    const tokenType: TokenType.CZT = CZT_TOKEN_TYPE;
    const SPEND_ORDER: WalletBucket[] = [
      WalletBucket.PROMOTIONAL_BONUS,
      WalletBucket.MEMBERSHIP_ALLOCATION,
      WalletBucket.PURCHASED,
    ];

    let remaining = data.amountTokens;
    const entries: unknown[] = [];

    for (const bucket of SPEND_ORDER) {
      if (remaining <= 0n) break;

      // Derive bucket balance from ledger history
      const bucketBalance = await this.getBucketBalance(data.userId, tokenType, bucket);
      if (bucketBalance <= 0n) continue;

      const debitAmount = remaining < bucketBalance ? remaining : bucketBalance;
      remaining -= debitAmount;

      const entry = await this.recordEntry({
        userId: data.userId,
        amount: -debitAmount,
        tokenType,
        tokenOrigin: this.bucketToOrigin(bucket),
        referenceId: `${data.referenceId}:${bucket}`,
        reasonCode: data.reasonCode,
        ruleAppliedId: data.ruleAppliedId ?? 'THREE_BUCKET_DEBIT_v1',
        metadata: {
          ...data.metadata,
          wallet_bucket: bucket,
          spend_priority: SPEND_ORDER.indexOf(bucket) + 1,
        },
      });
      entries.push(entry);
    }

    if (remaining > 0n) {
      throw new Error(
        `INSUFFICIENT_BALANCE: Could not debit ${data.amountTokens} tokens for user ${data.userId}. ` +
          `Shortfall: ${remaining} tokens across all three buckets.`,
      );
    }

    return { entries, total_debited: data.amountTokens };
  }

  /**
   * Derives balance for a specific wallet bucket from ledger history.
   * Bucket is stored in entry metadata.wallet_bucket.
   * tokenType is locked to CZT — argument retained for back-compat only.
   */
  async getBucketBalance(
    userId: string,
    tokenType: TokenType = CZT_TOKEN_TYPE,
    bucket: WalletBucket,
  ): Promise<bigint> {
    if (tokenType !== CZT_TOKEN_TYPE) {
      throw new Error(`INVALID_TOKEN_TYPE: only '${CZT_TOKEN_TYPE}' is supported.`);
    }
    const result = await this.ledgerRepo
      .createQueryBuilder('ledger')
      .select('SUM(ledger.amount)', 'total')
      .where('ledger.user_id = :userId', { userId })
      .andWhere('ledger.token_type = :tokenType', { tokenType: CZT_TOKEN_TYPE })
      .andWhere("ledger.metadata->>'wallet_bucket' = :bucket", { bucket })
      .getRawOne();

    return BigInt(result?.total || 0);
  }

  /**
   * Returns all three bucket balances for a user in spend-priority order.
   * tokenType is locked to CZT — argument retained for back-compat only.
   */
  async getAllBucketBalances(
    userId: string,
    tokenType: TokenType = CZT_TOKEN_TYPE,
  ): Promise<BucketBalance[]> {
    if (tokenType !== CZT_TOKEN_TYPE) {
      throw new Error(`INVALID_TOKEN_TYPE: only '${CZT_TOKEN_TYPE}' is supported.`);
    }
    const buckets = [
      { bucket: WalletBucket.PROMOTIONAL_BONUS, spendPriority: 1 as const },
      { bucket: WalletBucket.MEMBERSHIP_ALLOCATION, spendPriority: 2 as const },
      { bucket: WalletBucket.PURCHASED, spendPriority: 3 as const },
    ];

    return Promise.all(
      buckets.map(async ({ bucket, spendPriority }) => ({
        bucket,
        balance: await this.getBucketBalance(userId, CZT_TOKEN_TYPE, bucket),
        spendPriority,
      })),
    );
  }

  /**
   * Stub: full implementation pending GM-003 (LedgerService integration).
   * Routes tip through debitWallet() once wallet buckets are wired.
   */
  async recordSplitTip(tx: TipTransaction): Promise<void> {
    this.logger.log('LedgerService: recordSplitTip stub called', {
      userId: tx.userId,
      creatorId: tx.creatorId,
      tokenAmount: tx.tokenAmount,
      correlationId: tx.correlationId,
    });
  }

  /**
   * Resolves payout rate from Room-Heat score per FairPay/FairPlay.
   * Tech Debt Delta 2026-04-16 PAY-001 through PAY-005.
   * Rate is captured at tx_initiated and stored immutably.
   */
  private resolvePayoutRate(heatScore: number, diamondFloorActive: boolean): Decimal {
    let rate: Decimal;

    if (heatScore >= GovernanceConfig.HEAT_BAND_HOT_MAX + 1) {
      rate = GovernanceConfig.RATE_INFERNO;
    } else if (heatScore >= GovernanceConfig.HEAT_BAND_WARM_MAX + 1) {
      rate = GovernanceConfig.RATE_HOT;
    } else if (heatScore >= GovernanceConfig.HEAT_BAND_COLD_MAX + 1) {
      rate = GovernanceConfig.RATE_WARM;
    } else {
      rate = GovernanceConfig.RATE_COLD;
    }

    // Diamond floor guarantee: 10,000+ CZT bulk floors at RATE_WARM minimum.
    // Higher rate applies if heat warrants it.
    if (diamondFloorActive && rate.lessThan(GovernanceConfig.RATE_DIAMOND_FLOOR)) {
      rate = GovernanceConfig.RATE_DIAMOND_FLOOR;
    }

    return rate;
  }
}
