// services/core-api/src/scheduling/scheduling.interfaces.ts
// GZ-SCHEDULE: Type definitions for the GuestZone scheduling module.

export type StaffRole = 'GZM' | 'GZAM' | 'GZS' | 'GZSA';

export type EmploymentType = 'FT' | 'PT';

export type StaffCategory = 'CORE' | 'EDGE';

export type Department = 'GUESTZONE' | 'FINANCE' | 'TECH' | 'LEGAL' | 'MAINTENANCE' | 'RECEPTION';

export type ShiftCode = 'A' | 'B' | 'C';

export type PeriodStatus = 'DRAFT' | 'B_LOCKED' | 'FINAL_LOCKED' | 'ACTIVE' | 'ARCHIVED';

export type GapStatus = 'OPEN' | 'BIDDING' | 'AWARDED' | 'FILLED' | 'CANCELLED';

export type BidStatus =
  | 'PENDING'
  | 'POSITION_ASSIGNED'
  | 'OFFERED'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'EXPIRED';

export type AssignmentSource = 'ROSTER' | 'ZONEBOT' | 'MANUAL' | 'SWAP';

export type ScheduleAuditEventType =
  | 'PERIOD_CREATED'
  | 'PERIOD_B_LOCKED'
  | 'PERIOD_FINAL_LOCKED'
  | 'SHIFT_ASSIGNED'
  | 'SHIFT_SWAPPED'
  | 'GAP_POSTED'
  | 'GAP_FILLED'
  | 'LOTTERY_RUN'
  | 'BID_OFFERED'
  | 'BID_AWARDED'
  | 'BID_EXPIRED'
  | 'COMPLIANCE_VIOLATION'
  | 'COVERAGE_GAP';

export interface ShiftDefinition {
  code: ShiftCode;
  label: string;
  start: string; // HH:mm
  end: string; // HH:mm
  duration_hours: number;
  meal_break_start: string;
  meal_break_mins: number;
}

export interface CreatePeriodRequest {
  department: Department;
  period_start: string; // YYYY-MM-DD
  actor_id: string;
  correlation_id: string;
  reason_code: string;
}

export interface CreatePeriodResult {
  period_id: string;
  period_ref: string;
  department: Department;
  period_start: string;
  period_end: string;
  block_cutoff_at: string;
  final_lock_at: string;
  status: PeriodStatus;
  rule_applied_id: string;
}

export interface AssignShiftRequest {
  schedule_period_id: string;
  staff_member_id: string;
  shift_template_id: string;
  shift_date: string; // YYYY-MM-DD
  override_start_time?: string;
  override_end_time?: string;
  assignment_source: AssignmentSource;
  on_call?: boolean;
  meal_cover_role?: boolean;
  actor_id: string;
  correlation_id: string;
  reason_code: string;
}

export interface AssignShiftResult {
  assignment_id: string;
  staff_member_id: string;
  shift_date: string;
  is_stat_holiday: boolean;
  pay_multiplier: number;
  compliance_warnings: ComplianceWarning[];
  rule_applied_id: string;
}

export interface PostGapRequest {
  schedule_period_id: string;
  shift_template_id: string;
  gap_date: string;
  department: Department;
  required_role: StaffRole;
  actor_id: string;
  correlation_id: string;
  reason_code: string;
}

export interface SubmitBidRequest {
  shift_gap_id: string;
  staff_member_id: string;
  correlation_id: string;
  reason_code: string;
}

export interface LotteryResult {
  shift_gap_id: string;
  positions: Array<{
    position: number;
    staff_member_id: string;
    bid_id: string;
  }>;
  rule_applied_id: string;
}

export interface ComplianceWarning {
  violation_type: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
  affected_staff_id?: string;
  affected_date?: string;
}

export interface ComplianceCheckRequest {
  staff_member_id: string;
  proposed_date: string;
  proposed_shift_code: ShiftCode;
  schedule_period_id: string;
}

export interface ComplianceCheckResult {
  is_compliant: boolean;
  warnings: ComplianceWarning[];
  rule_applied_id: string;
}

export interface CoverageReport {
  department: Department;
  date: string;
  shift_code: ShiftCode;
  required_count: number;
  assigned_count: number;
  is_covered: boolean;
  gaps: Array<{
    role: StaffRole;
    count_needed: number;
  }>;
  rule_applied_id: string;
}

export interface WeeklySummary {
  staff_member_id: string;
  week_start: string;
  total_hours: number;
  consecutive_days: number;
  shifts: Array<{
    date: string;
    shift_code: ShiftCode;
    hours: number;
  }>;
  stat_holiday_hours: number;
  on_call_shifts: number;
}
