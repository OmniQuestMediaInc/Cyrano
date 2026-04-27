// FIZ: PAYLOAD-001 — Payout / Flicker n'Flame Scoring (FFS) stub
// Settles a creator session at close: reads session CZT, resolves the
// FFS payout rate, and credits the creator wallet's `bonus` bucket
// with the computed USD-equivalent payout recorded in CZT.
// Full FFS engine is in services/ffs/; this module provides the
// deterministic plumbing those consumers will call into.

import type { LedgerService } from './ledger.service';
import type { HeatLevel, LedgerBucket } from './types';
import type { RedbookRateCardService } from './redbook-rate-card.service';

export interface SessionCloseInput {
  sessionId: string;                   // correlation_id root
  creatorWalletId: string;
  grossCzt: number;                    // total CZT earned this session (integer)
  heatScore: number;                   // 0–100 — from FFS scorer
  diamondFloorActive: boolean;         // true when creator has Diamond floor guarantee
}

export interface SessionPayoutResult {
  ledgerBucket: LedgerBucket;          // always 'bonus' for creator payouts
  heatLevel: HeatLevel;
  ratePerToken: number;
  payoutUsd: number;                   // for reporting
  payoutCzt: number;                   // what was credited to the wallet
  appliedFloor: boolean;
  correlationId: string;
}

export class PayoutService {
  constructor(
    private readonly ledger: LedgerService,
    private readonly rateCards: RedbookRateCardService,
  ) {}

  /**
   * Idempotent on `sessionId`: settles the creator share of a session into
   * the creator wallet's bonus bucket. FFS payout rate is resolved once at
   * close-time and persisted in the ledger metadata for later audit.
   */
  async settleSessionClose(input: SessionCloseInput): Promise<SessionPayoutResult> {
    if (!Number.isInteger(input.grossCzt) || input.grossCzt < 0) {
      throw new Error(`grossCzt must be a non-negative integer (got ${input.grossCzt})`);
    }
    if (input.heatScore < 0 || input.heatScore > 100) {
      throw new Error(`heatScore must be 0–100 (got ${input.heatScore})`);
    }

    const rate = this.rateCards.resolveCreatorPayoutRate({
      heatScore: input.heatScore,
      diamondFloorActive: input.diamondFloorActive,
    });

    // Payout USD is grossCzt * ratePerToken; but we credit the creator wallet
    // in CZT, not USD. The CZT figure is identical to grossCzt (platform fee
    // is handled at guest purchase time via REDBOOK margin, not here).
    const correlationId = `PAYOUT:${input.sessionId}`;
    const payoutCzt = input.grossCzt;
    const payoutUsd = payoutCzt * rate.ratePerToken;

    if (payoutCzt > 0) {
      await this.ledger.credit({
        walletId: input.creatorWalletId,
        bucket: 'bonus',
        amount: payoutCzt,
        correlationId,
        reasonCode: 'PAYOUT',
        metadata: {
          session_id: input.sessionId,
          ffs_score: input.heatScore,
          heat_level: rate.level,
          rate_per_token: rate.ratePerToken,
          applied_diamond_floor: rate.appliedFloor,
          payout_usd: payoutUsd,
        },
      });
    }

    return {
      ledgerBucket: 'bonus',
      heatLevel: rate.level,
      ratePerToken: rate.ratePerToken,
      payoutUsd,
      payoutCzt,
      appliedFloor: rate.appliedFloor,
      correlationId,
    };
  }
}
