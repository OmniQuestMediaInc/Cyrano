// services/core-api/src/scheduling/scheduling.service.ts
// GZ-SCHEDULE: Core orchestration service for the GuestZone scheduling module.
// Manages schedule periods (rolling 2-week cycles), shift assignments,
// B-Lock/Final Lock lifecycle, and integrates compliance + coverage checks.
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NatsService } from '../nats/nats.service';
import { NATS_TOPICS } from '../../../nats/topics.registry';
import { GZ_SCHEDULING } from '../config/governance.config';
import { ComplianceGuardService } from './compliance-guard.service';
import { ShiftCoverageService } from './shift-coverage.service';
import type {
  CreatePeriodRequest,
  CreatePeriodResult,
  AssignShiftRequest,
  AssignShiftResult,
  ShiftCode,
} from './scheduling.interfaces';

@Injectable()
export class SchedulingService {
  private readonly logger = new Logger(SchedulingService.name);
  private readonly RULE_ID = 'GZ_SCHEDULING_v1';

  constructor(
    private readonly prisma: PrismaService,
    private readonly nats: NatsService,
    private readonly complianceGuard: ComplianceGuardService,
    private readonly shiftCoverage: ShiftCoverageService,
  ) {}

  /**
   * Creates a new rolling 2-week schedule period.
   * Automatically calculates B-Lock cutoff (21 days before) and
   * Final Lock (14 days before) dates.
   */
  async createPeriod(request: CreatePeriodRequest): Promise<CreatePeriodResult> {
    const periodStart = new Date(request.period_start);
    const dayMs = 86_400_000;

    const periodEnd = new Date(
      periodStart.getTime() + (GZ_SCHEDULING.PERIOD_LENGTH_DAYS - 1) * dayMs,
    );
    const blockCutoff = new Date(
      periodStart.getTime() - GZ_SCHEDULING.BLOCK_CUTOFF_DAYS_BEFORE * dayMs,
    );
    const finalLock = new Date(
      periodStart.getTime() - GZ_SCHEDULING.FINAL_LOCK_DAYS_BEFORE * dayMs,
    );

    const periodRef = `GZ-${request.department}-${request.period_start}`;

    // Check for duplicate period
    const existing = await this.prisma.schedulePeriod.findUnique({
      where: { period_ref: periodRef },
    });

    if (existing) {
      throw new Error(
        `SCHEDULE_PERIOD_EXISTS: Period ${periodRef} already exists with status ${existing.status}`,
      );
    }

    const period = await this.prisma.schedulePeriod.create({
      data: {
        period_ref: periodRef,
        department: request.department,
        period_start: periodStart,
        period_end: periodEnd,
        block_cutoff_at: blockCutoff,
        final_lock_at: finalLock,
        status: 'DRAFT',
        correlation_id: request.correlation_id,
        reason_code: request.reason_code,
        rule_applied_id: this.RULE_ID,
      },
    });

    const result: CreatePeriodResult = {
      period_id: period.id,
      period_ref: periodRef,
      department: request.department,
      period_start: periodStart.toISOString().split('T')[0],
      period_end: periodEnd.toISOString().split('T')[0],
      block_cutoff_at: blockCutoff.toISOString(),
      final_lock_at: finalLock.toISOString(),
      status: 'DRAFT',
      rule_applied_id: this.RULE_ID,
    };

    this.logger.log('SchedulingService: period created', {
      period_id: period.id,
      period_ref: periodRef,
      department: request.department,
      period_start: result.period_start,
      period_end: result.period_end,
      block_cutoff_at: result.block_cutoff_at,
      final_lock_at: result.final_lock_at,
      rule_applied_id: this.RULE_ID,
    });

    this.nats.publish(NATS_TOPICS.SCHEDULE_PERIOD_CREATED, {
      period_id: period.id,
      period_ref: periodRef,
      department: request.department,
      period_start: result.period_start,
      period_end: result.period_end,
      block_cutoff_at: result.block_cutoff_at,
      final_lock_at: result.final_lock_at,
      correlation_id: request.correlation_id,
      rule_applied_id: this.RULE_ID,
    });

    // Audit log
    await this.prisma.scheduleAuditLog.create({
      data: {
        event_type: 'PERIOD_CREATED',
        actor_id: request.actor_id,
        target_id: period.id,
        target_type: 'PERIOD',
        department: request.department,
        details: {
          period_ref: periodRef,
          period_start: result.period_start,
          period_end: result.period_end,
        },
        correlation_id: request.correlation_id,
        reason_code: request.reason_code,
        rule_applied_id: this.RULE_ID,
      },
    });

    return result;
  }

