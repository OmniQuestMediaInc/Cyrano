// services/core-api/src/scheduling/compliance-guard.service.ts
// GZ-SCHEDULE: Ontario ESA 2026 compliance enforcement.
// Validates shift assignments against consecutive-day limits,
// max weekly hours, transit safety windows, and shift notice requirements.
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NatsService } from '../nats/nats.service';
import { NATS_TOPICS } from '../../../nats/topics.registry';
import { GZ_SCHEDULING } from '../config/governance.config';
import type { ShiftTemplate } from '@prisma/client';
import type {
  ComplianceWarning,
  ComplianceCheckRequest,
  ComplianceCheckResult,
  WeeklySummary,
} from './scheduling.interfaces';

@Injectable()
export class ComplianceGuardService {
  private readonly logger = new Logger(ComplianceGuardService.name);
  private readonly RULE_ID = 'GZ_COMPLIANCE_GUARD_v1';

  constructor(
    private readonly prisma: PrismaService,
    private readonly nats: NatsService,
  ) {}

  /**
   * Full compliance check for a proposed shift assignment.
   * Checks: consecutive days, weekly hours, transit safety, days-off minimums.
   */
  async validateAssignment(request: ComplianceCheckRequest): Promise<ComplianceCheckResult> {
    const warnings: ComplianceWarning[] = [];

    const staff = await this.prisma.staffMember.findFirst({
      where: { id: request.staff_member_id, is_active: true },
    });

    if (!staff) {
      warnings.push({
        violation_type: 'STAFF_NOT_FOUND',
        message: `Staff member ${request.staff_member_id} not found or inactive`,
        severity: 'ERROR',
        affected_staff_id: request.staff_member_id,
      });
      return { is_compliant: false, warnings, rule_applied_id: this.RULE_ID };
    }

    const consecutiveWarnings = await this.checkConsecutiveDays(
      request.staff_member_id,
      request.proposed_date,
      staff.employment_type,
      staff.staff_category,
    );
    warnings.push(...consecutiveWarnings);

    const hoursWarnings = await this.checkWeeklyHours(
      request.staff_member_id,
      request.proposed_date,
      request.proposed_shift_code,
    );
    warnings.push(...hoursWarnings);

    const transitWarnings = this.checkTransitSafety(request.proposed_shift_code);
    warnings.push(...transitWarnings);

    const is_compliant = !warnings.some((w) => w.severity === 'ERROR');

    if (!is_compliant) {
      this.logger.warn('ComplianceGuardService: violation detected', {
        staff_member_id: request.staff_member_id,
        proposed_date: request.proposed_date,
        violations: warnings.filter((w) => w.severity === 'ERROR'),
        rule_applied_id: this.RULE_ID,
      });

      this.nats.publish(NATS_TOPICS.SCHEDULE_COMPLIANCE_VIOLATION, {
        staff_member_id: request.staff_member_id,
        proposed_date: request.proposed_date,
        violations: warnings,
        rule_applied_id: this.RULE_ID,
      });
    }

    return { is_compliant, warnings, rule_applied_id: this.RULE_ID };
  }

