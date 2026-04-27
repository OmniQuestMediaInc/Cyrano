// services/core-api/src/scheduling/shift-coverage.service.ts
// GZ-SCHEDULE: Coverage validation and gap detection.
// Ensures minimum staffing baselines, supervisory presence,
// and cross-department coverage requirements are met.
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NatsService } from '../nats/nats.service';
import { NATS_TOPICS } from '../../../nats/topics.registry';
import { GZ_SCHEDULING } from '../config/governance.config';
import { SUPERVISORY_ROLES } from './scheduling.constants';
import type {
  CoverageReport,
  Department,
  ShiftCode,
  StaffRole,
  PostGapRequest,
} from './scheduling.interfaces';

@Injectable()
export class ShiftCoverageService {
  private readonly logger = new Logger(ShiftCoverageService.name);
  private readonly RULE_ID = 'GZ_SHIFT_COVERAGE_v1';

  constructor(
    private readonly prisma: PrismaService,
    private readonly nats: NatsService,
  ) {}

  /**
   * Evaluates coverage for a specific department, date, and shift.
   * Compares assigned staff against DepartmentCoverage requirements.
   */
  async evaluateCoverage(
    department: Department,
    date: string,
    shift_code: ShiftCode,
  ): Promise<CoverageReport> {
    const dateObj = new Date(date);
    const dayOfWeek = (dateObj.getDay() + 6) % 7; // Convert to 0=Mon

    // Get coverage requirements for this department and day
    const coverageReqs = await this.prisma.departmentCoverage.findMany({
      where: {
        department,
        day_of_week: dayOfWeek,
      },
    });

    // Get shift template for duration/time context
    const shiftTemplate = await this.prisma.shiftTemplate.findFirst({
      where: { shift_code, department, is_active: true },
    });

    // Get all assignments for this date, department, and shift
    const assignments = await this.prisma.shiftAssignment.findMany({
      where: {
        shift_date: dateObj,
        shift_template_id: shiftTemplate?.id,
      },
    });

    // Lookup staff roles for assigned members
    const staffIds = assignments.map((a) => a.staff_member_id);
    const staffMembers = await this.prisma.staffMember.findMany({
      where: { id: { in: staffIds }, department, is_active: true },
    });

    const assignedCount = staffMembers.length;
    const supervisorCount = staffMembers.filter((s) =>
      (SUPERVISORY_ROLES as readonly string[]).includes(s.role),
    ).length;

    // Determine coverage requirements — use DB config or fall back to governance defaults
    let requiredCount: number = GZ_SCHEDULING.GZ_MIN_AGENTS_PER_SHIFT;
    let requiredSupervisors: number = 1;
    let requiresManager = false;

    if (coverageReqs.length > 0) {
      const req = coverageReqs[0];
      requiredCount = req.min_staff_count;
      requiredSupervisors = req.min_supervisor_count;
      requiresManager = req.requires_manager;
    }

    const gaps: CoverageReport['gaps'] = [];

    if (assignedCount < requiredCount) {
      gaps.push({
        role: 'GZSA' as StaffRole,
        count_needed: requiredCount - assignedCount,
      });
    }

    if (supervisorCount < requiredSupervisors) {
      gaps.push({
        role: 'GZS' as StaffRole,
        count_needed: requiredSupervisors - supervisorCount,
      });
    }

    if (requiresManager) {
      const hasManager = staffMembers.some((s) => s.role === 'GZM' || s.role === 'GZAM');
      if (!hasManager) {
        gaps.push({
          role: 'GZM' as StaffRole,
          count_needed: 1,
        });
      }
    }

    const is_covered = gaps.length === 0;

    if (!is_covered) {
      this.logger.warn('ShiftCoverageService: coverage gap detected', {
        department,
        date,
        shift_code,
        gaps,
        rule_applied_id: this.RULE_ID,
      });

      this.nats.publish(NATS_TOPICS.SCHEDULE_COVERAGE_GAP_DETECTED, {
        department,
        date,
        shift_code,
        assigned_count: assignedCount,
        required_count: requiredCount,
        gaps,
        rule_applied_id: this.RULE_ID,
      });
    }

    return {
      department,
      date,
      shift_code,
      required_count: requiredCount,
      assigned_count: assignedCount,
      is_covered,
      gaps,
      rule_applied_id: this.RULE_ID,
    };
  }