  /**
   * Transitions a schedule period to B_LOCKED status.
   * After B-Lock, no new shift preferences can be submitted.
   * Automated reminders should have been sent at 24 and 22 days prior.
   */
  async lockPeriodBLock(
    period_id: string,
    actor_id: string,
    correlation_id: string,
  ): Promise<void> {
    const period = await this.prisma.schedulePeriod.findUnique({
      where: { id: period_id },
    });

    if (!period) {
      throw new Error(`SCHEDULE_PERIOD_NOT_FOUND: ${period_id}`);
    }

    if (period.status !== 'DRAFT') {
      throw new Error(
        `SCHEDULE_PERIOD_INVALID_STATE: Cannot B-Lock period in ${period.status} state (must be DRAFT)`,
      );
    }

    await this.prisma.schedulePeriod.update({
      where: { id: period_id },
      data: { status: 'B_LOCKED' },
    });

    this.logger.log('SchedulingService: period B-Locked', {
      period_id,
      period_ref: period.period_ref,
      rule_applied_id: this.RULE_ID,
    });

    this.nats.publish(NATS_TOPICS.SCHEDULE_PERIOD_B_LOCKED, {
      period_id,
      period_ref: period.period_ref,
      department: period.department,
      correlation_id,
      rule_applied_id: this.RULE_ID,
    });

    await this.prisma.scheduleAuditLog.create({
      data: {
        event_type: 'PERIOD_B_LOCKED',
        actor_id,
        target_id: period_id,
        target_type: 'PERIOD',
        department: period.department,
        correlation_id,
        reason_code: 'B_LOCK_CUTOFF',
        rule_applied_id: this.RULE_ID,
      },
    });
  }

  /**
   * Transitions a schedule period to FINAL_LOCKED status.
   * After Final Lock, the schedule is published and immutable
   * (changes require 24-hour notice per Ontario ESA).
   */
  async lockPeriodFinal(
    period_id: string,
    actor_id: string,
    correlation_id: string,
  ): Promise<void> {
    const period = await this.prisma.schedulePeriod.findUnique({
      where: { id: period_id },
    });

    if (!period) {
      throw new Error(`SCHEDULE_PERIOD_NOT_FOUND: ${period_id}`);
    }

    if (period.status !== 'B_LOCKED') {
      throw new Error(
        `SCHEDULE_PERIOD_INVALID_STATE: Cannot Final-Lock period in ${period.status} state (must be B_LOCKED)`,
      );
    }

    // Run coverage scan before final lock to flag any gaps
    const gaps = await this.shiftCoverage.scanPeriodCoverage(period_id);

    if (gaps.length > 0) {
      this.logger.warn('SchedulingService: coverage gaps detected at Final Lock', {
        period_id,
        gap_count: gaps.length,
        gaps: gaps.map((g) => ({
          date: g.date,
          shift: g.shift_code,
          missing: g.gaps,
        })),
        rule_applied_id: this.RULE_ID,
      });
    }

    await this.prisma.schedulePeriod.update({
      where: { id: period_id },
      data: {
        status: 'FINAL_LOCKED',
        published_by: actor_id,
        published_at: new Date(),
      },
    });

    this.logger.log('SchedulingService: period Final-Locked', {
      period_id,
      period_ref: period.period_ref,
      coverage_gaps: gaps.length,
      rule_applied_id: this.RULE_ID,
    });

    this.nats.publish(NATS_TOPICS.SCHEDULE_PERIOD_FINAL_LOCKED, {
      period_id,
      period_ref: period.period_ref,
      department: period.department,
      coverage_gaps: gaps.length,
      correlation_id,
      rule_applied_id: this.RULE_ID,
    });

    await this.prisma.scheduleAuditLog.create({
      data: {
        event_type: 'PERIOD_FINAL_LOCKED',
        actor_id,
        target_id: period_id,
        target_type: 'PERIOD',
        department: period.department,
        details: { coverage_gaps: gaps.length },
        correlation_id,
        reason_code: 'FINAL_LOCK_PUBLICATION',
        rule_applied_id: this.RULE_ID,
      },
    });
  }

