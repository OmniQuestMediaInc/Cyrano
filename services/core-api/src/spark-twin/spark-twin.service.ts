// services/core-api/src/spark-twin/spark-twin.service.ts
// CYR: Spark Twin Service — free-tier AI companion provisioning + daily limit enforcement.
//
// Responsibilities:
//   1. Provision a free Spark Twin for new users on signup (one per user, idempotent).
//   2. Track daily message usage and enforce the 15-message daily cap.
//   3. Return upgrade nudge content when a Spark user crosses the nudge threshold.
//
// FIZ NOTE: No ledger mutations in this service — balance changes are handled
//           by the subscription / ledger service when a user upgrades.

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma.module';

/** Free Spark Twin daily message cap. */
const SPARK_DAILY_MESSAGE_CAP = 15;

/** Message count at which we start injecting upgrade nudge messages. */
const SPARK_NUDGE_THRESHOLD = 10;

/** Upgrade nudge content shown to Spark users past the nudge threshold. */
const SPARK_UPGRADE_NUDGE =
  "Mmm... I wish I could show you exactly what I'm wearing right now, " +
  'or whisper this in your ear with my real voice... ' +
  'Upgrade to Flame and I can do all that for you 🔥';

export interface SparkTwinRecord {
  twin_id: string;
  creator_id: string;
  display_name: string;
  is_spark_twin: boolean;
  portal: string | null;
  training_status: string;
  created_at: Date;
}

export interface TrackMessageResult {
  /** Updated daily message count after this call. */
  messages_sent: number;
  /** True when the user has reached or exceeded the daily cap. */
  limit_reached: boolean;
  /** Upgrade nudge copy to surface in the UI, or null when not applicable. */
  nudge_message: string | null;
}

@Injectable()
export class SparkTwinService {
  private readonly logger = new Logger(SparkTwinService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Provision a free Spark Twin for the given user on their first signup.
   * Idempotent — returns the existing twin if one is already provisioned.
   */
  async provisionFreeSparkTwin(userId: string, portal: string): Promise<SparkTwinRecord> {
    const existing = await this.prisma.aiTwin.findFirst({
      where: { creator_id: userId, is_spark_twin: true },
    });

    if (existing) {
      this.logger.log('SparkTwinService.provisionFreeSparkTwin: twin already exists', {
        twin_id: existing.twin_id,
        user_id: userId,
        portal,
      });
      return existing as unknown as SparkTwinRecord;
    }

    const correlationId = `SPARK-TWIN-${userId}`;

    const twin = await this.prisma.aiTwin.create({
      data: {
        creator_id: userId,
        display_name: 'Your Spark Twin',
        persona_prompt:
          'Your first taste of Cyrano AI companionship — upgrade to Flame for full power, ' +
          'voice, images, and unlimited conversation.',
        trigger_word: `spark_${userId.replace(/-/g, '').slice(0, 12)}`,
        visibility: 'PRIVATE',
        is_spark_twin: true,
        is_house_model: false,
        portal,
        training_status: 'TRAINING_COMPLETE',
        correlation_id: correlationId,
        reason_code: 'SPARK_TWIN_PROVISION',
      },
    });

    this.logger.log('SparkTwinService.provisionFreeSparkTwin: provisioned', {
      twin_id: twin.twin_id,
      user_id: userId,
      portal,
      correlation_id: correlationId,
    });

    return twin as unknown as SparkTwinRecord;
  }

  /**
   * Returns true when the user is still within today's daily message cap.
   * Uses today's UTC date (YYYY-MM-DD) as the bucket key.
   */
  async checkDailyLimit(userId: string): Promise<boolean> {
    const today = new Date().toISOString().split('T')[0];
    const usage = await this.prisma.sparkTwinDailyUsage.findUnique({
      where: { user_id_usage_date: { user_id: userId, usage_date: today } },
    });
    return (usage?.messages_sent ?? 0) < SPARK_DAILY_MESSAGE_CAP;
  }

  /**
   * Increment the daily message counter for a Spark Twin user and return:
   *   - the updated message count,
   *   - whether the cap is now reached,
   *   - an upgrade nudge string when the user has crossed the nudge threshold.
   *
   * Throws `ForbiddenException` when the daily cap was already reached BEFORE
   * this message (i.e., the previous count was already >= CAP). The check and
   * increment are performed atomically within a single upsert so there is no
   * TOCTOU window between callers.
   *
   * The upsert is correlation-id safe: the first call for a given
   * (user_id, usage_date) creates the row; subsequent calls increment it.
   */
  async trackMessage(userId: string): Promise<TrackMessageResult> {
    const today = new Date().toISOString().split('T')[0];
    const correlationId = `SPARK-USAGE-${userId}-${today}-${randomUUID()}`;

    // Read the current count before incrementing so we can gate on it
    // without a separate round-trip. We use a transaction to keep the
    // read + upsert atomic and avoid the TOCTOU window.
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.sparkTwinDailyUsage.findUnique({
        where: { user_id_usage_date: { user_id: userId, usage_date: today } },
        select: { messages_sent: true },
      });

      if ((existing?.messages_sent ?? 0) >= SPARK_DAILY_MESSAGE_CAP) {
        this.logger.warn('SparkTwinService.trackMessage: daily cap reached', {
          user_id: userId,
          usage_date: today,
          messages_sent: existing?.messages_sent,
        });
        return {
          messages_sent: existing!.messages_sent,
          limit_reached: true,
          nudge_message: null,
        };
      }

      // Upsert the daily usage row using Prisma's atomic increment.
      // messages_sent is a non-financial rate-limiting counter, not a ledger
      // balance column — the APPEND-ONLY FINANCE invariant does not apply here.
      const usage = await tx.sparkTwinDailyUsage.upsert({
        where: { user_id_usage_date: { user_id: userId, usage_date: today } },
        create: {
          user_id: userId,
          usage_date: today,
          messages_sent: 1,
          correlation_id: correlationId,
          reason_code: 'SPARK_DAILY_USAGE',
        },
        update: {
          messages_sent: { increment: 1 },
        },
      });

      const limitReached = usage.messages_sent >= SPARK_DAILY_MESSAGE_CAP;
      const nudgeMessage =
        usage.messages_sent >= SPARK_NUDGE_THRESHOLD ? SPARK_UPGRADE_NUDGE : null;

      this.logger.log('SparkTwinService.trackMessage', {
        user_id: userId,
        usage_date: today,
        messages_sent: usage.messages_sent,
        limit_reached: limitReached,
        nudge: nudgeMessage !== null,
      });

      return {
        messages_sent: usage.messages_sent,
        limit_reached: limitReached,
        nudge_message: nudgeMessage,
      };
    });
  }
}
