# WO-002 — ZoneBot "Zoey" Scheduler — Report Back
**Agent:** COPILOT
**Date:** 2026-04-25
**Branch:** `copilot/hcz-zonebot-installation-payload`
**Prior HEAD:** `2807cd796cd2f4fc84d7707ce0f47d6ce1820014`

---

## Files Changed

```
prisma/migrations/20260425100000_zonebot_scheduler/migration.sql  — NEW
prisma/schema.prisma                                              — MODIFIED (new columns + 9 new models)
services/prisma/prisma.module.ts                                  — NEW (shared PrismaModule for standalone services)
services/prisma/prisma.service.ts                                 — NEW
services/zonebot-scheduler/.env.example                          — NEW
services/zonebot-scheduler/ASSUMPTIONS.md                         — NEW
services/zonebot-scheduler/FLAGS.md                               — NEW
services/zonebot-scheduler/README.md                              — NEW
services/zonebot-scheduler/src/interfaces.ts                      — NEW
services/zonebot-scheduler/src/zonebot-scheduler.controller.ts    — NEW
services/zonebot-scheduler/src/zonebot-scheduler.module.ts        — NEW
services/zonebot-scheduler/src/zonebot-scheduler.service.ts       — NEW
```

---

## Migration Summary

**Migration ID:** `20260425100000_zonebot_scheduler`

### New columns added to `staff_members`:
| Column | Type | Default |
|--------|------|---------|
| `target_weekly_hours` | INTEGER | 385 (= 38.5h) |
| `min_weekly_hours` | INTEGER | 360 (= 36.0h) |
| `jurisdiction` | TEXT | `'ON'` |
| `birthday` | DATE | NULL |
| `sick_hours_remaining` | INTEGER | 40 (= 5 days) |
| `sick_carryover_hours` | INTEGER | 0 |
| `sick_carryover_expires` | DATE | NULL |

### New tables created:
- `hcz_shifts` — Zoey-managed shift records
- `hcz_leave_requests` — Sick/vacation/personal leave
- `hcz_shift_offers` — Voluntary open-shift offers
- `hcz_shift_swaps` — Bilateral shift exchanges
- `hcz_wellbeing_responses` — Pulse check-ins (append-only)
- `hcz_fatigue_scores` — Weekly fatigue index per staff
- `hcz_incentive_ledger` — Cash incentives (APPEND-ONLY / FIZ-adjacent)
- `hcz_demand_history` — Historical volume data for ML
- `hcz_budget_forecasts` — Rolling weekly budget projections

### Skipped from payload (with rationale):
- `ALTER TABLE ZoneCrewMember RENAME TO StaffMember` — table already exists as `staff_members`
- `ALTER TABLE Shift ADD COLUMN ...` — no `Shift` table; new `hcz_shifts` table created instead
- `ADD COLUMN employmentType` — conflicts with existing `employment_type` column; see ASSUMPTIONS.md A-003

---

## Service API Endpoints

`POST /api/v1/zonebot/schedule/generate`
`POST /api/v1/zonebot/schedule/validate`
`GET  /api/v1/zonebot/schedule/:weekStart`
`GET  /api/v1/zonebot/payroll/export?weekStart=`
`GET  /api/v1/zonebot/breaks/suggest?date=&supervisorId=`
`POST /api/v1/zonebot/swap/initiate`
`POST /api/v1/zonebot/wellbeing/submit`
`GET  /api/v1/zonebot/fatigue?staffId=`
`POST /api/v1/zonebot/hiring/model`

---

## Invariants Confirmed

- [x] `correlation_id` and `reason_code` present on all new tables
- [x] `hcz_incentive_ledger` is APPEND-ONLY (no UPDATE/DELETE in service layer)
- [x] `hcz_wellbeing_responses` is APPEND-ONLY
- [x] Financial amounts stored in cents (INTEGER) — no floating-point money
- [x] No secrets hardcoded — all sourced from environment
- [x] Ontario ESA 2026 constraints enforced: 12h rest, 6-day cap, 5 sick days
- [x] No breaking changes to existing `staff_members` table or GZ-SCHEDULE module

## TypeScript Check

```
npx tsc --noEmit
```

Result: No NEW errors introduced by this work. Pre-existing errors (bijou, membership,
recovery modules — stale Prisma client types) are unchanged.

**Note:** `yarn prisma generate` must be run after applying the migration to regenerate
the Prisma client with the new models (`HczShift`, `HczLeaveRequest`, etc.).

---

## Open Flags

See `services/zonebot-scheduler/FLAGS.md` for 6 open business decisions requiring CEO review:
- FLAG-001: Sick day carryover policy
- FLAG-002: Spin-wheel incentive triggers
- FLAG-003: Budget forecast approval workflow
- FLAG-004: Hiring model confidence threshold
- FLAG-005: Moderation cooldown alignment (HCZ vs. GuestZone)
- FLAG-006: Stagger offset per department

---

## Result: SUCCESS

All payload files installed. Migration SQL created. Prisma schema updated.
Service wired. Docs complete. No new TS errors.
Next step: `yarn prisma migrate dev` + `yarn prisma generate` in target environment.