  /**
   * Assigns a staff member to a shift on a specific date.
   * Runs compliance checks (consecutive days, weekly hours, transit safety)
   * and stat holiday pay detection before persisting.
   */
  async assignShift(request: AssignShiftRequest): Promise<AssignShiftResult> {
    // Look up the shift template to determine the shift code
    const template = await this.prisma.shiftTemplate.findUnique({
      where: { id: request.shift_template_id },
    });

    if (!template) {
      throw new Error(
        `SHIFT_TEMPLATE_NOT_FOUND: Template ${request.shift_template_id} does not exist`,
      );
    }

    // Run compliance check
    const complianceResult = await this.complianceGuard.validateAssignment({
      staff_member_id: request.staff_member_id,
      proposed_date: request.shift_date,
      proposed_shift_code: template.shift_code as ShiftCode,
      schedule_period_id: request.schedule_period_id,
    });

    // Block assignment if hard errors exist
    if (!complianceResult.is_compliant) {
      this.logger.warn('SchedulingService: assignment blocked by compliance', {
        staff_member_id: request.staff_member_id,
        shift_date: request.shift_date,
        violations: complianceResult.warnings,
        rule_applied_id: this.RULE_ID,
      });

      return {
        assignment_id: '',
        staff_member_id: request.staff_member_id,
        shift_date: request.shift_date,
        is_stat_holiday: false,
        pay_multiplier: 1.0,
        compliance_warnings: complianceResult.warnings,
        rule_applied_id: this.RULE_ID,
      };
    }

    // Check for stat holiday pay
    const payMultiplier = await this.shiftCoverage.getStatHolidayMultiplier(request.shift_date);
    const isStatHoliday = payMultiplier > 1.0;

    // Also check shift notice compliance (warnings only, don't block)
    const noticeWarnings = this.complianceGuard.checkShiftNotice(
      request.shift_date,
      request.assignment_source === 'SWAP',
    );
    complianceResult.warnings.push(...noticeWarnings);

    const assignment = await this.prisma.shiftAssignment.create({
      data: {
        schedule_period_id: request.schedule_period_id,
        staff_member_id: request.staff_member_id,
        shift_template_id: request.shift_template_id,
        shift_date: new Date(request.shift_date),
        override_start_time: request.override_start_time,
        override_end_time: request.override_end_time,
        is_stat_holiday: isStatHoliday,
        pay_multiplier: payMultiplier,
        assignment_source: request.assignment_source,
        on_call: request.on_call ?? false,
        meal_cover_role: request.meal_cover_role ?? false,
        correlation_id: request.correlation_id,
        reason_code: request.reason_code,
        rule_applied_id: this.RULE_ID,
      },
    });

    this.logger.log('SchedulingService: shift assigned', {
      assignment_id: assignment.id,
      staff_member_id: request.staff_member_id,
      shift_date: request.shift_date,
      shift_code: template.shift_code,
      is_stat_holiday: isStatHoliday,
      pay_multiplier: payMultiplier,
      assignment_source: request.assignment_source,
      rule_applied_id: this.RULE_ID,
    });

    this.nats.publish(NATS_TOPICS.SCHEDULE_SHIFT_ASSIGNED, {
      assignment_id: assignment.id,
      staff_member_id: request.staff_member_id,
      shift_date: request.shift_date,
      shift_code: template.shift_code,
      is_stat_holiday: isStatHoliday,
      pay_multiplier: payMultiplier,
      assignment_source: request.assignment_source,
      correlation_id: request.correlation_id,
      rule_applied_id: this.RULE_ID,
    });

    // Audit log
    await this.prisma.scheduleAuditLog.create({
      data: {
        event_type: 'SHIFT_ASSIGNED',
        actor_id: request.actor_id,
        target_id: assignment.id,
        target_type: 'SHIFT',
        department: template.department,
        details: {
          staff_member_id: request.staff_member_id,
          shift_date: request.shift_date,
          shift_code: template.shift_code,
          assignment_source: request.assignment_source,
          is_stat_holiday: isStatHoliday,
        },
        correlation_id: request.correlation_id,
        reason_code: request.reason_code,
        rule_applied_id: this.RULE_ID,
      },
    });

    return {
      assignment_id: assignment.id,
      staff_member_id: request.staff_member_id,
      shift_date: request.shift_date,
      is_stat_holiday: isStatHoliday,
      pay_multiplier: payMultiplier,
      compliance_warnings: complianceResult.warnings,
      rule_applied_id: this.RULE_ID,
    };
  }

