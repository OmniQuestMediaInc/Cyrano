// services/core-api/src/scheduling/scheduling-seed.service.ts
// GZ-SCHEDULE: Runtime seed service for the scheduling module.
// Seeds shift templates, stat holidays (rolling 3-year window),
// department coverage baselines, and the GZ master roster.
// Designed to be called on-demand for testing or data initialization.
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma.service';
import { GZ_SCHEDULING } from '../config/governance.config';
import { SchedulingService } from './scheduling.service';
import { getRollingThreeYearHolidays, getHolidaysForYears } from './stat-holidays.seed';
import {
  FINANCE_COVERAGE,
  MAINTENANCE_COVERAGE,
  RECEPTION_COVERAGE,
  GZ_MASTER_ROSTER,
} from './scheduling.constants';

@Injectable()
export class SchedulingSeedService {
  private readonly logger = new Logger(SchedulingSeedService.name);
  private readonly RULE_ID = 'GZ_SCHEDULE_SEED_v1';

  constructor(
    private readonly prisma: PrismaService,
    private readonly schedulingService: SchedulingService,
  ) {}

  /**
   * Full seed — runs all seed operations. Idempotent.
   * Returns a summary of what was seeded.
   */
  async seedAll(): Promise<Record<string, unknown>> {
    const correlation_id = `SEED-${randomUUID()}`;
    const results: Record<string, unknown> = {};

    results.shift_templates = await this.seedShiftTemplates(correlation_id);
    results.stat_holidays = await this.seedRollingStatHolidays(correlation_id);
    results.department_coverage = await this.seedDepartmentCoverage(correlation_id);
    results.master_roster = await this.seedMasterRoster(correlation_id);

    this.logger.log('SchedulingSeedService: full seed completed', {
      results,
      correlation_id,
      rule_applied_id: this.RULE_ID,
    });

    return { ...results, correlation_id, rule_applied_id: this.RULE_ID };
  }

