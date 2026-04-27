// VelocityZone — core service
// Business Plan §3 — time-window events that map FFS score to exact payout rate.
//
// On every tip:
//   1. Check if a VelocityZone event is active for the creator.
//   2. If active: map current FFS score (0–100) to exact rate (floor → ceiling).
//   3. Rate is locked at tip processing time (immutable after tip).
//
// Admin UI defines events (admin-gated). This service reads and evaluates.

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { PrismaService } from '../../core-api/src/prisma.service';
import { NATS_TOPICS } from '../../nats/topics.registry';
import {
  FOUNDING_RATE_CEILING_USD,
  FOUNDING_RATE_FLOOR_USD,
  POST_DAY61_RATE_CEILING_USD,
  POST_DAY61_RATE_FLOOR_USD,
  STANDARD_RATE_CEILING_USD,
  STANDARD_RATE_FLOOR_USD,
  VELOCITYZONE_RULE_ID,
  type CreatorRateTier,
  type VelocityZoneEvent,
  type VelocityZoneRateResult,
} from './velocityzone.types';

@Injectable()
export class VelocityZoneService implements OnModuleInit {
  private readonly logger = new Logger(VelocityZoneService.name);

  /** In-memory cache of active VelocityZone events; refreshed every 30 s. */
  private activeEvents: VelocityZoneEvent[] = [];
  private refreshTimer?: NodeJS.Timeout;