  /**
   * Swaps a shift assignment between two staff members on the same date.
   * Validates compliance for both members before executing.
   * Publishes SCHEDULE_SHIFT_SWAPPED event and audit logs the swap.
   */
  async swapShift(params: {
    assignment_id_a: string;
    assignment_id_b: string;
    actor_id: string;
    correlation_id: string;
    reason_code: string;
  }): Promise<{
    swapped: boolean;
    compliance_warnings: import('./scheduling.interfaces').ComplianceWarning[];
    rule_applied_id: string;
  }> {
    const assignmentA = await this.prisma.shiftAssignment.findUnique({
      where: { id: params.assignment_id_a },
    });
    const assignmentB = await this.prisma.shiftAssignment.findUnique({
      where: { id: params.assignment_id_b },
    });

    if (!assignmentA || !assignmentB) {
      throw new Error('SHIFT_SWAP_NOT_FOUND: One or both assignments do not exist');
    }

    const templateA = await this.prisma.shiftTemplate.findUnique({
      where: { id: assignmentA.shift_template_id },
    });
    const templateB = await this.prisma.shiftTemplate.findUnique({
      where: { id: assignmentB.shift_template_id },
    });

    if (!templateA || !templateB) {
      throw new Error('SHIFT_SWAP_TEMPLATE_NOT_FOUND: Shift templates missing');
    }

    // Validate compliance for staff A taking staff B's shift
    const checkA = await this.complianceGuard.validateAssignment({
      staff_member_id: assignmentA.staff_member_id,
      proposed_date: assignmentB.shift_date.toISOString().split('T')[0],
      proposed_shift_code: templateB.shift_code as ShiftCode,
      schedule_period_id: assignmentB.schedule_period_id,
    });

    // Validate compliance for staff B taking staff A's shift
    const checkB = await this.complianceGuard.validateAssignment({
      staff_member_id: assignmentB.staff_member_id,
      proposed_date: assignmentA.shift_date.toISOString().split('T')[0],
      proposed_shift_code: templateA.shift_code as ShiftCode,
      schedule_period_id: assignmentA.schedule_period_id,
    });

    const allWarnings = [...checkA.warnings, ...checkB.warnings];

    if (!checkA.is_compliant || !checkB.is_compliant) {
      this.logger.warn('SchedulingService: shift swap blocked by compliance', {
        assignment_id_a: params.assignment_id_a,
        assignment_id_b: params.assignment_id_b,
        violations: allWarnings.filter((w) => w.severity === 'ERROR'),
        rule_applied_id: this.RULE_ID,
      });

      return {
        swapped: false,
        compliance_warnings: allWarnings,
        rule_applied_id: this.RULE_ID,
      };
    }

    // Execute the swap — exchange staff_member_id and assignment_source
    await this.prisma.shiftAssignment.update({
      where: { id: params.assignment_id_a },
      data: {
        staff_member_id: assignmentB.staff_member_id,
        assignment_source: 'SWAP',
      },
    });

    await this.prisma.shiftAssignment.update({
      where: { id: params.assignment_id_b },
      data: {
        staff_member_id: assignmentA.staff_member_id,
        assignment_source: 'SWAP',
      },
    });

    this.logger.log('SchedulingService: shift swap completed', {
      assignment_id_a: params.assignment_id_a,
      assignment_id_b: params.assignment_id_b,
      staff_a: assignmentA.staff_member_id,
      staff_b: assignmentB.staff_member_id,
      rule_applied_id: this.RULE_ID,
    });

    this.nats.publish(NATS_TOPICS.SCHEDULE_SHIFT_SWAPPED, {
      assignment_id_a: params.assignment_id_a,
      assignment_id_b: params.assignment_id_b,
      staff_a: assignmentA.staff_member_id,
      staff_b: assignmentB.staff_member_id,
      correlation_id: params.correlation_id,
      rule_applied_id: this.RULE_ID,
    });

    await this.prisma.scheduleAuditLog.create({
      data: {
        event_type: 'SHIFT_SWAPPED',
        actor_id: params.actor_id,
        target_id: params.assignment_id_a,
        target_type: 'SHIFT',
        details: {
          assignment_id_a: params.assignment_id_a,
          assignment_id_b: params.assignment_id_b,
          staff_a: assignmentA.staff_member_id,
          staff_b: assignmentB.staff_member_id,
        },
        correlation_id: params.correlation_id,
        reason_code: params.reason_code,
        rule_applied_id: this.RULE_ID,
      },
    });

    return {
      swapped: true,
      compliance_warnings: allWarnings,
      rule_applied_id: this.RULE_ID,
    };
  }

