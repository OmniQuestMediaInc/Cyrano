-- WO-002 + ALL CEO CLARIFICATIONS — ZoneBot ("Zoey") Final
-- HCZ: zonebot-scheduler — Prisma migration 20260425100000
-- NOTE: ZoneCrewMember was previously renamed to StaffMember (staff_members).
--       This migration adds new HCZ scheduling columns to the existing table
--       and creates all auxiliary tables.

-- ── New columns on staff_members ──────────────────────────────────────────────
ALTER TABLE "staff_members"
  ADD COLUMN IF NOT EXISTS "target_weekly_hours"    INTEGER NOT NULL DEFAULT 385,
  ADD COLUMN IF NOT EXISTS "min_weekly_hours"       INTEGER NOT NULL DEFAULT 360,
  ADD COLUMN IF NOT EXISTS "jurisdiction"           TEXT    NOT NULL DEFAULT 'ON',
  ADD COLUMN IF NOT EXISTS "birthday"               DATE,
  ADD COLUMN IF NOT EXISTS "sick_hours_remaining"   INTEGER NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS "sick_carryover_hours"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "sick_carryover_expires" DATE;

-- ── hcz_shifts — Zoey-managed shift records ──────────────────────────────────
CREATE TABLE IF NOT EXISTS "hcz_shifts" (
  "id"                    UUID        NOT NULL DEFAULT gen_random_uuid(),
  "staff_member_id"       UUID        NOT NULL,
  "schedule_period_id"    UUID,
  "shift_date"            DATE        NOT NULL,
  "start_utc"             TIMESTAMPTZ NOT NULL,
  "end_utc"               TIMESTAMPTZ NOT NULL,
  "break_start_utc"       TIMESTAMPTZ,
  "break_minutes"         INTEGER     NOT NULL DEFAULT 30,
  "is_break_locked"       BOOLEAN     NOT NULL DEFAULT false,
  "locked_by_staff_id"    UUID,
  "actual_start_utc"      TIMESTAMPTZ,
  "actual_end_utc"        TIMESTAMPTZ,
  "payroll_code"          TEXT        NOT NULL DEFAULT 'REG',
  "overtime_minutes"      INTEGER     NOT NULL DEFAULT 0,
  "reason_code"           TEXT,
  "override_by"           UUID,
  "override_reason"       TEXT,
  "role_segment"          JSONB,
  "stagger_offset_minutes" INTEGER    DEFAULT 0,
  "correlation_id"        TEXT        NOT NULL,
  "rule_applied_id"       TEXT        NOT NULL DEFAULT 'HCZ_ZOEY_SHIFT_v1',
  "created_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "hcz_shifts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "hcz_shifts_staff_date_idx" ON "hcz_shifts" ("staff_member_id", "shift_date");
CREATE INDEX IF NOT EXISTS "hcz_shifts_date_idx"       ON "hcz_shifts" ("shift_date");

-- ── hcz_leave_requests ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "hcz_leave_requests" (
  "id"                UUID        NOT NULL DEFAULT gen_random_uuid(),
  "staff_member_id"   UUID        NOT NULL,
  "leave_type"        TEXT        NOT NULL,    -- SICK, VACATION, PERSONAL, BEREAVEMENT
  "start_date"        DATE        NOT NULL,
  "end_date"          DATE        NOT NULL,
  "hours_requested"   INTEGER     NOT NULL,
  "status"            TEXT        NOT NULL DEFAULT 'PENDING',  -- PENDING, APPROVED, DENIED
  "approved_by"       UUID,
  "approved_at"       TIMESTAMPTZ,
  "denial_reason"     TEXT,
  "correlation_id"    TEXT        NOT NULL,
  "reason_code"       TEXT        NOT NULL,
  "rule_applied_id"   TEXT        NOT NULL DEFAULT 'HCZ_LEAVE_v1',
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "hcz_leave_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "hcz_leave_requests_staff_idx" ON "hcz_leave_requests" ("staff_member_id");

-- ── hcz_shift_offers — voluntary open-shift offers posted by staff ────────────
CREATE TABLE IF NOT EXISTS "hcz_shift_offers" (
  "id"                UUID        NOT NULL DEFAULT gen_random_uuid(),
  "shift_id"          UUID        NOT NULL,
  "offered_by"        UUID        NOT NULL,
  "status"            TEXT        NOT NULL DEFAULT 'OPEN',  -- OPEN, CLAIMED, EXPIRED, CANCELLED
  "claimed_by"        UUID,
  "claimed_at"        TIMESTAMPTZ,
  "expires_at"        TIMESTAMPTZ,
  "correlation_id"    TEXT        NOT NULL,
  "reason_code"       TEXT        NOT NULL,
  "rule_applied_id"   TEXT        NOT NULL DEFAULT 'HCZ_SHIFT_OFFER_v1',
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "hcz_shift_offers_pkey" PRIMARY KEY ("id")
);

-- ── hcz_shift_swaps — bilateral shift exchanges ───────────────────────────────
CREATE TABLE IF NOT EXISTS "hcz_shift_swaps" (
  "id"                UUID        NOT NULL DEFAULT gen_random_uuid(),
  "initiator_id"      UUID        NOT NULL,
  "initiator_shift_id" UUID       NOT NULL,
  "recipient_id"      UUID        NOT NULL,
  "recipient_shift_id" UUID       NOT NULL,
  "status"            TEXT        NOT NULL DEFAULT 'PENDING',  -- PENDING, APPROVED, REJECTED, CANCELLED
  "approved_by"       UUID,
  "approved_at"       TIMESTAMPTZ,
  "rejection_reason"  TEXT,
  "correlation_id"    TEXT        NOT NULL,
  "reason_code"       TEXT        NOT NULL,
  "rule_applied_id"   TEXT        NOT NULL DEFAULT 'HCZ_SHIFT_SWAP_v1',
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "hcz_shift_swaps_pkey" PRIMARY KEY ("id")
);

-- ── hcz_wellbeing_responses — staff pulse check-ins ──────────────────────────
CREATE TABLE IF NOT EXISTS "hcz_wellbeing_responses" (
  "id"                UUID        NOT NULL DEFAULT gen_random_uuid(),
  "staff_member_id"   UUID        NOT NULL,
  "response_date"     DATE        NOT NULL,
  "energy_score"      INTEGER     NOT NULL,  -- 1-10
  "stress_score"      INTEGER     NOT NULL,  -- 1-10
  "satisfaction_score" INTEGER    NOT NULL,  -- 1-10
  "notes"             TEXT,
  "is_anonymous"      BOOLEAN     NOT NULL DEFAULT false,
  "correlation_id"    TEXT        NOT NULL,
  "reason_code"       TEXT        NOT NULL,
  "rule_applied_id"   TEXT        NOT NULL DEFAULT 'HCZ_WELLBEING_v1',
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "hcz_wellbeing_responses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "hcz_wellbeing_staff_date_idx" ON "hcz_wellbeing_responses" ("staff_member_id", "response_date");

-- ── hcz_fatigue_scores — computed daily fatigue index ────────────────────────
CREATE TABLE IF NOT EXISTS "hcz_fatigue_scores" (
  "id"                UUID        NOT NULL DEFAULT gen_random_uuid(),
  "staff_member_id"   UUID        NOT NULL,
  "score_date"        DATE        NOT NULL,
  "score"             INTEGER     NOT NULL,  -- 0-100; higher = more fatigued
  "consecutive_days"  INTEGER     NOT NULL DEFAULT 0,
  "hours_past_7_days" INTEGER     NOT NULL DEFAULT 0,
  "recent_overtime_hours" INTEGER NOT NULL DEFAULT 0,
  "flags"             JSONB,
  "correlation_id"    TEXT        NOT NULL,
  "reason_code"       TEXT        NOT NULL,
  "rule_applied_id"   TEXT        NOT NULL DEFAULT 'HCZ_FATIGUE_v1',
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "hcz_fatigue_scores_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hcz_fatigue_scores_staff_date_uq" UNIQUE ("staff_member_id", "score_date")
);

-- ── hcz_incentive_ledger — cash incentive records (append-only) ──────────────
-- FIZ path: this table records cash incentive disbursements. APPEND-ONLY.
CREATE TABLE IF NOT EXISTS "hcz_incentive_ledger" (
  "id"                UUID        NOT NULL DEFAULT gen_random_uuid(),
  "staff_member_id"   UUID        NOT NULL,
  "incentive_type"    TEXT        NOT NULL,  -- SPIN_WIN, COVERAGE_BONUS, REFERRAL, OTHER
  "amount_cad_cents"  INTEGER     NOT NULL,  -- Always in cents (e.g. 5000 = $50.00)
  "reference_shift_id" UUID,
  "awarded_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "payroll_period"    TEXT,
  "correlation_id"    TEXT        NOT NULL,
  "reason_code"       TEXT        NOT NULL,
  "rule_applied_id"   TEXT        NOT NULL DEFAULT 'HCZ_INCENTIVE_v1',
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "hcz_incentive_ledger_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "hcz_incentive_staff_idx" ON "hcz_incentive_ledger" ("staff_member_id");

-- ── hcz_demand_history — historical volume data for ML learning ───────────────
CREATE TABLE IF NOT EXISTS "hcz_demand_history" (
  "id"                UUID        NOT NULL DEFAULT gen_random_uuid(),
  "week_start"        DATE        NOT NULL,
  "department"        TEXT        NOT NULL,
  "day_of_week"       INTEGER     NOT NULL,  -- 0=Mon, 6=Sun
  "hour_of_day"       INTEGER     NOT NULL,  -- 0-23
  "volume_index"      DECIMAL(6,3) NOT NULL, -- normalized 0.000-1.000
  "actual_staff_count" INTEGER    NOT NULL DEFAULT 0,
  "source"            TEXT        NOT NULL DEFAULT 'ACTUAL',  -- ACTUAL, FORECAST
  "correlation_id"    TEXT        NOT NULL,
  "reason_code"       TEXT        NOT NULL,
  "rule_applied_id"   TEXT        NOT NULL DEFAULT 'HCZ_DEMAND_v1',
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "hcz_demand_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hcz_demand_history_uq" UNIQUE ("week_start","department","day_of_week","hour_of_day")
);

-- ── hcz_budget_forecasts — rolling weekly budget projections ─────────────────
CREATE TABLE IF NOT EXISTS "hcz_budget_forecasts" (
  "id"                UUID        NOT NULL DEFAULT gen_random_uuid(),
  "week_start"        DATE        NOT NULL,
  "department"        TEXT        NOT NULL,
  "projected_labour_cad_cents" BIGINT NOT NULL DEFAULT 0,
  "actual_labour_cad_cents"    BIGINT,
  "projected_ft_hours"   INTEGER NOT NULL DEFAULT 0,
  "projected_pt_hours"   INTEGER NOT NULL DEFAULT 0,
  "projected_ot_hours"   INTEGER NOT NULL DEFAULT 0,
  "headcount_ft"         INTEGER NOT NULL DEFAULT 0,
  "headcount_pt"         INTEGER NOT NULL DEFAULT 0,
  "status"               TEXT    NOT NULL DEFAULT 'DRAFT',  -- DRAFT, APPROVED, ACTUAL
  "correlation_id"       TEXT    NOT NULL,
  "reason_code"          TEXT    NOT NULL,
  "rule_applied_id"      TEXT    NOT NULL DEFAULT 'HCZ_BUDGET_v1',
  "created_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "hcz_budget_forecasts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hcz_budget_forecasts_week_dept_uq" UNIQUE ("week_start","department")
);
