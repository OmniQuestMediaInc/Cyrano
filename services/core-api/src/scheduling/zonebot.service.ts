// services/core-api/src/scheduling/zonebot.service.ts
// GZ-SCHEDULE: ZoneBot — AI-assisted lottery system for fair shift pick-ups.
// Implements the 1-2-3 Awarding Rule with 16-hour confirmation clock and
// 2-cycle suppression for fairness. Uses crypto.randomInt() per Invariant #4.
import { Injectable, Logger } from '@nestjs/common';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma.service';
import { NatsService } from '../nats/nats.service';
import { NATS_TOPICS } from '../../../nats/topics.registry';
import { GZ_SCHEDULING } from '../config/governance.config';
import type { LotteryResult, SubmitBidRequest } from './scheduling.interfaces';

@Injectable()
export class ZoneBotService {
  private readonly logger = new Logger(ZoneBotService.name);
  private readonly RULE_ID = 'GZ_ZONEBOT_v1';

  constructor(
    private readonly prisma: PrismaService,
    private readonly nats: NatsService,
  ) {}

  /**
   * Submits a bid for a shift gap. Staff must be qualified (role match, active,
   * not suppressed from prior award).
   */
  async submitBid(request: SubmitBidRequest): Promise<string> {
    const gap = await this.prisma.shiftGap.findUnique({
      where: { id: request.shift_gap_id },
    });

    if (!gap) {
      throw new Error(`ZONEBOT_GAP_NOT_FOUND: Gap ${request.shift_gap_id} does not exist`);
    }

    if (gap.status !== 'OPEN' && gap.status !== 'BIDDING') {
      throw new Error(
        `ZONEBOT_GAP_CLOSED: Gap ${request.shift_gap_id} is ${gap.status}, not open for bids`,
      );
    }

    const staff = await this.prisma.staffMember.findFirst({
      where: { id: request.staff_member_id, is_active: true },
    });

    if (!staff) {
      throw new Error(
        `ZONEBOT_STAFF_INACTIVE: Staff ${request.staff_member_id} not found or inactive`,
      );
    }

    // Check role eligibility
    if (staff.role !== gap.required_role && gap.required_role !== 'GZSA') {
      throw new Error(
        `ZONEBOT_ROLE_MISMATCH: Staff role ${staff.role} does not match required ${gap.required_role}`,
      );
    }

    // Check suppression — staff awarded in last 2 cycles are suppressed
    const existingBid = await this.prisma.shiftBid.findFirst({
      where: {
        staff_member_id: request.staff_member_id,
        status: 'ACCEPTED',
        suppressed_until: { gte: new Date(gap.gap_date) },
      },
    });

    if (existingBid) {
      throw new Error(
        `ZONEBOT_SUPPRESSED: Staff ${request.staff_member_id} is suppressed until ${existingBid.suppressed_until?.toISOString()} due to recent award`,
      );
    }

    // Check for duplicate bid
    const duplicateBid = await this.prisma.shiftBid.findFirst({
      where: {
        shift_gap_id: request.shift_gap_id,
        staff_member_id: request.staff_member_id,
      },
    });

    if (duplicateBid) {
      throw new Error(
        `ZONEBOT_DUPLICATE_BID: Staff ${request.staff_member_id} already bid on gap ${request.shift_gap_id}`,
      );
    }

    const bid = await this.prisma.shiftBid.create({
      data: {
        shift_gap_id: request.shift_gap_id,
        staff_member_id: request.staff_member_id,
        status: 'PENDING',
        correlation_id: request.correlation_id,
        reason_code: request.reason_code,
        rule_applied_id: this.RULE_ID,
      },
    });

    // Transition gap to BIDDING if it was OPEN
    if (gap.status === 'OPEN') {
      await this.prisma.shiftGap.update({
        where: { id: gap.id },
        data: { status: 'BIDDING' },
      });
    }

    this.logger.log('ZoneBotService: bid submitted', {
      bid_id: bid.id,
      shift_gap_id: request.shift_gap_id,
      staff_member_id: request.staff_member_id,
      rule_applied_id: this.RULE_ID,
    });

    return bid.id;
  }