  /**
   * Checks that assigning this date would not violate the consecutive-day limit.
   * Ontario ESA: no more than MAX_CONSECUTIVE_DAYS in a row.
   * FT Core: min 2 consecutive days off per week.
   * PT Edge: min 3 consecutive days off per week.
   */
  async checkConsecutiveDays(
    staff_member_id: string,
    proposed_date: string,
    employment_type: string,
    staff_category: string,
  ): Promise<ComplianceWarning[]> {
    const warnings: ComplianceWarning[] = [];
    const proposedMs = new Date(proposed_date).getTime();
    const dayMs = 86_400_000;

    // Look back and forward MAX_CONSECUTIVE_DAYS days to find the streak
    const lookback_start = new Date(proposedMs - GZ_SCHEDULING.MAX_CONSECUTIVE_DAYS * dayMs);
    const lookforward_end = new Date(proposedMs + GZ_SCHEDULING.MAX_CONSECUTIVE_DAYS * dayMs);

    const assignments = await this.prisma.shiftAssignment.findMany({
      where: {
        staff_member_id,
        shift_date: {
          gte: lookback_start,
          lte: lookforward_end,
        },
      },
      orderBy: { shift_date: 'asc' },
    });

    // Build a set of assigned dates (including the proposed date)
    const assignedDates = new Set<string>(
      assignments.map((a) => a.shift_date.toISOString().split('T')[0]),
    );
    assignedDates.add(proposed_date);

    // Count consecutive days around the proposed date
    let streak = 1;

    // Count backwards
    let checkDate = new Date(proposedMs - dayMs);
    while (assignedDates.has(checkDate.toISOString().split('T')[0])) {
      streak++;
      checkDate = new Date(checkDate.getTime() - dayMs);
    }

    // Count forwards
    checkDate = new Date(proposedMs + dayMs);
    while (assignedDates.has(checkDate.toISOString().split('T')[0])) {
      streak++;
      checkDate = new Date(checkDate.getTime() + dayMs);
    }

    if (streak > GZ_SCHEDULING.MAX_CONSECUTIVE_DAYS) {
      warnings.push({
        violation_type: 'CONSECUTIVE_DAYS_EXCEEDED',
        message: `Staff would work ${streak} consecutive days (max ${GZ_SCHEDULING.MAX_CONSECUTIVE_DAYS}). Ontario ESA requires at least 24 consecutive hours off per work week.`,
        severity: 'ERROR',
        affected_staff_id: staff_member_id,
        affected_date: proposed_date,
      });
    }

    // Check minimum consecutive days off requirement
    const minDaysOff =
      staff_category === 'EDGE'
        ? GZ_SCHEDULING.MIN_CONSECUTIVE_DAYS_OFF_PT
        : GZ_SCHEDULING.MIN_CONSECUTIVE_DAYS_OFF_FT;

    // Check the 7-day window around proposed date for days-off compliance
    const weekStart = new Date(proposedMs - 3 * dayMs);
    let maxConsecutiveOff = 0;
    let currentOff = 0;

    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart.getTime() + i * dayMs);
      const dateStr = d.toISOString().split('T')[0];
      if (!assignedDates.has(dateStr)) {
        currentOff++;
        maxConsecutiveOff = Math.max(maxConsecutiveOff, currentOff);
      } else {
        currentOff = 0;
      }
    }

    if (maxConsecutiveOff < minDaysOff) {
      warnings.push({
        violation_type: 'INSUFFICIENT_CONSECUTIVE_DAYS_OFF',
        message: `Staff has only ${maxConsecutiveOff} consecutive days off in the surrounding week (min ${minDaysOff} required for ${staff_category} staff).`,
        severity: 'WARNING',
        affected_staff_id: staff_member_id,
        affected_date: proposed_date,
      });
    }

    return warnings;
  }

  /**
   * Checks that adding a shift would not exceed the weekly hours limit.
   */
  async checkWeeklyHours(
    staff_member_id: string,
    proposed_date: string,
    shift_code: string,
  ): Promise<ComplianceWarning[]> {
    const warnings: ComplianceWarning[] = [];
    const proposedMs = new Date(proposed_date).getTime();
    const dayMs = 86_400_000;

    // Find the Monday of the proposed date's week
    const proposed = new Date(proposed_date);
    const dayOfWeek = proposed.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(proposedMs + mondayOffset * dayMs);
    const weekEnd = new Date(weekStart.getTime() + 6 * dayMs);

    const assignments = await this.prisma.shiftAssignment.findMany({
      where: {
        staff_member_id,
        shift_date: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
    });

    // Look up shift templates to calculate hours
    const templateIds = [...new Set(assignments.map((a) => a.shift_template_id))];
    const templates = await this.prisma.shiftTemplate.findMany({
      where: { id: { in: templateIds } },
    });
    const templateMap = new Map<string, ShiftTemplate>(templates.map((t) => [t.id, t]));

    let totalHours = 0;
    for (const assignment of assignments) {
      const template = templateMap.get(assignment.shift_template_id);
      if (template) {
        totalHours += Number(template.duration_hours);
      }
    }

    // Add the proposed shift's hours
    const shiftDef = GZ_SCHEDULING.SHIFTS[shift_code as keyof typeof GZ_SCHEDULING.SHIFTS];
    if (shiftDef) {
      totalHours += shiftDef.duration_hours;
    }

    if (totalHours > GZ_SCHEDULING.MAX_WEEKLY_HOURS_EXCESS) {
      warnings.push({
        violation_type: 'WEEKLY_HOURS_EXCEEDED',
        message: `Total weekly hours would be ${totalHours}h (max ${GZ_SCHEDULING.MAX_WEEKLY_HOURS_EXCESS}h with excess hours agreement).`,
        severity: 'ERROR',
        affected_staff_id: staff_member_id,
        affected_date: proposed_date,
      });
    } else if (totalHours > GZ_SCHEDULING.MAX_WEEKLY_HOURS_STANDARD) {
      warnings.push({
        violation_type: 'WEEKLY_HOURS_ABOVE_STANDARD',
        message: `Total weekly hours would be ${totalHours}h (above standard ${GZ_SCHEDULING.MAX_WEEKLY_HOURS_STANDARD}h — requires excess hours agreement on file).`,
        severity: 'WARNING',
        affected_staff_id: staff_member_id,
        affected_date: proposed_date,
      });
    }

    return warnings;
  }

  /**
   * Validates that the shift respects transit-safe windows.
   * No shifts start or end between midnight and 6:15 AM.
   * The Waterfall model is already designed for this, but this guard catches manual overrides.
   */
  checkTransitSafety(shift_code: string): ComplianceWarning[] {
    const warnings: ComplianceWarning[] = [];
    const shiftDef = GZ_SCHEDULING.SHIFTS[shift_code as keyof typeof GZ_SCHEDULING.SHIFTS];

    if (!shiftDef) {
      return warnings;
    }

    const parseHour = (time: string): number => {
      const [h, m] = time.split(':').map(Number);
      return h + m / 60;
    };

    const startHour = parseHour(shiftDef.start);
    const endHour = parseHour(shiftDef.end);

    const isUnsafe = (hour: number): boolean =>
      hour >= GZ_SCHEDULING.TRANSIT_UNSAFE_START_HOUR &&
      hour < GZ_SCHEDULING.TRANSIT_UNSAFE_END_HOUR;

    if (isUnsafe(startHour) || isUnsafe(endHour)) {
      warnings.push({
        violation_type: 'TRANSIT_SAFETY',
        message: `Shift ${shift_code} starts at ${shiftDef.start} or ends at ${shiftDef.end}, which falls in the transit-unsafe window (midnight to 6:15 AM).`,
        severity: 'WARNING',
      });
    }

    return warnings;
  }

  /**
   * Validates that shift notice requirements are met.
   * Schedule: 96 hours notice. Changes: 24 hours notice.
   */
  checkShiftNotice(shift_date: string, is_change: boolean): ComplianceWarning[] {
    const warnings: ComplianceWarning[] = [];
    const now = Date.now();
    const shiftMs = new Date(shift_date).getTime();
    const hoursUntilShift = (shiftMs - now) / 3_600_000;

    const requiredHours = is_change
      ? GZ_SCHEDULING.SHIFT_CHANGE_NOTICE_HOURS
      : GZ_SCHEDULING.SHIFT_NOTICE_HOURS;

    if (hoursUntilShift < requiredHours) {
      warnings.push({
        violation_type: 'INSUFFICIENT_SHIFT_NOTICE',
        message: `Only ${Math.round(hoursUntilShift)}h until shift (${requiredHours}h notice required for ${is_change ? 'changes' : 'new schedules'}).`,
        severity: is_change ? 'WARNING' : 'ERROR',
        affected_date: shift_date,
      });
    }

    return warnings;
  }

  /**
   * Computes a weekly summary for a staff member: total hours,
   * consecutive days, stat holiday hours, on-call count.
   */
  async getWeeklySummary(staff_member_id: string, week_start_date: string): Promise<WeeklySummary> {
    const dayMs = 86_400_000;
    const weekStartMs = new Date(week_start_date).getTime();
    const weekEnd = new Date(weekStartMs + 6 * dayMs);

    const assignments = await this.prisma.shiftAssignment.findMany({
      where: {
        staff_member_id,
        shift_date: {
          gte: new Date(week_start_date),
          lte: weekEnd,
        },
      },
      orderBy: { shift_date: 'asc' },
    });

    const templateIds = [...new Set(assignments.map((a) => a.shift_template_id))];
    const templates = await this.prisma.shiftTemplate.findMany({
      where: { id: { in: templateIds } },
    });
    const templateMap = new Map<string, ShiftTemplate>(templates.map((t) => [t.id, t]));

    let totalHours = 0;
    let statHolidayHours = 0;
    let onCallShifts = 0;
    let consecutiveDays = 0;
    let currentStreak = 0;
    let prevDate: number | null = null;

    const shifts: WeeklySummary['shifts'] = [];

    for (const assignment of assignments) {
      const template = templateMap.get(assignment.shift_template_id);
      const hours = template ? Number(template.duration_hours) : 0;
      const shiftCode = template?.shift_code ?? 'A';

      totalHours += hours;
      if (assignment.is_stat_holiday) {
        statHolidayHours += hours;
      }
      if (assignment.on_call) {
        onCallShifts++;
      }

      shifts.push({
        date: assignment.shift_date.toISOString().split('T')[0],
        shift_code: shiftCode as 'A' | 'B' | 'C',
        hours,
      });

      const dateMs = assignment.shift_date.getTime();
      if (prevDate !== null && dateMs - prevDate <= dayMs) {
        currentStreak++;
      } else {
        currentStreak = 1;
      }
      consecutiveDays = Math.max(consecutiveDays, currentStreak);
      prevDate = dateMs;
    }

    return {
      staff_member_id,
      week_start: week_start_date,
      total_hours: totalHours,
      consecutive_days: consecutiveDays,
      shifts,
      stat_holiday_hours: statHolidayHours,
      on_call_shifts: onCallShifts,
    };
  }
}
