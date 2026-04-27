// services/core-api/src/scheduling/scheduling.constants.ts
// GZ-SCHEDULE: Derived constants and role-based rules.
// All base values sourced from governance.config.ts — this file computes
// derived guardrails and mappings only.

import type { StaffRole, Department, ShiftCode } from './scheduling.interfaces';

/** Roles that count as supervisory for coverage validation. */
export const SUPERVISORY_ROLES: readonly StaffRole[] = ['GZM', 'GZAM', 'GZS'] as const;

/** Roles eligible for meal-break swing coverage. */
export const MEAL_COVER_ROLES: readonly StaffRole[] = ['GZM', 'GZAM', 'GZS'] as const;

/** Shift meal-break swing responsibility by shift code. */
export const MEAL_COVER_BY_SHIFT: Record<ShiftCode, StaffRole[]> = {
  A: ['GZM'],
  B: ['GZAM', 'GZS'],
  C: ['GZS'],
};

/** Default rotation patterns by employment type. */
export const ROTATION_PATTERNS = {
  FT_CORE_MON_FRI: { work_days: [0, 1, 2, 3, 4], off_days: [5, 6] }, // Mon-Fri
  FT_CORE_WED_SUN: { work_days: [2, 3, 4, 5, 6], off_days: [0, 1] }, // Wed-Sun
  PT_EDGE: null, // Variable schedule, validated per assignment
} as const;

/** Day-of-week labels (0-indexed from Monday). */
export const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** Ontario 2026 Statutory Holidays. */
export const ONTARIO_STAT_HOLIDAYS_2026 = [
  { date: '2026-01-01', name: "New Year's Day" },
  { date: '2026-02-16', name: 'Family Day' },
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-05-18', name: 'Victoria Day' },
  { date: '2026-07-01', name: 'Canada Day' },
  { date: '2026-08-03', name: 'Civic Holiday' },
  { date: '2026-09-07', name: 'Labour Day' },
  { date: '2026-10-12', name: 'Thanksgiving Day' },
  { date: '2026-12-25', name: 'Christmas Day' },
  { date: '2026-12-26', name: 'Boxing Day' },
] as const;

/** Departments that require 24/7/365 coverage. */
export const DEPARTMENTS_24_7: readonly Department[] = ['GUESTZONE', 'TECH'] as const;

/** Finance department coverage config. */
export const FINANCE_COVERAGE = {
  manager_count: 1,
  asst_manager_count: 1,
  supervisor_count: 3,
  clerk_count: 4,
  crossover_mins: 30,
} as const;

/** Legal department coverage config. */
export const LEGAL_COVERAGE = {
  sr_rep_hours: { start: '09:00', end: '17:00' },
  jr_legal_hours: { start: '12:00', end: '20:00' },
  on_call_24_7_emergency: true,
} as const;

/** Maintenance coverage config. */
export const MAINTENANCE_COVERAGE = {
  shift_1: { start: '07:00', end: '16:00' },
  shift_2: { start: '16:00', end: '22:00' },
  cleaning_windows: [
    { start: '06:00', end: '08:00' },
    { start: '19:00', end: '21:00' },
  ],
  deep_clean_days: [0, 2, 4], // Mon, Wed, Fri
} as const;

/** Reception coverage config. */
export const RECEPTION_COVERAGE = {
  start: '08:00',
  end: '17:00',
  days: [0, 1, 2, 3, 4, 5, 6], // Mon-Sun
} as const;

/** GZ Master Schedule — canonical roster positions from the Operations Handbook. */
export const GZ_MASTER_ROSTER = {
  SHIFT_A: [
    {
      position: 'GZM-1',
      role: 'GZM' as StaffRole,
      pattern: 'FT_CORE_MON_FRI',
      category: 'CORE' as const,
    },
    {
      position: 'GZSA-1',
      role: 'GZSA' as StaffRole,
      pattern: 'FT_CORE_MON_FRI',
      category: 'CORE' as const,
    },
    {
      position: 'GZSA-2',
      role: 'GZSA' as StaffRole,
      pattern: 'FT_CORE_WED_SUN',
      category: 'CORE' as const,
    },
    {
      position: 'GZSA-3',
      role: 'GZSA' as StaffRole,
      pattern: 'PT_EDGE',
      category: 'EDGE' as const,
    },
  ],
  SHIFT_B: [
    {
      position: 'GZAM-1',
      role: 'GZAM' as StaffRole,
      pattern: 'FT_CORE_MON_FRI',
      category: 'CORE' as const,
    },
    {
      position: 'GZS-1',
      role: 'GZS' as StaffRole,
      pattern: 'FT_CORE_WED_SUN',
      category: 'CORE' as const,
    },
    {
      position: 'GZSA-4',
      role: 'GZSA' as StaffRole,
      pattern: 'FT_CORE_MON_FRI',
      category: 'CORE' as const,
    },
    {
      position: 'GZSA-5',
      role: 'GZSA' as StaffRole,
      pattern: 'FT_CORE_WED_SUN',
      category: 'CORE' as const,
    },
    {
      position: 'GZSA-9',
      role: 'GZSA' as StaffRole,
      pattern: 'PT_EDGE',
      category: 'EDGE' as const,
    },
  ],
  SHIFT_C: [
    {
      position: 'GZS-2',
      role: 'GZS' as StaffRole,
      pattern: 'FT_CORE_MON_FRI',
      category: 'CORE' as const,
    },
    {
      position: 'GZSA-6',
      role: 'GZSA' as StaffRole,
      pattern: 'FT_CORE_MON_FRI',
      category: 'CORE' as const,
    },
    {
      position: 'GZSA-7',
      role: 'GZSA' as StaffRole,
      pattern: 'FT_CORE_MON_FRI',
      category: 'CORE' as const,
    },
    { position: 'GZS-3', role: 'GZS' as StaffRole, pattern: 'PT_EDGE', category: 'EDGE' as const },
    {
      position: 'GZSA-8',
      role: 'GZSA' as StaffRole,
      pattern: 'PT_EDGE',
      category: 'EDGE' as const,
    },
    {
      position: 'GZSA-10',
      role: 'GZSA' as StaffRole,
      pattern: 'PT_EDGE',
      category: 'EDGE' as const,
    },
  ],
} as const;