  /**
   * Runs the 1-2-3 lottery for a shift gap.
   * Uses crypto.randomInt() (Invariant #4) to randomly assign positions.
   * Position #1 gets the first 16-hour offer window.
   */
  async runLottery(shift_gap_id: string, correlation_id: string): Promise<LotteryResult> {
    const gap = await this.prisma.shiftGap.findUnique({
      where: { id: shift_gap_id },
    });

    if (!gap || gap.status !== 'BIDDING') {
      throw new Error(`ZONEBOT_LOTTERY_INVALID: Gap ${shift_gap_id} is not in BIDDING status`);
    }

    const bids = await this.prisma.shiftBid.findMany({
      where: {
        shift_gap_id,
        status: 'PENDING',
      },
    });

    if (bids.length === 0) {
      throw new Error(`ZONEBOT_NO_BIDS: No pending bids for gap ${shift_gap_id}`);
    }

    // Fisher-Yates shuffle with crypto.randomInt() (Invariant #4)
    const shuffled = [...bids];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = randomInt(0, i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Assign positions 1-3 (or fewer if less than 3 bids)
    const maxPositions = Math.min(shuffled.length, GZ_SCHEDULING.ZONEBOT_MAX_LOTTERY_POSITIONS);

    const positions: LotteryResult['positions'] = [];

    for (let i = 0; i < maxPositions; i++) {
      const bid = shuffled[i];
      const position = i + 1;

      await this.prisma.shiftBid.update({
        where: { id: bid.id },
        data: {
          lottery_position: position,
          status: 'POSITION_ASSIGNED',
        },
      });

      positions.push({
        position,
        staff_member_id: bid.staff_member_id,
        bid_id: bid.id,
      });
    }

    // Mark remaining bids as declined (not selected)
    for (let i = maxPositions; i < shuffled.length; i++) {
      await this.prisma.shiftBid.update({
        where: { id: shuffled[i].id },
        data: {
          status: 'DECLINED',
          reason_code: 'NOT_SELECTED_IN_LOTTERY',
        },
      });
    }

    this.logger.log('ZoneBotService: lottery completed', {
      shift_gap_id,
      total_bids: bids.length,
      positions_assigned: positions.length,
      rule_applied_id: this.RULE_ID,
    });

    this.nats.publish(NATS_TOPICS.SCHEDULE_ZONEBOT_LOTTERY_RUN, {
      shift_gap_id,
      total_bids: bids.length,
      positions,
      correlation_id,
      rule_applied_id: this.RULE_ID,
    });

    // Audit log
    await this.prisma.scheduleAuditLog.create({
      data: {
        event_type: 'LOTTERY_RUN',
        actor_id: 'ZONEBOT',
        target_id: shift_gap_id,
        target_type: 'GAP',
        details: { total_bids: bids.length, positions },
        correlation_id,
        reason_code: 'ZONEBOT_LOTTERY',
        rule_applied_id: this.RULE_ID,
      },
    });

    // Offer to position #1
    await this.offerToPosition(shift_gap_id, 1, correlation_id);

    return {
      shift_gap_id,
      positions,
      rule_applied_id: this.RULE_ID,
    };
  }

  /**
   * Offers the gap to the staff member at the given lottery position.
   * Starts the 16-hour confirmation clock.
   */
  async offerToPosition(
    shift_gap_id: string,
    position: number,
    correlation_id: string,
  ): Promise<void> {
    const bid = await this.prisma.shiftBid.findFirst({
      where: {
        shift_gap_id,
        lottery_position: position,
        status: 'POSITION_ASSIGNED',
      },
    });

    if (!bid) {
      this.logger.warn('ZoneBotService: no bid at position, gap may be unfillable', {
        shift_gap_id,
        position,
      });

      // If no more positions, mark gap as unfilled
      if (position > GZ_SCHEDULING.ZONEBOT_MAX_LOTTERY_POSITIONS) {
        await this.prisma.shiftGap.update({
          where: { id: shift_gap_id },
          data: { status: 'OPEN' },
        });
      }
      return;
    }

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + GZ_SCHEDULING.ZONEBOT_CONFIRMATION_HOURS * 3_600_000,
    );

    await this.prisma.shiftBid.update({
      where: { id: bid.id },
      data: {
        status: 'OFFERED',
        offered_at: now,
        expires_at: expiresAt,
      },
    });

    this.logger.log('ZoneBotService: offer sent', {
      bid_id: bid.id,
      staff_member_id: bid.staff_member_id,
      position,
      expires_at: expiresAt.toISOString(),
      rule_applied_id: this.RULE_ID,
    });

    this.nats.publish(NATS_TOPICS.SCHEDULE_ZONEBOT_BID_OFFERED, {
      bid_id: bid.id,
      shift_gap_id,
      staff_member_id: bid.staff_member_id,
      position,
      expires_at: expiresAt.toISOString(),
      confirmation_hours: GZ_SCHEDULING.ZONEBOT_CONFIRMATION_HOURS,
      correlation_id,
      rule_applied_id: this.RULE_ID,
    });
  }

