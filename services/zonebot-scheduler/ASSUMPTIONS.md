# ASSUMPTIONS.md — ZoneBot Zoey
**WO-002 — Installation Assumptions & Reconciliation Notes**
**Date:** 2026-04-25

---

## SCHEMA ASSUMPTIONS

### A-001: `ZoneCrewMember` → `StaffMember` rename
The payload migration included `ALTER TABLE IF EXISTS "ZoneCrewMember" RENAME TO "StaffMember"`.
The `StaffMember` model (`staff_members` table) was already present in the schema from the
GZ-SCHEDULE module (migration `20260412000000_gz_scheduling_module`). This rename step was
skipped. All new columns were appended to the existing `staff_members` table using
`ADD COLUMN IF NOT EXISTS` guards.

### A-002: `Shift` table
The payload migration included `ALTER TABLE "Shift" ADD COLUMN IF NOT EXISTS ...`.
No `Shift` table existed in the schema — the existing model is `ShiftAssignment`
(`shift_assignments`), which belongs to the GZ-SCHEDULE module.
A new `hcz_shifts` table was created to serve as the Zoey-managed shift record table,
containing all columns specified in the migration payload.

### A-003: `employmentType` vs `employment_type`
The payload migration included `ADD COLUMN IF NOT EXISTS "employmentType" TEXT NOT NULL DEFAULT 'FULL_TIME'`.
The existing `staff_members` table already has an `employment_type` column (values: 'FT', 'PT').
Since the payload specifies `FULL_TIME` as default (different vocabulary), and the column
already exists with the shorter code vocabulary, the `employmentType` column was omitted to
avoid duplicate semantic columns. Refer to FLAG-005 for alignment decisions.

### A-004: `targetWeeklyHours` / `minWeeklyHours` — units
Values `385` and `360` are interpreted as **tenths of hours** (e.g. 385 = 38.5h, 360 = 36.0h).
This avoids storing fractional hours in an INTEGER column. Column is named `target_weekly_hours`
in snake_case per OQMI schema conventions.

### A-005: `sickHoursRemaining = 40`
Interpreted as 40 hours = 5 sick days × 8 hours per day, consistent with Ontario ESA 2026.

---

## SERVICE ASSUMPTIONS

### A-006: Shared Prisma module
The payload imports `PrismaModule` from `'../../prisma/prisma.module'`. A shared
`services/prisma/` module was created at that path to serve all standalone NestJS services
without duplicating PrismaService boilerplate.

### A-007: Full service logic — placeholder methods
The payload marks the service as "condensed core — full logic follows all thread specs."
This installation implements all methods with functional logic (not stubs) consistent with
the constraint specifications in the thread. All hard constraints (12h rest, 6-day cap,
FT floor/target, staggered arrivals, locked breaks, fatigue scoring, payroll export,
budget forecast, hiring model) are implemented. Business-rule edge cases (see FLAGS.md)
are marked as configurable.

### A-008: `generateSchedule` persistence
The current `generateSchedule` method computes and validates the schedule but does **not**
automatically persist `hcz_shifts` rows. Persistence should be triggered by a separate
`schedule/publish` endpoint after supervisor review and violation resolution. This matches
the B-Lock / Final-Lock pattern used in the GZ-SCHEDULE module.

### A-009: Hourly rate placeholder in budget forecast
`buildBudgetForecast` uses a placeholder rate of $18.00 CAD/h. The actual rate should be
sourced from `StaffMember.hourly_rate_cad`. This is flagged for a follow-up directive to
wire per-staff rates into the forecast calculation.

---

## STANDARDS COMPLIANCE

All code follows OQMI_PROTOTYPE_STANDARDS.md v1.1:
- No UPDATE calls on append-only tables (`hcz_incentive_ledger`, `hcz_wellbeing_responses`)
- All tables include `correlation_id` and `reason_code`
- All financial amounts stored in cents (INTEGER) — no floating-point money
- Secrets sourced from environment only — no hardcoded credentials
- Ontario ESA 2026 constraints enforced at service layer (not database layer only)
