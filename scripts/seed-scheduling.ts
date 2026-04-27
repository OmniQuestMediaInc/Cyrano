#!/usr/bin/env ts-node
// scripts/seed-scheduling.ts
// GZ-SCHEDULE: CLI seed script for the scheduling module.
// Usage: yarn seed:scheduling
//
// Seeds all scheduling data: shift templates, stat holidays (rolling 3-year),
// department coverage baselines, and GZ master roster positions.
// Idempotent — safe to run repeatedly.

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

// Import seed logic directly (no NestJS bootstrap required)
import {
  getRollingThreeYearHolidays,
} from '../services/core-api/src/scheduling/stat-holidays.seed';
import { GZ_SCHEDULING } from '../services/core-api/src/config/governance.config';
import { GZ_MASTER_ROSTER } from '../services/core-api/src/scheduling/scheduling.constants';

const prisma = new PrismaClient();

async function seedShiftTemplates(correlation_id: string): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  for (const [code, def] of Object.entries(GZ_SCHEDULING.SHIFTS)) {
    const existing = await prisma.shiftTemplate.findFirst({
      where: { shift_code: code, department: 'GUESTZONE' },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.shiftTemplate.create({
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
        reason_code: 'CLI_SEED_SHIFT_TEMPLATES',
        rule_applied_id: 'GZ_SHIFT_TEMPLATE_v1',
      },
    });
    created++;
  }

  console.log(`  Shift templates: ${created} created, ${skipped} skipped`);
  return { created, skipped };
}

async function seedStatHolidays(correlation_id: string): Promise<{ created: number; skipped: number }> {
  const holidays = getRollingThreeYearHolidays();
  let created = 0;
  let skipped = 0;

  for (const holiday of holidays) {
    const existing = await prisma.statHoliday.findFirst({
      where: { holiday_date: new Date(holiday.date) },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.statHoliday.create({
      data: {
        holiday_date: new Date(holiday.date),
        holiday_name: holiday.name,
        pay_multiplier: GZ_SCHEDULING.STAT_HOLIDAY_PAY_MULTIPLIER,
        requires_on_call_manager: true,
        correlation_id,
        reason_code: 'CLI_SEED_ROLLING_STAT_HOLIDAYS',
        rule_applied_id: 'GZ_STAT_HOLIDAY_v1',
      },
    });
    created++;
  }

  const year = new Date().getFullYear();
  console.log(`  Stat holidays (${year}-${year + 2}): ${created} created, ${skipped} skipped`);
  return { created, skipped };
}

async function seedMasterRoster(correlation_id: string): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  const shiftEntries = [
    { shift: 'A', roster: GZ_MASTER_ROSTER.SHIFT_A },
    { shift: 'B', roster: GZ_MASTER_ROSTER.SHIFT_B },
    { shift: 'C', roster: GZ_MASTER_ROSTER.SHIFT_C },
  ] as const;

  for (const { roster } of shiftEntries) {
    for (const position of roster) {
      const employeeRef = `GZ-${position.position}`;

      const existing = await prisma.staffMember.findFirst({
        where: { employee_ref: employeeRef },
      });

      if (existing) {
        skipped++;
        continue;
      }

      const employmentType = position.category === 'EDGE' ? 'PT' : 'FT';
      const isSalaried = employmentType === 'FT' && position.role !== 'GZSA';

      await prisma.staffMember.create({
        data: {
          employee_ref: employeeRef,
          display_name: `${position.position} (${position.role})`,
          role: position.role,
          employment_type: employmentType,
          staff_category: position.category,
          department: 'GUESTZONE',
          languages: ['EN'],
          hourly_rate_cad: isSalaried ? null : 22.00,
          annual_salary_cad: isSalaried
            ? position.role === 'GZM' ? 82500.00
            : position.role === 'GZAM' ? 75000.00
            : position.role === 'GZS' ? 63500.00
            : null
            : null,
          is_active: true,
          hire_date: new Date(),
          correlation_id,
          reason_code: 'CLI_SEED_MASTER_ROSTER',
        },
      });
      created++;
    }
  }

  console.log(`  Master roster: ${created} created, ${skipped} skipped`);
  return { created, skipped };
}

async function main(): Promise<void> {
  const correlation_id = `CLI-SEED-${randomUUID()}`;

  console.log('GZ Scheduling Module — Seed Script');
  console.log(`Correlation ID: ${correlation_id}`);
  console.log('---');

  try {
    await prisma.$connect();

    await seedShiftTemplates(correlation_id);
    await seedStatHolidays(correlation_id);
    await seedMasterRoster(correlation_id);

    console.log('---');
    console.log('Seed complete.');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