  constructor(
    private readonly nats: NatsService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refreshActiveEvents();
    // Refresh cache every 30 s so new events are picked up without restart.
    this.refreshTimer = setInterval(() => {
      void this.refreshActiveEvents();
    }, 30_000);
    this.logger.log('VelocityZoneService: initialised', {
      rule_applied_id: VELOCITYZONE_RULE_ID,
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Evaluate the payout rate for a tip given the current FFS score.
   * Rate is locked at evaluation time — call at tip processing time.
   * Returns rate_usd = floor (7.5¢) when no VelocityZone event is active.
   */
  async evaluateRate(
    creator_id: string,
    ffs_score: number,
    session_id: string,
  ): Promise<VelocityZoneRateResult> {
    const now   = new Date();
    const event = this.findActiveEvent(creator_id, now);

    if (!event) {
      // No active event — return base rate from creator_rate_tiers.
      const baseRate = await this.getCreatorBaseRate(creator_id);
      const result: VelocityZoneRateResult = {
        active:          false,
        ffs_score,
        rate_usd:        baseRate.rate_floor_usd,
        rule_applied_id: VELOCITYZONE_RULE_ID,
      };
      return result;
    }

    // Map FFS score linearly: 0 → floor, 100 → ceiling.
    const clampedScore = Math.min(100, Math.max(0, ffs_score));
    const rate_usd = +(
      event.rate_floor_usd +
      (clampedScore / 100) * (event.rate_ceiling_usd - event.rate_floor_usd)
    ).toFixed(6);

    const result: VelocityZoneRateResult = {
      active:          true,
      event_id:        event.event_id,
      ffs_score,
      rate_usd,
      rule_applied_id: VELOCITYZONE_RULE_ID,
    };

    this.nats.publish(NATS_TOPICS.VELOCITYZONE_RATE_APPLIED, {
      session_id,
      creator_id,
      event_id:        event.event_id,
      ffs_score,
      rate_usd,
      evaluated_at:    now.toISOString(),
      rule_applied_id: VELOCITYZONE_RULE_ID,
    });

    return result;
  }

  /**
   * Seed the creator_rate_tier table for a new creator.
   * Called during creator onboarding.
   */
  async seedCreatorRateTier(
    creator_id: string,
    is_founding: boolean,
    correlation_id: string,
  ): Promise<CreatorRateTier> {
    const tier_name     = is_founding ? 'FOUNDING' : 'STANDARD';
    const rate_floor    = is_founding ? FOUNDING_RATE_FLOOR_USD : STANDARD_RATE_FLOOR_USD;
    const rate_ceiling  = is_founding ? FOUNDING_RATE_CEILING_USD : STANDARD_RATE_CEILING_USD;
    const now           = new Date();

    const row = await this.prisma.creatorRateTier.create({
      data: {
        tier_id:          randomUUID(),
        creator_id,
        tier_name,
        rate_floor_usd:   rate_floor,
        rate_ceiling_usd: rate_ceiling,
        effective_from:   now,
        correlation_id,
        reason_code:      `CREATOR_RATE_SEED_${tier_name}`,
        rule_applied_id:  VELOCITYZONE_RULE_ID,
      },
    });

    this.logger.log('VelocityZoneService: creator rate tier seeded', {
      creator_id,
      tier_name,
      rate_floor,
    });

    return {
      tier_id:          row.tier_id,
      creator_id:       row.creator_id,
      tier_name:        row.tier_name,
      rate_floor_usd:   Number(row.rate_floor_usd),
      rate_ceiling_usd: Number(row.rate_ceiling_usd),
      effective_from:   row.effective_from.toISOString(),
      effective_to:     row.effective_to?.toISOString(),
      correlation_id:   row.correlation_id,
      reason_code:      row.reason_code,
      rule_applied_id:  row.rule_applied_id,
      created_at:       row.created_at.toISOString(),
    };
  }

  /**
   * Day-61 scheduled job: promote all STANDARD creators to POST_DAY_61 floor.
   * Called by the scheduler service on Day 61 post-launch.
   */
  async promoteDay61Rates(correlation_id: string): Promise<{ updated: number }> {
    const now     = new Date();
    const result  = await this.prisma.creatorRateTier.updateMany({
      where: {
        tier_name:  'STANDARD',
        effective_to: null,
      },
      data: {
        effective_to: now,
      },
    });

    // Insert new POST_DAY_61 rows for all affected creators.
    const expiredRows = await this.prisma.creatorRateTier.findMany({
      where: {
        tier_name:   'STANDARD',
        effective_to: now,
      },
    });

    for (const row of expiredRows) {
      await this.prisma.creatorRateTier.create({
        data: {
          tier_id:          randomUUID(),
          creator_id:       row.creator_id,
          tier_name:        'POST_DAY_61',
          rate_floor_usd:   POST_DAY61_RATE_FLOOR_USD,
          rate_ceiling_usd: POST_DAY61_RATE_CEILING_USD,
          effective_from:   now,
          correlation_id,
          reason_code:      'DAY_61_RATE_PROMOTION',
          rule_applied_id:  VELOCITYZONE_RULE_ID,
        },
      });
    }

    this.logger.log('VelocityZoneService: Day-61 rate promotion complete', {
      updated: result.count,
    });

    return { updated: result.count };
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private findActiveEvent(
    creator_id: string,
    now: Date,
  ): VelocityZoneEvent | undefined {
    return this.activeEvents.find((evt) => {
      const start  = new Date(evt.starts_at);
      const end    = new Date(evt.ends_at);
      const inTime = now >= start && now <= end;
      const creatorMatch =
        evt.creator_ids.length === 0 ||
        evt.creator_ids.includes(creator_id);
      return inTime && creatorMatch;
    });
  }

  private async refreshActiveEvents(): Promise<void> {
    try {
      const now  = new Date();
      const rows = await this.prisma.velocityZoneEvent.findMany({
        where: {
          status:    'ACTIVE',
          starts_at: { lte: now },
          ends_at:   { gte: now },
        },
      });

      this.activeEvents = rows.map((row) => ({
        event_id:         row.event_id,
        name:             row.name,
        starts_at:        row.starts_at.toISOString(),
        ends_at:          row.ends_at.toISOString(),
        rate_floor_usd:   Number(row.rate_floor_usd),
        rate_ceiling_usd: Number(row.rate_ceiling_usd),
        creator_ids:      row.creator_ids,
        status:           row.status as 'ACTIVE',
        created_by:       row.created_by,
        rule_applied_id:  row.rule_applied_id,
        correlation_id:   row.correlation_id,
        reason_code:      row.reason_code,
        created_at:       row.created_at.toISOString(),
      }));

      if (this.activeEvents.length > 0) {
        this.nats.publish(NATS_TOPICS.VELOCITYZONE_EVENT_ACTIVE, {
          active_count:    this.activeEvents.length,
          event_ids:       this.activeEvents.map((e) => e.event_id),
          rule_applied_id: VELOCITYZONE_RULE_ID,
          refreshed_at:    now.toISOString(),
        });
      }
    } catch (err) {
      this.logger.warn('VelocityZoneService: active events refresh failed', {
        error: String(err),
      });
    }
  }

  private async getCreatorBaseRate(
    creator_id: string,
  ): Promise<{ rate_floor_usd: number; rate_ceiling_usd: number }> {
    try {
      const row = await this.prisma.creatorRateTier.findFirst({
        where: {
          creator_id,
          effective_to: null,
        },
        orderBy: { effective_from: 'desc' },
      });

      if (row) {
        return {
          rate_floor_usd:   Number(row.rate_floor_usd),
          rate_ceiling_usd: Number(row.rate_ceiling_usd),
        };
      }
    } catch (err) {
      this.logger.warn('VelocityZoneService: base rate lookup failed', {
        creator_id,
        error: String(err),
      });
    }

    // Fallback to founding rates if no DB row found.
    return {
      rate_floor_usd:   FOUNDING_RATE_FLOOR_USD,
      rate_ceiling_usd: FOUNDING_RATE_CEILING_USD,
    };
  }
}
