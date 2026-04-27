// BIJOU: BJ-002 — BijouSchedulerService
// Schedules, opens, closes, and cancels Bijou sessions.
// Enforces 15-minute boundary alignment and MAX_SESSIONS_PER_HOUR velocity rule.
// All constants sourced from GovernanceConfig.BIJOU — none hardcoded.
import { BadRequestException, Injectable, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../core-api/src/prisma.service';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { GovernanceConfig } from '../../core-api/src/governance/governance.config';
import { NATS_TOPICS } from '../../nats/topics.registry';
import { BijouSessionStatus } from '@prisma/client';

export interface CreateBijouSessionInput {
  creatorId: string;
  scheduledStart: Date;
  organizationId: string;
  tenantId: string;
}

@Injectable()
export class BijouSchedulerService {
  private readonly logger = new Logger(BijouSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly natsService: NatsService,
  ) {}

  /**
   * Create a new BijouSession in SCHEDULED status.
   * - Validates `scheduledStart` is aligned to the 15-minute slot grid
   *   (:00, :15, :30, :45) per GovernanceConfig.BIJOU.SCHEDULE_SLOT_MINUTES.
   * - Enforces velocity rule: creator may not have more than
   *   GovernanceConfig.BIJOU.MAX_SESSIONS_PER_HOUR sessions in any rolling
   *   60-min window containing `scheduledStart`.
   */
  async createSession(input: CreateBijouSessionInput): Promise<{ id: string; scheduled_start: Date; scheduled_end: Date }> {
    const ruleAppliedId = 'BJ-002_CREATE_SESSION_v1';
    const { creatorId, scheduledStart, organizationId, tenantId } = input;

    this.logger.log('BijouSchedulerService.createSession', {
      creator_id: creatorId,
      scheduled_start: scheduledStart.toISOString(),
      rule_applied_id: ruleAppliedId,
    });

    this.assertSlotAligned(scheduledStart, ruleAppliedId);

    await this.assertVelocityCompliance(creatorId, scheduledStart, ruleAppliedId);

    const durationMs = GovernanceConfig.BIJOU.SESSION_DURATION_MINUTES * 60 * 1000;
    const scheduledEnd = new Date(scheduledStart.getTime() + durationMs);

    const session = await this.prisma.bijouSession.create({
      data: {
        creator_id: creatorId,
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        capacity: GovernanceConfig.BIJOU.MAX_CAPACITY,
        status: BijouSessionStatus.SCHEDULED,
        organization_id: organizationId,
        tenant_id: tenantId,
      },
    });

    this.logger.log('BijouSchedulerService.createSession: scheduled', {
      session_id: session.id,
      creator_id: creatorId,
      scheduled_start: scheduledStart.toISOString(),
      scheduled_end: scheduledEnd.toISOString(),
      capacity: session.capacity,
      rule_applied_id: ruleAppliedId,
    });

    this.natsService.publish(NATS_TOPICS.BIJOU_SESSION_SCHEDULED, {
      session_id: session.id,
      creator_id: creatorId,
      scheduled_start: scheduledStart.toISOString(),
      scheduled_end: scheduledEnd.toISOString(),
      capacity: session.capacity,
      organization_id: organizationId,
      tenant_id: tenantId,
      rule_applied_id: ruleAppliedId,
      timestamp: new Date().toISOString(),
    });

    return { id: session.id, scheduled_start: scheduledStart, scheduled_end: scheduledEnd };
  }

  /**
   * Transition a SCHEDULED session to OPEN (doors open).
   */
  async openSession(sessionId: string): Promise<void> {
    const ruleAppliedId = 'BJ-002_OPEN_SESSION_v1';
    const session = await this.getSessionOrThrow(sessionId);

    await this.prisma.bijouSession.update({
      where: { id: sessionId },
      data: { status: BijouSessionStatus.OPEN },
    });

    this.logger.log('BijouSchedulerService.openSession: opened', {
      session_id: sessionId,
      creator_id: session.creator_id,
      rule_applied_id: ruleAppliedId,
    });

    this.natsService.publish(NATS_TOPICS.BIJOU_SESSION_OPENED, {
      session_id: sessionId,
      creator_id: session.creator_id,
      organization_id: session.organization_id,
      tenant_id: session.tenant_id,
      rule_applied_id: ruleAppliedId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Transition an OPEN session to CLOSED (show ended).
   */
  async closeSession(sessionId: string): Promise<void> {
    const ruleAppliedId = 'BJ-002_CLOSE_SESSION_v1';
    const session = await this.getSessionOrThrow(sessionId);

    await this.prisma.bijouSession.update({
      where: { id: sessionId },
      data: { status: BijouSessionStatus.CLOSED },
    });

    this.logger.log('BijouSchedulerService.closeSession: closed', {
      session_id: sessionId,
      creator_id: session.creator_id,
      rule_applied_id: ruleAppliedId,
    });

    this.natsService.publish(NATS_TOPICS.BIJOU_SESSION_CLOSED, {
      session_id: sessionId,
      creator_id: session.creator_id,
      organization_id: session.organization_id,
      tenant_id: session.tenant_id,
      rule_applied_id: ruleAppliedId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Cancel a SCHEDULED or OPEN session.
   */
  async cancelSession(sessionId: string): Promise<void> {
    const ruleAppliedId = 'BJ-002_CANCEL_SESSION_v1';
    const session = await this.getSessionOrThrow(sessionId);

    await this.prisma.bijouSession.update({
      where: { id: sessionId },
      data: { status: BijouSessionStatus.CANCELLED },
    });

    this.logger.log('BijouSchedulerService.cancelSession: cancelled', {
      session_id: sessionId,
      creator_id: session.creator_id,
      rule_applied_id: ruleAppliedId,
    });

    this.natsService.publish(NATS_TOPICS.BIJOU_SESSION_CANCELLED, {
      session_id: sessionId,
      creator_id: session.creator_id,
      organization_id: session.organization_id,
      tenant_id: session.tenant_id,
      rule_applied_id: ruleAppliedId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Assert `scheduledStart` is aligned to a 15-minute slot boundary.
   * GovernanceConfig.BIJOU.SCHEDULE_SLOT_MINUTES controls the grid size.
   */
  private assertSlotAligned(scheduledStart: Date, ruleAppliedId: string): void {
    const slotMinutes = GovernanceConfig.BIJOU.SCHEDULE_SLOT_MINUTES;
    const minute = scheduledStart.getUTCMinutes();
    const second = scheduledStart.getUTCSeconds();
    const ms = scheduledStart.getUTCMilliseconds();
    const aligned = minute % slotMinutes === 0 && second === 0 && ms === 0;
    if (!aligned) {
      this.logger.warn('BijouSchedulerService.createSession: slot-alignment failure', {
        scheduled_start: scheduledStart.toISOString(),
        slot_minutes: slotMinutes,
        rule_applied_id: ruleAppliedId,
      });
      throw new BadRequestException({
        message: `BijouSession scheduled_start must align to ${slotMinutes}-minute boundary (:00/:15/:30/:45).`,
        scheduled_start: scheduledStart.toISOString(),
        slot_minutes: slotMinutes,
        rule_applied_id: ruleAppliedId,
      });
    }
  }

  /**
   * Enforce velocity rule: creator may not exceed MAX_SESSIONS_PER_HOUR
   * in any rolling 60-minute window that contains `scheduledStart`.
   */
  private async assertVelocityCompliance(
    creatorId: string,
    scheduledStart: Date,
    ruleAppliedId: string,
  ): Promise<void> {
    const maxPerHour = GovernanceConfig.BIJOU.MAX_SESSIONS_PER_HOUR;
    const windowMs = 60 * 60 * 1000;
    const windowStart = new Date(scheduledStart.getTime() - windowMs + 1);
    const windowEnd = new Date(scheduledStart.getTime() + windowMs - 1);

    const count = await this.prisma.bijouSession.count({
      where: {
        creator_id: creatorId,
        status: { not: BijouSessionStatus.CANCELLED },
        scheduled_start: { gte: windowStart, lte: windowEnd },
      },
    });

    if (count >= maxPerHour) {
      this.logger.warn('BijouSchedulerService.createSession: velocity rule violated', {
        creator_id: creatorId,
        window_start: windowStart.toISOString(),
        window_end: windowEnd.toISOString(),
        existing_count: count,
        max_per_hour: maxPerHour,
        rule_applied_id: ruleAppliedId,
      });
      throw new UnprocessableEntityException({
        statusCode: 429,
        error: 'BIJOU_VELOCITY_LIMIT_EXCEEDED',
        message: `Creator exceeded MAX_SESSIONS_PER_HOUR (${maxPerHour}) in the rolling 60-minute window containing ${scheduledStart.toISOString()}.`,
        existing_count: count,
        max_per_hour: maxPerHour,
        rule_applied_id: ruleAppliedId,
      });
    }
  }

  private async getSessionOrThrow(sessionId: string): Promise<{
    id: string;
    creator_id: string;
    organization_id: string;
    tenant_id: string;
  }> {
    const session = await this.prisma.bijouSession.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException({ message: 'BijouSession not found', session_id: sessionId });
    }
    return session;
  }
}
