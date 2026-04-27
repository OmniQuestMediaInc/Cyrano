-- GZ-SCHEDULE: GuestZone Operations Scheduling Module
-- Waterfall shifts, ZoneBot lottery, multi-department coverage, Ontario ESA 2026 compliance.
-- Migration: 20260412000000_gz_scheduling_module

-- ── Staff Members ────────────────────────────────────────────────────────────
CREATE TABLE "staff_members" (
    "id"                TEXT NOT NULL DEFAULT gen_random_uuid(),
    "employee_ref"      VARCHAR(50) NOT NULL,
    "display_name"      VARCHAR(100) NOT NULL,
    "role"              VARCHAR(20) NOT NULL,
    "employment_type"   VARCHAR(10) NOT NULL,
    "staff_category"    VARCHAR(10) NOT NULL,
    "department"        VARCHAR(30) NOT NULL,
    "languages"         TEXT[] NOT NULL,
    "hourly_rate_cad"   DECIMAL(8,2),
    "annual_salary_cad" DECIMAL(10,2),
    "is_active"         BOOLEAN NOT NULL DEFAULT true,
    "hire_date"         DATE NOT NULL,
    "correlation_id"    VARCHAR(64) NOT NULL,
    "reason_code"       VARCHAR(100) NOT NULL,
    "created_at"        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "staff_members_employee_ref_key" ON "staff_members"("employee_ref");

-- ── Schedule Periods (Rolling 2-week cycles) ─────────────────────────────────
CREATE TABLE "schedule_periods" (
    "id"                TEXT NOT NULL DEFAULT gen_random_uuid(),
    "period_ref"        VARCHAR(50) NOT NULL,
    "department"        VARCHAR(30) NOT NULL,
    "period_start"      DATE NOT NULL,
    "period_end"        DATE NOT NULL,
    "block_cutoff_at"   TIMESTAMPTZ NOT NULL,
    "final_lock_at"     TIMESTAMPTZ NOT NULL,
    "status"            VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "published_by"      UUID,
    "published_at"      TIMESTAMPTZ,
    "correlation_id"    VARCHAR(64) NOT NULL,
    "reason_code"       VARCHAR(100) NOT NULL,
    "rule_applied_id"   VARCHAR(100) NOT NULL DEFAULT 'GZ_SCHEDULE_v1',
    "created_at"        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_periods_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "schedule_periods_period_ref_key" ON "schedule_periods"("period_ref");

-- ── Shift Templates (A/B/C Waterfall) ────────────────────────────────────────
CREATE TABLE "shift_templates" (
    "id"                TEXT NOT NULL DEFAULT gen_random_uuid(),
    "shift_code"        VARCHAR(10) NOT NULL,
    "department"        VARCHAR(30) NOT NULL,
    "shift_label"       VARCHAR(50) NOT NULL,
    "start_time"        VARCHAR(5) NOT NULL,
    "end_time"          VARCHAR(5) NOT NULL,
    "duration_hours"    DECIMAL(4,2) NOT NULL,
    "meal_break_start"  VARCHAR(5),
    "meal_break_mins"   INTEGER,
    "is_active"         BOOLEAN NOT NULL DEFAULT true,
    "correlation_id"    VARCHAR(64) NOT NULL,
    "reason_code"       VARCHAR(100) NOT NULL,
    "rule_applied_id"   VARCHAR(100) NOT NULL DEFAULT 'GZ_SHIFT_TEMPLATE_v1',
    "created_at"        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shift_templates_shift_code_department_key" ON "shift_templates"("shift_code", "department");

-- ── Shift Assignments ────────────────────────────────────────────────────────
CREATE TABLE "shift_assignments" (
    "id"                    TEXT NOT NULL DEFAULT gen_random_uuid(),
    "schedule_period_id"    UUID NOT NULL,
    "staff_member_id"       UUID NOT NULL,
    "shift_template_id"     UUID NOT NULL,
    "shift_date"            DATE NOT NULL,
    "override_start_time"   VARCHAR(5),
    "override_end_time"     VARCHAR(5),
    "is_stat_holiday"       BOOLEAN NOT NULL DEFAULT false,
    "pay_multiplier"        DECIMAL(3,2) NOT NULL DEFAULT 1.00,
    "assignment_source"     VARCHAR(20) NOT NULL,
    "on_call"               BOOLEAN NOT NULL DEFAULT false,
    "meal_cover_role"       BOOLEAN NOT NULL DEFAULT false,
    "correlation_id"        VARCHAR(64) NOT NULL,
    "reason_code"           VARCHAR(100) NOT NULL,
    "rule_applied_id"       VARCHAR(100) NOT NULL DEFAULT 'GZ_SHIFT_ASSIGN_v1',
    "created_at"            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shift_assignments_staff_member_id_shift_date_key" ON "shift_assignments"("staff_member_id", "shift_date");

-- ── Shift Gaps (for ZoneBot lottery) ─────────────────────────────────────────
CREATE TABLE "shift_gaps" (
    "id"                    TEXT NOT NULL DEFAULT gen_random_uuid(),
    "schedule_period_id"    UUID NOT NULL,
    "shift_template_id"     UUID NOT NULL,
    "gap_date"              DATE NOT NULL,
    "department"            VARCHAR(30) NOT NULL,
    "required_role"         VARCHAR(20) NOT NULL,
    "status"                VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    "posted_at"             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filled_at"             TIMESTAMPTZ,
    "filled_by"             UUID,
    "correlation_id"        VARCHAR(64) NOT NULL,
    "reason_code"           VARCHAR(100) NOT NULL,
    "rule_applied_id"       VARCHAR(100) NOT NULL DEFAULT 'GZ_SHIFT_GAP_v1',
    "created_at"            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_gaps_pkey" PRIMARY KEY ("id")
);

-- ── Shift Bids (ZoneBot 1-2-3 lottery bids) ─────────────────────────────────
CREATE TABLE "shift_bids" (
    "id"                TEXT NOT NULL DEFAULT gen_random_uuid(),
    "shift_gap_id"      UUID NOT NULL,
    "staff_member_id"   UUID NOT NULL,
    "lottery_position"  INTEGER,
    "status"            VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "offered_at"        TIMESTAMPTZ,
    "expires_at"        TIMESTAMPTZ,
    "responded_at"      TIMESTAMPTZ,
    "suppressed_until"  DATE,
    "correlation_id"    VARCHAR(64) NOT NULL,
    "reason_code"       VARCHAR(100) NOT NULL,
    "rule_applied_id"   VARCHAR(100) NOT NULL DEFAULT 'GZ_ZONEBOT_BID_v1',
    "created_at"        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_bids_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shift_bids_shift_gap_id_staff_member_id_key" ON "shift_bids"("shift_gap_id", "staff_member_id");

-- ── Schedule Audit Log (append-only — no UPDATE or DELETE permitted) ─────────
CREATE TABLE "schedule_audit_log" (
    "id"                TEXT NOT NULL DEFAULT gen_random_uuid(),
    "event_type"        VARCHAR(50) NOT NULL,
    "actor_id"          VARCHAR(100) NOT NULL,
    "target_id"         VARCHAR(100),
    "target_type"       VARCHAR(30),
    "department"        VARCHAR(30),
    "details"           JSONB,
    "correlation_id"    VARCHAR(64) NOT NULL,
    "reason_code"       VARCHAR(100) NOT NULL,
    "rule_applied_id"   VARCHAR(100) NOT NULL DEFAULT 'GZ_SCHEDULE_AUDIT_v1',
    "created_at"        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_audit_log_pkey" PRIMARY KEY ("id")
);

-- Prevent UPDATE and DELETE on audit log (append-only invariant)
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'schedule_audit_log is append-only. UPDATE and DELETE are prohibited.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_schedule_audit_no_update
    BEFORE UPDATE ON "schedule_audit_log"
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

CREATE TRIGGER trg_schedule_audit_no_delete
    BEFORE DELETE ON "schedule_audit_log"
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

-- ── Department Coverage Requirements ─────────────────────────────────────────
CREATE TABLE "department_coverage" (
    "id"                    TEXT NOT NULL DEFAULT gen_random_uuid(),
    "department"            VARCHAR(30) NOT NULL,
    "day_of_week"           INTEGER NOT NULL,
    "coverage_start"        VARCHAR(5) NOT NULL,
    "coverage_end"          VARCHAR(5) NOT NULL,
    "min_staff_count"       INTEGER NOT NULL,
    "min_supervisor_count"  INTEGER NOT NULL DEFAULT 1,
    "requires_manager"      BOOLEAN NOT NULL DEFAULT false,
    "is_on_call_only"       BOOLEAN NOT NULL DEFAULT false,
    "crossover_mins"        INTEGER NOT NULL DEFAULT 30,
    "correlation_id"        VARCHAR(64) NOT NULL,
    "reason_code"           VARCHAR(100) NOT NULL,
    "rule_applied_id"       VARCHAR(100) NOT NULL DEFAULT 'GZ_DEPT_COVERAGE_v1',
    "created_at"            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "department_coverage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "department_coverage_department_day_of_week_coverage_start_key"
    ON "department_coverage"("department", "day_of_week", "coverage_start");

-- ── Statutory Holidays ───────────────────────────────────────────────────────
CREATE TABLE "stat_holidays" (
    "id"                        TEXT NOT NULL DEFAULT gen_random_uuid(),
    "holiday_date"              DATE NOT NULL,
    "holiday_name"              VARCHAR(100) NOT NULL,
    "pay_multiplier"            DECIMAL(3,2) NOT NULL DEFAULT 1.50,
    "requires_on_call_manager"  BOOLEAN NOT NULL DEFAULT true,
    "correlation_id"            VARCHAR(64) NOT NULL,
    "reason_code"               VARCHAR(100) NOT NULL,
    "rule_applied_id"           VARCHAR(100) NOT NULL DEFAULT 'GZ_STAT_HOLIDAY_v1',
    "created_at"                TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stat_holidays_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stat_holidays_holiday_date_key" ON "stat_holidays"("holiday_date");

-- ── Indexes for common query patterns ────────────────────────────────────────
CREATE INDEX "idx_shift_assignments_period" ON "shift_assignments"("schedule_period_id");
CREATE INDEX "idx_shift_assignments_staff_date" ON "shift_assignments"("staff_member_id", "shift_date");
CREATE INDEX "idx_shift_gaps_period_status" ON "shift_gaps"("schedule_period_id", "status");
CREATE INDEX "idx_shift_bids_gap_status" ON "shift_bids"("shift_gap_id", "status");
CREATE INDEX "idx_shift_bids_staff" ON "shift_bids"("staff_member_id", "status");
CREATE INDEX "idx_schedule_audit_log_type" ON "schedule_audit_log"("event_type", "created_at");
CREATE INDEX "idx_staff_members_dept_role" ON "staff_members"("department", "role", "is_active");
