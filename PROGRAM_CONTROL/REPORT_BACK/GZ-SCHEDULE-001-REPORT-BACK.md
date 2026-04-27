# GZ-SCHEDULE-001-REPORT-BACK.md

## Task / WorkOrder ID
GZ-SCHEDULE-001 — GuestZone Scheduling Module

## Repo
OmniQuestMediaInc/ChatNowZone--BUILD

## Branch
claude/create-scheduling-module-WKDP7 (merged via PR #203)

## HEAD
`9faa90e` (squash merge commit on `main`)

## Source Document
GuestZone Operations-Launch Handbook (Version 1.0, March 2026) — Department: GuestZone Services & Operations

---

## Files Created (16)

| File | Action |
|------|--------|
| `services/core-api/src/scheduling/scheduling.module.ts` | CREATED |
| `services/core-api/src/scheduling/scheduling.service.ts` | CREATED |
| `services/core-api/src/scheduling/zonebot.service.ts` | CREATED |
| `services/core-api/src/scheduling/shift-coverage.service.ts` | CREATED |
| `services/core-api/src/scheduling/compliance-guard.service.ts` | CREATED |
| `services/core-api/src/scheduling/scheduling-seed.service.ts` | CREATED |
| `services/core-api/src/scheduling/scheduling-queue.processor.ts` | CREATED |
| `services/core-api/src/scheduling/scheduling.controller.ts` | CREATED |
| `services/core-api/src/scheduling/scheduling.interfaces.ts` | CREATED |
| `services/core-api/src/scheduling/scheduling.constants.ts` | CREATED |
| `services/core-api/src/scheduling/stat-holidays.seed.ts` | CREATED |
| `prisma/migrations/20260412000000_gz_scheduling_module/migration.sql` | CREATED |
| `scripts/seed-scheduling.ts` | CREATED |
| `tests/integration/scheduling-service.spec.ts` | CREATED |
| `tests/integration/zonebot-service.spec.ts` | CREATED |
| `tests/integration/compliance-guard.spec.ts` | CREATED |
| `tests/integration/stat-holidays.spec.ts` | CREATED |

## Files Modified (5)

| File | Change Summary |
|------|----------------|
| `prisma/schema.prisma` | Added 9 scheduling models (StaffMember, SchedulePeriod, ShiftTemplate, ShiftAssignment, ShiftGap, ShiftBid, ScheduleAuditLog, DepartmentCoverage, StatHoliday) |
| `services/nats/topics.registry.ts` | Added 15 scheduling NATS topics under `gz.schedule.*` namespace |
| `services/core-api/src/config/governance.config.ts` | Added `GZ_SCHEDULING` constants block (shifts, ESA limits, ZoneBot config, transit windows) |
| `services/core-api/src/app.module.ts` | Imported `SchedulingModule` + registered `BullModule.forRoot()` with Redis connection |
| `package.json` | Added `@nestjs/bull`, `bull`, `@types/bull` dependencies + `seed:scheduling` script |

### git diff --stat (squash merge, PR #203)
```
26 files changed, 4535 insertions(+), 7 deletions(-)
```

---

## NATS Topics Added (exact strings)

| Key | Subject |
|-----|---------|
| `SCHEDULE_PERIOD_CREATED` | `gz.schedule.period.created` |
| `SCHEDULE_PERIOD_B_LOCKED` | `gz.schedule.period.b_locked` |
| `SCHEDULE_PERIOD_FINAL_LOCKED` | `gz.schedule.period.final_locked` |
| `SCHEDULE_SHIFT_ASSIGNED` | `gz.schedule.shift.assigned` |
| `SCHEDULE_SHIFT_SWAPPED` | `gz.schedule.shift.swapped` |
| `SCHEDULE_GAP_POSTED` | `gz.schedule.gap.posted` |
| `SCHEDULE_GAP_FILLED` | `gz.schedule.gap.filled` |
| `SCHEDULE_ZONEBOT_LOTTERY_RUN` | `gz.schedule.zonebot.lottery_run` |
| `SCHEDULE_ZONEBOT_BID_OFFERED` | `gz.schedule.zonebot.bid_offered` |
| `SCHEDULE_ZONEBOT_BID_AWARDED` | `gz.schedule.zonebot.bid_awarded` |
| `SCHEDULE_ZONEBOT_BID_EXPIRED` | `gz.schedule.zonebot.bid_expired` |
| `SCHEDULE_COMPLIANCE_VIOLATION` | `gz.schedule.compliance.violation` |
| `SCHEDULE_COVERAGE_GAP_DETECTED` | `gz.schedule.coverage.gap_detected` |
| `SCHEDULE_STAT_HOLIDAY_ALERT` | `gz.schedule.stat_holiday.alert` |
| `SCHEDULE_REMINDER_BLOCK_CUTOFF` | `gz.schedule.reminder.block_cutoff` |

---

## GovernanceConfig Constants Added

All added to `services/core-api/src/config/governance.config.ts` as the `GZ_SCHEDULING` const block:

**Rolling Cycle:**
- `PERIOD_LENGTH_DAYS = 14`
- `BLOCK_CUTOFF_DAYS_BEFORE = 21`
- `FINAL_LOCK_DAYS_BEFORE = 14`
- `BLOCK_REMINDER_DAYS = [24, 22]`

**ZoneBot 1-2-3 Rule:**
- `ZONEBOT_MAX_LOTTERY_POSITIONS = 3`
- `ZONEBOT_CONFIRMATION_HOURS = 16`
- `ZONEBOT_SUPPRESSION_CYCLES = 2`

**Ontario ESA 2026:**
- `SHIFT_NOTICE_HOURS = 96`
- `SHIFT_CHANGE_NOTICE_HOURS = 24`
- `MAX_CONSECUTIVE_DAYS = 6`
- `MIN_CONSECUTIVE_DAYS_OFF_FT = 2`
- `MIN_CONSECUTIVE_DAYS_OFF_PT = 3`
- `MAX_WEEKLY_HOURS_STANDARD = 44`
- `MAX_WEEKLY_HOURS_EXCESS = 48`
- `MIN_VACATION_DAYS_ANNUAL = 10`

**Stat Holiday Pay:**
- `STAT_HOLIDAY_PAY_MULTIPLIER = 1.50`
- `STAT_HOLIDAY_INCLUDES_PUBLIC_PAY = true`

**Transit Safety:**
- `TRANSIT_UNSAFE_START_HOUR = 0`
- `TRANSIT_UNSAFE_END_HOUR = 6.25`

**Waterfall Shifts (GuestZone):**
- `SHIFTS.A` — Morning, 07:00-15:45, meal break 11:30 (30min)
- `SHIFTS.B` — Swing, 15:15-00:00, meal break 19:30 (30min)
- `SHIFTS.C` — Night, 23:30-08:15, meal break 03:00 (30min)

**Coverage Baselines:**
- `GZ_MIN_AGENTS_PER_SHIFT = 3`
- `GZ_DIALPAD_LICENSES = 4`
- `GZ_CROSSOVER_MINS = 15`

**Departments** — 6-department coverage config (GUESTZONE, FINANCE, TECH, LEGAL, MAINTENANCE, RECEPTION)

---

## Prisma Models Added (9)

All added to `prisma/schema.prisma` with corresponding SQL migration:

| Model | Purpose | Audit Properties |
|-------|---------|------------------|
| `StaffMember` | Staff roster with roles, employment types, languages, pay rates | `correlation_id`, `reason_code` |
| `SchedulePeriod` | Rolling 2-week schedule blocks with B-Lock/Final Lock lifecycle | `correlation_id`, `reason_code`, `rule_applied_id` |
| `ShiftTemplate` | A/B/C shift definitions (time, duration, meal breaks) | `correlation_id`, `reason_code`, `rule_applied_id` |
| `ShiftAssignment` | Individual staff-shift pairings with stat holiday pay + compliance flags | `correlation_id`, `reason_code`, `rule_applied_id` |
| `ShiftGap` | Posted gaps available for ZoneBot lottery | `correlation_id`, `reason_code`, `rule_applied_id` |
| `ShiftBid` | Staff bids on gaps with lottery positions and 16h confirmation windows | `correlation_id`, `reason_code`, `rule_applied_id` |
| `ScheduleAuditLog` | **Append-only** audit trail with DB triggers blocking UPDATE/DELETE | `correlation_id`, `reason_code`, `rule_applied_id` |
| `DepartmentCoverage` | Day-of-week coverage requirements per department | `correlation_id`, `reason_code`, `rule_applied_id` |
| `StatHoliday` | Ontario statutory holidays with pay multipliers + on-call requirements | `correlation_id`, `reason_code`, `rule_applied_id` |

---

## REST API Surface (19 endpoints, 6 controllers)

### Schedule Periods (`/scheduling/periods`)
- `POST /scheduling/periods` — Create rolling 2-week period
- `GET /scheduling/periods/:id` — Retrieve with assignments
- `POST /scheduling/periods/:id/b-lock` — DRAFT → B_LOCKED
- `POST /scheduling/periods/:id/final-lock` — B_LOCKED → FINAL_LOCKED
- `POST /scheduling/periods/check-deadlines` — Manual deadline check

### Shifts (`/scheduling/shifts`)
- `POST /scheduling/shifts` — Assign shift (with compliance pre-check)
- `POST /scheduling/shifts/swap` — Swap two assignments (bilateral compliance)

### ZoneBot (`/scheduling/zonebot`)
- `POST /scheduling/zonebot/bids` — Submit bid for gap
- `POST /scheduling/zonebot/lottery/:gapId` — Run 1-2-3 lottery
- `POST /scheduling/zonebot/bids/:bidId/accept` — Accept offer
- `POST /scheduling/zonebot/bids/:bidId/decline` — Decline (cascades to next position)
- `POST /scheduling/zonebot/process-expired` — Process expired offers

### Coverage (`/scheduling/coverage`)
- `GET /scheduling/coverage/evaluate` — Check single shift coverage
- `GET /scheduling/coverage/scan/:periodId` — Full period scan
- `POST /scheduling/coverage/gaps` — Post gap for lottery
- `GET /scheduling/coverage/stat-holiday` — Check holiday + on-call manager

### Compliance (`/scheduling/compliance`)
- `POST /scheduling/compliance/validate` — Validate proposed assignment
- `GET /scheduling/compliance/weekly-summary` — Staff weekly summary

### Seed (`/scheduling/seed`)
- `POST /scheduling/seed/all` — Full seed (idempotent)
- `POST /scheduling/seed/holidays` — Rolling 3-year holidays
- `POST /scheduling/seed/holidays/years` — Specific years
- `POST /scheduling/seed/shift-templates` — A/B/C templates
- `POST /scheduling/seed/department-coverage` — Coverage baselines
- `POST /scheduling/seed/master-roster` — GZ master roster (15 positions)

---

## Bull Queue Automation

Registered in `SchedulingQueueProcessor.onModuleInit()`:

| Cron | TZ | Job | Purpose |
|------|-----|-----|---------|
| `0 7 * * *` | America/Toronto | `check-deadlines` | Auto B-Lock/Final Lock transitions |
| `0 19 * * *` | America/Toronto | `check-deadlines` | Auto B-Lock/Final Lock transitions |
| `0 7 * * *` | America/Toronto | `process-expired-bids` | Expire 16h-unclaimed ZoneBot offers |
| `0 19 * * *` | America/Toronto | `process-expired-bids` | Expire 16h-unclaimed ZoneBot offers |

---

## Invariant Checklist

| # | Check | Result |
|---|-------|--------|
| 1 | No UPDATE/DELETE on ScheduleAuditLog (append-only) | ✅ PASS — DB trigger `prevent_audit_modification` blocks UPDATE and DELETE |
| 2 | No hardcoded constants — all from `governance.config.ts` | ✅ PASS — all services import `GZ_SCHEDULING` |
| 3 | `crypto.randomInt()` only (Invariant #4) | ✅ PASS — Fisher-Yates lottery shuffle in `zonebot.service.ts:152` uses `randomInt()` |
| 4 | No `Math.random()` anywhere | ✅ PASS — grep confirms zero occurrences |
| 5 | No `@angular/core` imports | ✅ PASS — only `@nestjs/common`, `@nestjs/bull`, Node builtins |
| 6 | Every service has Logger instance | ✅ PASS — all 5 services declare `private readonly logger = new Logger(...)` |
| 7 | NATS topics from `topics.registry.ts` only | ✅ PASS — all 15 topics via `NATS_TOPICS.*` constants, no string literals |
| 8 | `rule_applied_id` on every service output | ✅ PASS — all public method return paths include `rule_applied_id` |
| 9 | `correlation_id` + `reason_code` on every table | ✅ PASS — all 9 Prisma models include both fields |
| 10 | `npx tsc --noEmit` zero errors | ✅ PASS — clean build |
| 11 | Integration tests passing | ✅ PASS — 37/37 tests pass across 4 suites |
| 12 | SchedulingModule registered in AppModule | ✅ PASS — imported after ShowZoneModule |
| 13 | Redis/Postgres not on public interfaces | ✅ PASS — existing docker-compose config preserved |
| 14 | All timestamps America/Toronto | ✅ PASS — Bull cron jobs use `tz: 'America/Toronto'`, governance TIMEZONE constant |

---

## `npx tsc --noEmit` Result

```
$ npx tsc --noEmit
(no output)
Exit code: 0
```

**Result: ZERO errors. PASS.**

---

## Integration Test Result

```
$ npx jest --testPathPatterns='tests/integration/(scheduling-service|zonebot-service|compliance-guard|stat-holidays)'

Test Suites: 4 passed, 4 total
Tests:       37 passed, 37 total
Time:        7.674 s
```

**Result: 37/37 PASS.**

---

## Handbook Coverage Verification

The module implements every scenario outlined in the Operations-Launch Handbook:

| Handbook Section | Implementation |
|------------------|----------------|
| §3.1 Waterfall Shift Model | `GZ_SCHEDULING.SHIFTS` (A/B/C) + `ShiftTemplate` seeds |
| §3.2 Statutory Holidays & Coverage | `StatHoliday` model + rolling 3-year seed + on-call manager validation |
| §3.2 Vacation (2 weeks FT min) | `MIN_VACATION_DAYS_ANNUAL = 10` constant |
| §7 Emergency Protocols & WFM | On-call tracking via `ShiftAssignment.on_call` flag |
| Page 4 — Scheduling & 24/7/365 Coverage | `SchedulePeriod` rolling 2-week cycles + coverage validation |
| Page 7 — Waterfall Blocks (Transit-Safe) | `TRANSIT_UNSAFE_START_HOUR/END_HOUR` guard |
| Page 7 — 3-person baseline | `GZ_MIN_AGENTS_PER_SHIFT = 3` |
| Page 7 — 4 Dialpad Licenses / 1 Safety Seat | `GZ_DIALPAD_LICENSES = 4` |
| Page 7 — Consecutive Day Limit | `MAX_CONSECUTIVE_DAYS = 6` + `ComplianceGuard.checkConsecutiveDays()` |
| Page 7 — 2 days off (FT), 3 days off (PT) | `MIN_CONSECUTIVE_DAYS_OFF_FT/PT` constants |
| Page 8 — ZoneBot B-Lock (21 days) | `BLOCK_CUTOFF_DAYS_BEFORE = 21` |
| Page 8 — Final Lock (14 days) | `FINAL_LOCK_DAYS_BEFORE = 14` |
| Page 8 — 1-2-3 Rule, 16-hour clock | `ZoneBotService.runLottery()` + `offerToPosition()` |
| Page 8 — 2-cycle suppression | `ZONEBOT_SUPPRESSION_CYCLES = 2` (28 days) |
| Page 8 — Finance (9 AM – 9 PM) | `DEPARTMENTS.FINANCE` + `DepartmentCoverage` seeds |
| Page 8 — Tech (24/7/365) | `DEPARTMENTS.TECH` + coverage seeds |
| Page 8 — Legal (M-F + on-call) | `DEPARTMENTS.LEGAL` + on-call flag |
| Page 8 — Maintenance (7-22h) | `DEPARTMENTS.MAINTENANCE` + 2-shift coverage |
| Page 8 — Reception (8-17h daily) | `DEPARTMENTS.RECEPTION` + 7-day coverage |
| Addendum §1 — 96h schedule / 24h change notice | `SHIFT_NOTICE_HOURS = 96`, `SHIFT_CHANGE_NOTICE_HOURS = 24` |
| Addendum §1 — Excess Hours (48h cap) | `MAX_WEEKLY_HOURS_EXCESS = 48` |
| Addendum §5 — Audit Trail | `ScheduleAuditLog` append-only with DB trigger |

---

## Deviations from Source Document

| Item | Deviation | Explanation |
|------|-----------|-------------|
| Master Roster staff counts | Handbook documents 15 canonical positions across A/B/C shifts; code seeds all 15 via `seedMasterRoster()` | Exact match to handbook §1 |
| Hourly/salary rates | Handbook gives ranges ($19.50-$26.00/hr GZSA, $52K-$75K GZS salary, $70K-$95K GZM salary); seed uses midpoints ($22/hr, $63.5K GZS, $75K GZAM, $82.5K GZM) | Defensible midpoints pending HR confirmation |
| NATS topic naming | Used `gz.schedule.*` prefix for all scheduling topics | Consistent with existing convention (`dfsp.*`, `payments.*`, etc.) |
| Bull queue over node-cron/NATS | Selected Bull (user directive during session) | Redis-backed, already in stack |

---

## Outstanding Runtime Verification (Pre-Deployment)

Cannot be validated from static code analysis; requires live environment:

1. Run `prisma migrate deploy` to apply `20260412000000_gz_scheduling_module` migration
2. Set `REDIS_HOST` and `REDIS_PORT` env vars (Bull queue requires Redis)
3. Run `yarn seed:scheduling` against test database to verify idempotent seeding
4. Verify Bull queue registers repeatable jobs on app startup (expect log: "repeatable jobs registered (7 AM + 7 PM ET)")
5. Smoke-test `POST /scheduling/seed/all` returns 200 OK

---

## Result

**SUCCESS**

- PR: OmniQuestMediaInc/ChatNowZone--BUILD#203
- Merge commit: `9faa90e`
- Branch: `claude/create-scheduling-module-WKDP7`
- Merged to: `main`
- Total commits (squashed): 3
- Session: https://claude.ai/code/session_01YXj61KWWtMp5zK2CXFYTqS