  /**
   * Retrieves a schedule period by ID with all associated assignments.
   */
  async getPeriod(period_id: string): Promise<{
    period: Record<string, unknown>;
    assignments: Record<string, unknown>[];
    rule_applied_id: string;
  }> {
    const period = await this.prisma.schedulePeriod.findUnique({
      where: { id: period_id },
    });

    if (!period) {
      throw new Error(`SCHEDULE_PERIOD_NOT_FOUND: ${period_id}`);
    }

    const assignments = await this.prisma.shiftAssignment.findMany({
      where: { schedule_period_id: period_id },
      orderBy: [{ shift_date: 'asc' }],
    });

    return {
      period: {
        id: period.id,
        period_ref: period.period_ref,
        department: period.department,
        period_start: period.period_start.toISOString().split('T')[0],
        period_end: period.period_end.toISOString().split('T')[0],
        block_cutoff_at: period.block_cutoff_at.toISOString(),
        final_lock_at: period.final_lock_at.toISOString(),
        status: period.status,
        published_by: period.published_by,
        published_at: period.published_at?.toISOString() ?? null,
      },
      assignments: assignments.map((a) => ({
        id: a.id,
        staff_member_id: a.staff_member_id,
        shift_template_id: a.shift_template_id,
        shift_date: a.shift_date.toISOString().split('T')[0],
        is_stat_holiday: a.is_stat_holiday,
        pay_multiplier: Number(a.pay_multiplier),
        assignment_source: a.assignment_source,
        on_call: a.on_call,
        meal_cover_role: a.meal_cover_role,
      })),
      rule_applied_id: this.RULE_ID,
    };
  }

  /**
   * Checks if B-Lock or Final Lock deadlines have passed for any DRAFT
   * or B_LOCKED periods. Publishes reminder events for upcoming deadlines.
   */
  async checkPeriodDeadlines(correlation_id: string): Promise<void> {
    const now = new Date();

    // Auto-transition DRAFT periods past B-Lock cutoff
    const draftPastBLock = await this.prisma.schedulePeriod.findMany({
      where: {
        status: 'DRAFT',
        block_cutoff_at: { lte: now },
      },
    });

    for (const period of draftPastBLock) {
      await this.lockPeriodBLock(period.id, 'SYSTEM', correlation_id);
    }

    // Auto-transition B_LOCKED periods past Final Lock
    const bLockedPastFinal = await this.prisma.schedulePeriod.findMany({
      where: {
        status: 'B_LOCKED',
        final_lock_at: { lte: now },
      },
    });

    for (const period of bLockedPastFinal) {
      await this.lockPeriodFinal(period.id, 'SYSTEM', correlation_id);
    }

    // Send reminders for upcoming B-Lock cutoffs
    const dayMs = 86_400_000;
    for (const reminderDays of GZ_SCHEDULING.BLOCK_REMINDER_DAYS) {
      const reminderWindow = new Date(now.getTime() + reminderDays * dayMs);
      const reminderWindowEnd = new Date(reminderWindow.getTime() + dayMs);

      const upcomingPeriods = await this.prisma.schedulePeriod.findMany({
        where: {
          status: 'DRAFT',
          period_start: {
            gte: reminderWindow,
            lt: reminderWindowEnd,
          },
        },
      });

      for (const period of upcomingPeriods) {
        this.nats.publish(NATS_TOPICS.SCHEDULE_REMINDER_BLOCK_CUTOFF, {
          period_id: period.id,
          period_ref: period.period_ref,
          department: period.department,
          days_until_block_cutoff: reminderDays - GZ_SCHEDULING.BLOCK_CUTOFF_DAYS_BEFORE,
          block_cutoff_at: period.block_cutoff_at.toISOString(),
          correlation_id,
          rule_applied_id: this.RULE_ID,
        });
      }
    }

    this.logger.log('SchedulingService: deadline check complete', {
      auto_b_locked: draftPastBLock.length,
      auto_final_locked: bLockedPastFinal.length,
      rule_applied_id: this.RULE_ID,
    });
  }
}