  /**
   * Scans an entire schedule period for coverage gaps across all shifts.
   * Returns all gaps found so they can be posted for ZoneBot lottery.
   */
  async scanPeriodCoverage(schedule_period_id: string): Promise<CoverageReport[]> {
    const period = await this.prisma.schedulePeriod.findUnique({
      where: { id: schedule_period_id },
    });

    if (!period) {
      this.logger.error('ShiftCoverageService: period not found', {
        schedule_period_id,
      });
      return [];
    }

    const reports: CoverageReport[] = [];
    const dayMs = 86_400_000;
    const startMs = period.period_start.getTime();
    const endMs = period.period_end.getTime();

    const shiftCodes: ShiftCode[] = ['A', 'B', 'C'];

    for (let dateMs = startMs; dateMs <= endMs; dateMs += dayMs) {
      const dateStr = new Date(dateMs).toISOString().split('T')[0];

      for (const shiftCode of shiftCodes) {
        const report = await this.evaluateCoverage(
          period.department as Department,
          dateStr,
          shiftCode,
        );

        if (!report.is_covered) {
          reports.push(report);
        }
      }
    }

    this.logger.log('ShiftCoverageService: period coverage scan complete', {
      schedule_period_id,
      total_gaps: reports.length,
      rule_applied_id: this.RULE_ID,
    });

    return reports;
  }

  /**
   * Posts a shift gap for ZoneBot lottery. Creates the gap record and
   * transitions it to BIDDING status.
   */
  async postGap(request: PostGapRequest): Promise<string> {
    const gap = await this.prisma.shiftGap.create({
      data: {
        schedule_period_id: request.schedule_period_id,
        shift_template_id: request.shift_template_id,
        gap_date: new Date(request.gap_date),
        department: request.department,
        required_role: request.required_role,
        status: 'OPEN',
        correlation_id: request.correlation_id,
        reason_code: request.reason_code,
        rule_applied_id: 'GZ_SHIFT_GAP_v1',
      },
    });

    this.logger.log('ShiftCoverageService: gap posted', {
      gap_id: gap.id,
      department: request.department,
      gap_date: request.gap_date,
      required_role: request.required_role,
      rule_applied_id: 'GZ_SHIFT_GAP_v1',
    });

    this.nats.publish(NATS_TOPICS.SCHEDULE_GAP_POSTED, {
      gap_id: gap.id,
      schedule_period_id: request.schedule_period_id,
      department: request.department,
      gap_date: request.gap_date,
      required_role: request.required_role,
      correlation_id: request.correlation_id,
      rule_applied_id: 'GZ_SHIFT_GAP_v1',
    });

    // Log audit event
    await this.prisma.scheduleAuditLog.create({
      data: {
        event_type: 'GAP_POSTED',
        actor_id: request.actor_id,
        target_id: gap.id,
        target_type: 'GAP',
        department: request.department,
        details: {
          gap_date: request.gap_date,
          required_role: request.required_role,
          shift_template_id: request.shift_template_id,
        },
        correlation_id: request.correlation_id,
        reason_code: request.reason_code,
        rule_applied_id: 'GZ_SHIFT_GAP_v1',
      },
    });

    return gap.id;
  }

  /**
   * Checks whether a stat holiday falls on a given date and returns
   * the appropriate pay multiplier.
   */
  async getStatHolidayMultiplier(date: string): Promise<number> {
    const holiday = await this.prisma.statHoliday.findFirst({
      where: { holiday_date: new Date(date) },
    });

    if (holiday) {
      return Number(holiday.pay_multiplier);
    }

    return 1.0;
  }

  /**
   * Validates that an on-call Emergency-Duty Manager is assigned
   * during stat holiday periods when only GZS/GZSA staff are on shift.
   */
  async validateStatHolidayOnCall(date: string): Promise<boolean> {
    const holiday = await this.prisma.statHoliday.findFirst({
      where: {
        holiday_date: new Date(date),
        requires_on_call_manager: true,
      },
    });

    if (!holiday) {
      return true; // Not a stat holiday requiring on-call
    }

    // Check if a GZM is assigned as on-call for this date
    const onCallManager = await this.prisma.shiftAssignment.findFirst({
      where: {
        shift_date: new Date(date),
        on_call: true,
      },
    });

    if (!onCallManager) {
      this.logger.warn('ShiftCoverageService: no on-call manager for stat holiday', {
        date,
        holiday: holiday.holiday_name,
        rule_applied_id: this.RULE_ID,
      });

      this.nats.publish(NATS_TOPICS.SCHEDULE_STAT_HOLIDAY_ALERT, {
        date,
        holiday_name: holiday.holiday_name,
        alert: 'NO_ON_CALL_MANAGER',
        rule_applied_id: this.RULE_ID,
      });

      return false;
    }

    return true;
  }
}