  /**
   * Accepts a bid offer. Awards the shift, updates the gap, and
   * applies 2-cycle suppression for fairness.
   */
  async acceptBid(bid_id: string, correlation_id: string): Promise<void> {
    const bid = await this.prisma.shiftBid.findUnique({
      where: { id: bid_id },
    });

    if (!bid || bid.status !== 'OFFERED') {
      throw new Error(`ZONEBOT_BID_NOT_OFFERED: Bid ${bid_id} is not in OFFERED status`);
    }

    // Check if the confirmation window has expired
    if (bid.expires_at && new Date() > bid.expires_at) {
      throw new Error(`ZONEBOT_BID_EXPIRED: Confirmation window for bid ${bid_id} has expired`);
    }

    const now = new Date();

    // Calculate suppression end date (2 cycles × 14 days = 28 days from gap date)
    const gap = await this.prisma.shiftGap.findUnique({
      where: { id: bid.shift_gap_id },
    });

    const suppressionDays =
      GZ_SCHEDULING.ZONEBOT_SUPPRESSION_CYCLES * GZ_SCHEDULING.PERIOD_LENGTH_DAYS;
    const suppressedUntil = gap
      ? new Date(gap.gap_date.getTime() + suppressionDays * 86_400_000)
      : new Date(now.getTime() + suppressionDays * 86_400_000);

    // Accept the bid
    await this.prisma.shiftBid.update({
      where: { id: bid_id },
      data: {
        status: 'ACCEPTED',
        responded_at: now,
        suppressed_until: suppressedUntil,
      },
    });

    // Mark the gap as filled
    if (gap) {
      await this.prisma.shiftGap.update({
        where: { id: gap.id },
        data: {
          status: 'FILLED',
          filled_by: bid.staff_member_id,
          filled_at: now,
        },
      });

      this.nats.publish(NATS_TOPICS.SCHEDULE_GAP_FILLED, {
        gap_id: gap.id,
        shift_gap_id: bid.shift_gap_id,
        filled_by: bid.staff_member_id,
        gap_date: gap.gap_date.toISOString().split('T')[0],
        department: gap.department,
        correlation_id,
        rule_applied_id: this.RULE_ID,
      });
    }

    // Decline any remaining position-assigned bids for this gap
    await this.prisma.shiftBid.updateMany({
      where: {
        shift_gap_id: bid.shift_gap_id,
        id: { not: bid_id },
        status: { in: ['POSITION_ASSIGNED', 'OFFERED'] },
      },
      data: {
        status: 'DECLINED',
        reason_code: 'GAP_FILLED_BY_ANOTHER',
      },
    });

    this.logger.log('ZoneBotService: bid accepted, shift awarded', {
      bid_id,
      staff_member_id: bid.staff_member_id,
      shift_gap_id: bid.shift_gap_id,
      suppressed_until: suppressedUntil.toISOString(),
      rule_applied_id: this.RULE_ID,
    });

    this.nats.publish(NATS_TOPICS.SCHEDULE_ZONEBOT_BID_AWARDED, {
      bid_id,
      shift_gap_id: bid.shift_gap_id,
      staff_member_id: bid.staff_member_id,
      suppressed_until: suppressedUntil.toISOString(),
      correlation_id,
      rule_applied_id: this.RULE_ID,
    });

    // Audit log
    await this.prisma.scheduleAuditLog.create({
      data: {
        event_type: 'BID_AWARDED',
        actor_id: bid.staff_member_id,
        target_id: bid_id,
        target_type: 'BID',
        details: {
          shift_gap_id: bid.shift_gap_id,
          suppressed_until: suppressedUntil.toISOString(),
        },
        correlation_id,
        reason_code: 'ZONEBOT_AWARD',
        rule_applied_id: this.RULE_ID,
      },
    });
  }

