// services/velocityzone/src/creator-rate-tier.service.ts
// FIZ: Creator Rate Tier lookup service.
// Resolves the current effective payout rate (floor/ceiling) for a creator.
// Used by the payout engine before tip settlement.
//
// REASON: Mic Drop Strategy — creator rate tier enforcement
// IMPACT: READ-ONLY queries to creator_rate_tiers; no balance columns touched
// CORRELATION_ID: CNZ-WORK-001-CREATOR-RATE-TIER

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import Decimal from 'decimal.js';
import { PrismaService } from '../../core-api/src/prisma.service';
import { GovernanceConfig } from '../../core-api/src/governance/governance.config';

export const CREATOR_RATE_RULE_ID = 'CREATOR_RATE_TIER_v1';

export interface CreatorEffectiveRate {
  tier_name: string;
  rate_floor_usd: Decimal;
  rate_ceiling_usd: Decimal;
  rule_applied_id: string;
}

@Injectable()
export class CreatorRateTierService {
  private readonly logger = new Logger(CreatorRateTierService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve the current payout rate tier for a creator at a given point in time.
   * Returns the founding defaults if no explicit tier row exists (e.g. seeding not yet run).
   *
   * FIZ: Callers must include the returned rule_applied_id in their ledger entry.
   */
  async resolveRate(creatorId: string, asOf: Date = new Date()): Promise<CreatorEffectiveRate> {
    const row = await this.prisma.creatorRateTier.findFirst({
      where: {
        creator_id:      creatorId,
        effective_from:  { lte: asOf },
        OR: [
          { effective_to: null },
          { effective_to: { gt: asOf } },
        ],
      },
      orderBy: { effective_from: 'desc' },
    });

    if (!row) {
      // No explicit tier row — fall back to founding defaults.
      this.logger.warn('CreatorRateTier: no row found, using founding defaults', {
        creatorId,
        asOf: asOf.toISOString(),
      });
      return {
        tier_name:           'FOUNDING',
        rate_floor_usd:   GovernanceConfig.CREATOR_RATE_FOUNDING_FLOOR,
        rate_ceiling_usd: GovernanceConfig.CREATOR_RATE_FOUNDING_CEILING,
        rule_applied_id:  CREATOR_RATE_RULE_ID,
      };
    }

    return {
      tier_name:           row.tier_name,
      rate_floor_usd:   new Decimal(row.rate_floor_usd.toString()),
      rate_ceiling_usd: new Decimal(row.rate_ceiling_usd.toString()),
      rule_applied_id:  row.rule_applied_id,
    };
  }

  /**
   * Seed the founding rate tier for a creator at platform launch.
   * Idempotent: skips if a row for this creator already exists.
   */
  async seedFoundingRate(
    creatorId: string,
    effectiveFrom: Date,
    correlationId: string,
  ): Promise<{ created: boolean }> {
    const existing = await this.prisma.creatorRateTier.findFirst({
      where: { creator_id: creatorId },
    });

    if (existing) {
      return { created: false };
    }

    await this.prisma.creatorRateTier.create({
      data: {
        tier_id:          randomUUID(),
        creator_id:       creatorId,
        tier_name:        'FOUNDING',
        rate_floor_usd:   GovernanceConfig.CREATOR_RATE_FOUNDING_FLOOR,
        rate_ceiling_usd: GovernanceConfig.CREATOR_RATE_FOUNDING_CEILING,
        effective_from:   effectiveFrom,
        effective_to:  null,
        correlation_id:   correlationId,
        reason_code:      'FOUNDING_SEED',
        rule_applied_id:  CREATOR_RATE_RULE_ID,
      },
    });

    return { created: true };
  }
}
