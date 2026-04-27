// FIZ: F-024 — Creator-issued gifting / promotions for RedRoom Rewards
// Allows a creator to issue points (a free promotion / shoutout / milestone
// gift) directly to the RedRoom Rewards ledger. Every issuance is gated by
// the GateGuard Sentinel so unusual award patterns (fraudulent self-gifting,
// promotion abuse, cross-creator collusion) are surfaced before any credit.

import { Injectable, Logger } from '@nestjs/common';
import { RedRoomLedgerService } from './redroom-ledger.service';
import { GateGuardSentinelService, NoopGateGuardSentinel } from './gate-guard-sentinel.service';

export interface CreatorPromotion {
  /** Stable id provided by the creator dashboard. */
  id?: string;
  /** Human-readable title displayed to the recipient. */
  title: string;
  /** Whole-number points to award. */
  pointsAwarded: number;
  /** Optional bag of context (campaign id, audience filter, etc.). */
  metadata?: Record<string, unknown>;
}

export interface CreatorPromotionResult {
  ok: true;
  pointsAwarded: number;
  promotionTitle: string;
}

@Injectable()
export class CreatorGiftingService {
  private readonly logger = new Logger(CreatorGiftingService.name);
  private readonly sentinel: GateGuardSentinelService;

  constructor(
    private readonly ledger: RedRoomLedgerService,
    deps: { sentinel?: GateGuardSentinelService } = {},
  ) {
    this.sentinel = deps.sentinel ?? new NoopGateGuardSentinel();
  }

  async createPromotion(
    creatorId: string,
    promotion: CreatorPromotion,
  ): Promise<CreatorPromotionResult> {
    if (!creatorId) {
      throw new Error('CreatorGiftingService: creatorId is required');
    }
    if (!promotion?.title) {
      throw new Error('CreatorGiftingService: promotion.title is required');
    }
    if (!Number.isInteger(promotion.pointsAwarded) || promotion.pointsAwarded <= 0) {
      throw new Error('CreatorGiftingService: promotion.pointsAwarded must be a positive integer');
    }

    await this.sentinel.evaluateTransaction(creatorId, promotion.pointsAwarded, 'AWARD', {
      promotionType: 'creator-gifting',
      promotionTitle: promotion.title,
    });

    await this.ledger.creditPoints(
      creatorId,
      promotion.pointsAwarded,
      'CREATOR_GIFT',
      promotion.title,
    );

    this.logger.log('CreatorGiftingService: promotion issued', {
      creator_id: creatorId,
      points: promotion.pointsAwarded,
      promotion_title: promotion.title,
    });

    return {
      ok: true,
      pointsAwarded: promotion.pointsAwarded,
      promotionTitle: promotion.title,
    };
  }
}
