// services/zonebot-scheduler/src/interfaces.ts
// WO-002: HCZ ZoneBot Zoey — type definitions for the scheduling engine.

export interface Schedule {
  weekStart: string;                 // ISO date: YYYY-MM-DD
  department: string;
  generatedAt: string;               // ISO timestamp
  shifts: Shift[];
  violations: Violation[];
  budgetForecast?: BudgetSummary;
  ruleAppliedId: string;
}

export interface Shift {
  id?: string;
  staffMemberId: string;
  shiftDate: string;                 // ISO date
  startUtc: string;                  // ISO timestamp
  endUtc: string;                    // ISO timestamp
  breakStartUtc?: string;
  breakMinutes: number;
  isBreakLocked: boolean;
  payrollCode: string;               // REG, OT, STAT
  staggerOffsetMinutes: number;
  roleSegment?: Record<string, unknown>;
  overtimeMinutes: number;
  correlationId: string;
  ruleAppliedId: string;
}

export interface Violation {
  type: string;                      // e.g. REST_12H, MAX_CONSECUTIVE_6D, MIN_HOURS_FT
  severity: 'ERROR' | 'WARNING';
  staffMemberId: string;
  date?: string;
  message: string;
}

export interface BudgetSummary {
  weekStart: string;
  department: string;
  projectedFtHours: number;
  projectedPtHours: number;
  projectedOtHours: number;
  projectedLabourCadCents: number;
  headcountFt: number;
  headcountPt: number;
}

export interface GenerateScheduleDto {
  weekStart: string;
  department?: string;
  forecast?: Record<string, unknown>;
  correlationId: string;
  reasonCode: string;
}

export interface SwapDto {
  initiatorId: string;
  initiatorShiftId: string;
  recipientId: string;
  recipientShiftId: string;
  correlationId: string;
  reasonCode: string;
}

export interface WellbeingDto {
  staffMemberId: string;
  energyScore: number;
  stressScore: number;
  satisfactionScore: number;
  notes?: string;
  isAnonymous?: boolean;
  correlationId: string;
  reasonCode: string;
}

export interface HiringModelDto {
  weekStart: string;
  department: string;
  targetCoverageHours: number;
  currentHeadcountFt: number;
  currentHeadcountPt: number;
  correlationId: string;
}

export interface HiringModelResult {
  weekStart: string;
  department: string;
  recommendedFtAdditions: number;
  recommendedPtAdditions: number;
  projectedCoverageGapHours: number;
  confidenceScore: number;
  ruleAppliedId: string;
}

export interface FatigueReport {
  staffMemberId?: string;
  asOf: string;
  scores: Array<{
    staffMemberId: string;
    score: number;
    consecutiveDays: number;
    hoursPast7Days: number;
    recentOvertimeHours: number;
    flags?: Record<string, unknown>;
  }>;
}

export interface PayrollExport {
  weekStart: string;
  exportedAt: string;
  rows: Array<{
    staffMemberId: string;
    employeeRef: string;
    displayName: string;
    regularHours: number;
    overtimeHours: number;
    statHours: number;
    payrollCode: string;
    totalMinutes: number;
  }>;
  ruleAppliedId: string;
}

export interface BreakWindow {
  supervisorId?: string;
  suggestedWindows: Array<{
    startUtc: string;
    endUtc: string;
    durationMinutes: number;
    rationale: string;
  }>;
}