  /**
   * Declines a bid offer. Cascades the offer to the next lottery position.
   */
  async declineBid(bid_id: string, correlation_id: string): Promise<void> {
    const bid = await this.prisma.shiftBid.findUnique({
      where: { id: bid_id },
    });

    if (!bid || bid.status !== 'OFFERED') {
      throw new Error(`ZONEBOT_BID_NOT_OFFERED: Bid ${bid_id} is not in OFFERED status`);
    }

    await this.prisma.shiftBid.update({
      where: { id: bid_id },
      data: {
        status: 'DECLINED',
        responded_at: new Date(),
        reason_code: 'STAFF_DECLINED',
      },
    });

    this.logger.log('ZoneBotService: bid declined, cascading to next position', {
      bid_id,
      staff_member_id: bid.staff_member_id,
      position: bid.lottery_position,
      rule_applied_id: this.RULE_ID,
    });

    // Cascade to next position
    const nextPosition = (bid.lottery_position ?? 0) + 1;
    if (nextPosition <= GZ_SCHEDULING.ZONEBOT_MAX_LOTTERY_POSITIONS) {
      await this.offerToPosition(bid.shift_gap_id, nextPosition, correlation_id);
    } else {
      // All positions exhausted — reopen the gap
      await this.prisma.shiftGap.update({
        where: { id: bid.shift_gap_id },
        data: { status: 'OPEN' },
      });

      this.logger.warn('ZoneBotService: all lottery positions exhausted, gap reopened', {
        shift_gap_id: bid.shift_gap_id,
        rule_applied_id: this.RULE_ID,
      });
    }
  }

  /**
   * Processes expired bid offers. Called periodically to check if any
   * OFFERED bids have passed their 16-hour confirmation window.
   * Cascades to next position automatically.
   */
  async processExpiredOffers(correlation_id: string): Promise<number> {
    const now = new Date();

    const expiredBids = await this.prisma.shiftBid.findMany({
      where: {
        status: 'OFFERED',
        expires_at: { lt: now },
      },
    });

    for (const bid of expiredBids) {
      await this.prisma.shiftBid.update({
        where: { id: bid.id },
        data: {
          status: 'EXPIRED',
          responded_at: now,
          reason_code: 'CONFIRMATION_WINDOW_EXPIRED',
        },
      });

      this.nats.publish(NATS_TOPICS.SCHEDULE_ZONEBOT_BID_EXPIRED, {
        bid_id: bid.id,
        shift_gap_id: bid.shift_gap_id,
        staff_member_id: bid.staff_member_id,
        correlation_id,
        rule_applied_id: this.RULE_ID,
      });

      // Audit log
      await this.prisma.scheduleAuditLog.create({
        data: {
          event_type: 'BID_EXPIRED',
          actor_id: 'ZONEBOT',
          target_id: bid.id,
          target_type: 'BID',
          details: {
            shift_gap_id: bid.shift_gap_id,
            staff_member_id: bid.staff_member_id,
            expired_at: now.toISOString(),
          },
          correlation_id,
          reason_code: 'CONFIRMATION_WINDOW_EXPIRED',
          rule_applied_id: this.RULE_ID,
        },
      });

      // Cascade to next position
      const nextPosition = (bid.lottery_position ?? 0) + 1;
      if (nextPosition <= GZ_SCHEDULING.ZONEBOT_MAX_LOTTERY_POSITIONS) {
        await this.offerToPosition(bid.shift_gap_id, nextPosition, correlation_id);
      } else {
        await this.prisma.shiftGap.update({
          where: { id: bid.shift_gap_id },
          data: { status: 'OPEN' },
        });
      }
    }

    if (expiredBids.length > 0) {
      this.logger.log('ZoneBotService: processed expired offers', {
        count: expiredBids.length,
        rule_applied_id: this.RULE_ID,
      });
    }

    return expiredBids.length;
  }
}
