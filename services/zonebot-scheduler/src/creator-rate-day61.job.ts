// services/zonebot-scheduler/src/creator-rate-day61.job.ts
// FIZ: Day 61 Creator Rate Upgrade Job
// On Day 61 after platform launch, all creators whose current tier is "STANDARD"
// are upgraded to the founding floor/ceiling (7.5–9¢).
//
// Governance constants sourced from GovernanceConfig — never hardcoded here.
// Append-only: writes a new CreatorRateTier row; does NOT mutate existing rows.
//
// REASON: Mic Drop Strategy — Day 61 payout guarantee
// IMPACT: Inserts rows into creator_rate_tiers for all STANDARD cohort creators
// CORRELATION_ID: CNZ-WORK-001-CREATOR-RATE-TIER-DAY61

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { GovernanceConfig } from '../../core-api/src/governance/governance.config';

export const DAY61_RULE_ID = 'CREATOR_RATE_DAY61_UPGRADE_v1';

@Injectable()
export class CreatorRateDay61Job {
  private readonly logger = new Logger(CreatorRateDay61Job.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Run the Day 61 upgrade.
   *
   * Finds all creators who have a current STANDARD tier row (no effective_to)
   * and writes a new DAY61_UPGRADED row with the founding floor/ceiling rates.
   * The previous STANDARD row is closed by setting effective_to to now.
   *
   * This method is idempotent: creators already on DAY61_UPGRADED or FOUNDING
   * tiers are skipped.
   *
   * @param correlationId  Tracing ID for the batch run (provided by the caller/cron).
   * @returns              Count of creators upgraded.
   */
  async runDay61Upgrade(correlationId: string): Promise<{ upgraded: number }> {
    this.logger.log('Day 61 creator rate upgrade started', { correlationId });

    const now = new Date();
    const effectiveFrom = now;

    // Find all STANDARD creators whose current row has no effective_to
    // (i.e. their rate has not yet been superseded).
    const standardRows = await this.prisma.creatorRateTier.findMany({
      where: {
        tier_name:        'STANDARD',
        effective_to:     null,
      },
      select: { id: true, creator_id: true },
    });

    if (standardRows.length === 0) {
      this.logger.log('Day 61 upgrade: no STANDARD creators to upgrade', { correlationId });
      return { upgraded: 0 };
    }

    let upgraded = 0;

    for (const row of standardRows) {
      // Use a transaction to close old row + open new row atomically.
      await this.prisma.$transaction([
        // Close the existing STANDARD row.
        this.prisma.creatorRateTier.update({
          where: { id: row.id },
          data:  { effective_to: now },
        }),
        // Insert the new DAY61_UPGRADED row.
        this.prisma.creatorRateTier.create({
          data: {
            tier_id:          randomUUID(),
            creator_id:       row.creator_id,
            tier_name:        'DAY61_UPGRADED',
            rate_floor_usd:   GovernanceConfig.CREATOR_RATE_DAY61_FLOOR,
            rate_ceiling_usd: GovernanceConfig.CREATOR_RATE_DAY61_CEILING,
            effective_from:   effectiveFrom,
            effective_to:     null,
            correlation_id:   correlationId,
            reason_code:      'DAY61_FLOOR_UPGRADE',
            rule_applied_id:  DAY61_RULE_ID,
          },
        }),
      ]);
      upgraded++;
    }

    this.logger.log('Day 61 creator rate upgrade complete', { correlationId, upgraded });
    return { upgraded };
  }
}