  /**
   * Seeds GuestZone A/B/C waterfall shift templates. Idempotent.
   */
  async seedShiftTemplates(correlation_id: string): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    for (const [code, def] of Object.entries(GZ_SCHEDULING.SHIFTS)) {
      const existing = await this.prisma.shiftTemplate.findFirst({
        where: { shift_code: code, department: 'GUESTZONE' },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await this.prisma.shiftTemplate.create({
        data: {
          shift_code: code,
          department: 'GUESTZONE',
          shift_label: def.label,
          start_time: def.start,
          end_time: def.end,
          duration_hours: def.duration_hours,
          meal_break_start: def.meal_break_start,
          meal_break_mins: def.meal_break_mins,
          correlation_id,
          reason_code: 'SEED_SHIFT_TEMPLATES',
          rule_applied_id: 'GZ_SHIFT_TEMPLATE_v1',
        },
      });
      created++;
    }

    this.logger.log('SchedulingSeedService: shift templates seeded', {
      created,
      skipped,
      rule_applied_id: this.RULE_ID,
    });

    return { created, skipped };
  }

  /**
   * Seeds Ontario stat holidays for a rolling 3-year window.
   * Always maintains current year + next 2 years. Idempotent.
   */
  async seedRollingStatHolidays(
    correlation_id: string,
    baseYear?: number,
  ): Promise<{ created: number; skipped: number; years: number[] }> {
    const year = baseYear ?? new Date().getFullYear();
    const years = [year, year + 1, year + 2];
    const holidays = getRollingThreeYearHolidays(year);

    let created = 0;
    let skipped = 0;

    for (const holiday of holidays) {
      const existing = await this.prisma.statHoliday.findFirst({
        where: { holiday_date: new Date(holiday.date) },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await this.prisma.statHoliday.create({
        data: {
          holiday_date: new Date(holiday.date),
          holiday_name: holiday.name,
          pay_multiplier: GZ_SCHEDULING.STAT_HOLIDAY_PAY_MULTIPLIER,
          requires_on_call_manager: true,
          correlation_id,
          reason_code: 'SEED_ROLLING_STAT_HOLIDAYS',
          rule_applied_id: 'GZ_STAT_HOLIDAY_v1',
        },
      });
      created++;
    }

    this.logger.log('SchedulingSeedService: stat holidays seeded', {
      created,
      skipped,
      years,
      rule_applied_id: this.RULE_ID,
    });

    return { created, skipped, years };
  }

  /**
   * Seeds specific years of stat holidays (for targeted testing).
   */
  async seedStatHolidaysForYears(
    years: number[],
    correlation_id: string,
  ): Promise<{ created: number; skipped: number }> {
    const holidays = getHolidaysForYears(years);
    let created = 0;
    let skipped = 0;

    for (const holiday of holidays) {
      const existing = await this.prisma.statHoliday.findFirst({
        where: { holiday_date: new Date(holiday.date) },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await this.prisma.statHoliday.create({
        data: {
          holiday_date: new Date(holiday.date),
          holiday_name: holiday.name,
          pay_multiplier: GZ_SCHEDULING.STAT_HOLIDAY_PAY_MULTIPLIER,
          requires_on_call_manager: true,
          correlation_id,
          reason_code: `SEED_HOLIDAYS_${years.join('_')}`,
          rule_applied_id: 'GZ_STAT_HOLIDAY_v1',
        },
      });
      created++;
    }

    return { created, skipped };
  }

  /**
   * Seeds department coverage baselines per the Operations Handbook.
   * GuestZone: 24/7 with 3-GZSA baseline.
   * Finance: 9 AM – 9 PM daily.
   * Tech: 24/7/365.
   * Legal: M-F 9-8, on-call weekends.
   * Maintenance: 7 AM – 10 PM daily.
   * Reception: 8 AM – 5 PM daily.
   */
  async seedDepartmentCoverage(
    correlation_id: string,
  ): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    const coverageEntries: Array<{
      department: string;
      day_of_week: number;
      coverage_start: string;
      coverage_end: string;
      min_staff_count: number;
      min_supervisor_count: number;
      requires_manager: boolean;
      is_on_call_only: boolean;
      crossover_mins: number;
    }> = [];

    // GuestZone — 24/7, 3 shifts, 3 agents per shift minimum
    for (let day = 0; day < 7; day++) {
      coverageEntries.push(
        {
          department: 'GUESTZONE',
          day_of_week: day,
          coverage_start: '07:00',
          coverage_end: '15:45',
          min_staff_count: 3,
          min_supervisor_count: 1,
          requires_manager: day < 5,
          is_on_call_only: false,
          crossover_mins: 15,
        },
        {
          department: 'GUESTZONE',
          day_of_week: day,
          coverage_start: '15:15',
          coverage_end: '00:00',
          min_staff_count: 3,
          min_supervisor_count: 1,
          requires_manager: day < 5,
          is_on_call_only: false,
          crossover_mins: 15,
        },
        {
          department: 'GUESTZONE',
          day_of_week: day,
          coverage_start: '23:30',
          coverage_end: '08:15',
          min_staff_count: 3,
          min_supervisor_count: 1,
          requires_manager: false,
          is_on_call_only: false,
          crossover_mins: 15,
        },
      );
    }

    // Finance — 9 AM – 9 PM daily
    for (let day = 0; day < 7; day++) {
      coverageEntries.push({
        department: 'FINANCE',
        day_of_week: day,
        coverage_start: '09:00',
        coverage_end: '21:00',
        min_staff_count: 3,
        min_supervisor_count: 1,
        requires_manager: true,
        is_on_call_only: false,
        crossover_mins: FINANCE_COVERAGE.crossover_mins,
      });
    }

    // Tech — 24/7/365
    for (let day = 0; day < 7; day++) {
      coverageEntries.push({
        department: 'TECH',
        day_of_week: day,
        coverage_start: '00:00',
        coverage_end: '23:59',
        min_staff_count: 2,
        min_supervisor_count: 1,
        requires_manager: false,
        is_on_call_only: false,
        crossover_mins: 0,
      });
    }

    // Legal — M-F onsite, weekend on-call
    for (let day = 0; day < 5; day++) {
      coverageEntries.push({
        department: 'LEGAL',
        day_of_week: day,
        coverage_start: '09:00',
        coverage_end: '20:00',
        min_staff_count: 2,
        min_supervisor_count: 0,
        requires_manager: false,
        is_on_call_only: false,
        crossover_mins: 0,
      });
    }
    for (let day = 5; day < 7; day++) {
      coverageEntries.push({
        department: 'LEGAL',
        day_of_week: day,
        coverage_start: '00:00',
        coverage_end: '23:59',
        min_staff_count: 1,
        min_supervisor_count: 0,
        requires_manager: false,
        is_on_call_only: true,
        crossover_mins: 0,
      });
    }

    // Maintenance — 7 AM – 10 PM daily (two shifts)
    for (let day = 0; day < 7; day++) {
      coverageEntries.push(
        {
          department: 'MAINTENANCE',
          day_of_week: day,
          coverage_start: MAINTENANCE_COVERAGE.shift_1.start,
          coverage_end: MAINTENANCE_COVERAGE.shift_1.end,
          min_staff_count: 1,
          min_supervisor_count: 0,
          requires_manager: false,
          is_on_call_only: false,
          crossover_mins: 0,
        },
        {
          department: 'MAINTENANCE',
          day_of_week: day,
          coverage_start: MAINTENANCE_COVERAGE.shift_2.start,
          coverage_end: MAINTENANCE_COVERAGE.shift_2.end,
          min_staff_count: 1,
          min_supervisor_count: 0,
          requires_manager: false,
          is_on_call_only: false,
          crossover_mins: 0,
        },
      );
    }

    // Reception — 8 AM – 5 PM daily
    for (let day = 0; day < 7; day++) {
      coverageEntries.push({
        department: 'RECEPTION',
        day_of_week: day,
        coverage_start: RECEPTION_COVERAGE.start,
        coverage_end: RECEPTION_COVERAGE.end,
        min_staff_count: 1,
        min_supervisor_count: 0,
        requires_manager: false,
        is_on_call_only: false,
        crossover_mins: 0,
      });
    }

    for (const entry of coverageEntries) {
      const existing = await this.prisma.departmentCoverage.findFirst({
        where: {
          department: entry.department,
          day_of_week: entry.day_of_week,
          coverage_start: entry.coverage_start,
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await this.prisma.departmentCoverage.create({
        data: {
          ...entry,
          correlation_id,
          reason_code: 'SEED_DEPARTMENT_COVERAGE',
          rule_applied_id: 'GZ_DEPT_COVERAGE_v1',
        },
      });
      created++;
    }

    this.logger.log('SchedulingSeedService: department coverage seeded', {
      created,
      skipped,
      rule_applied_id: this.RULE_ID,
    });

    return { created, skipped };
  }

  /**
   * Seeds the GZ Master Roster — canonical staff positions from the
   * Operations Handbook. Creates placeholder StaffMember records for
   * each position across all three shifts (A/B/C).
   * Idempotent — skips positions that already exist by employee_ref.
   */
  async seedMasterRoster(correlation_id: string): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    const shiftEntries = [
      { roster: GZ_MASTER_ROSTER.SHIFT_A },
      { roster: GZ_MASTER_ROSTER.SHIFT_B },
      { roster: GZ_MASTER_ROSTER.SHIFT_C },
    ] as const;

    for (const { roster } of shiftEntries) {
      for (const position of roster) {
        const employeeRef = `GZ-${position.position}`;

        const existing = await this.prisma.staffMember.findFirst({
          where: { employee_ref: employeeRef },
        });

        if (existing) {
          skipped++;
          continue;
        }

        const employmentType = position.category === 'EDGE' ? 'PT' : 'FT';
        const isSalaried = employmentType === 'FT' && position.role !== 'GZSA';

        await this.prisma.staffMember.create({
          data: {
            employee_ref: employeeRef,
            display_name: `${position.position} (${position.role})`,
            role: position.role,
            employment_type: employmentType,
            staff_category: position.category,
            department: 'GUESTZONE',
            languages: ['EN'],
            hourly_rate_cad: isSalaried ? null : 22.0,
            annual_salary_cad: isSalaried
              ? position.role === 'GZM'
                ? 82500.0
                : position.role === 'GZAM'
                  ? 75000.0
                  : position.role === 'GZS'
                    ? 63500.0
                    : null
              : null,
            is_active: true,
            hire_date: new Date(),
            correlation_id,
            reason_code: 'SEED_MASTER_ROSTER',
          },
        });
        created++;
      }
    }

    this.logger.log('SchedulingSeedService: master roster seeded', {
      created,
      skipped,
      rule_applied_id: this.RULE_ID,
    });

    return { created, skipped };
  }
}
