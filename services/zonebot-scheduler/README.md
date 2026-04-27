# ZoneBot Scheduler — "Zoey"
**WO-002 + All CEO Clarifications — Final Consolidated Version**
**Date:** 2026-04-25
**Commit Prefix:** `HCZ:`
**Rule ID:** `HCZ_ZOEY_v1`

---

## Overview

Zoey is the HCZ full-service staffing scheduler. She generates, validates, and
manages schedules for all staff under the HCZ scheduling umbrella, enforcing
Ontario ESA 2026 compliance, wellbeing protections, and budget governance.

This service runs as a standalone NestJS module, sharing the monorepo's Prisma
schema and Postgres instance.

---

## Features

| Feature | Rule |
|---------|------|
| 12h minimum rest between shifts | Ontario ESA 2026 |
| 6 consecutive-day cap | Ontario ESA 2026 |
| 36h FT floor / 38.5h FT target | WO-002 CEO spec |
| Heavy PT model (20h/week typical) | WO-002 CEO spec |
| Locked breaks (supervisor-controlled) | WO-002 CEO spec |
| Moderation 4h/24h cooldown window | WO-002 CEO spec |
| Staggered arrivals (15-min offsets) | WO-002 CEO spec |
| Fatigue scoring (0–100, persist weekly) | WO-002 CEO spec |
| Volume learning / demand history | WO-002 CEO spec |
| Budget forecast (CAD cents, weekly) | WO-002 CEO spec |
| Shift swap (bilateral, supervisor-approved) | WO-002 CEO spec |
| Wellbeing pulse check-ins | WO-002 CEO spec |
| Spin-wheel cash incentive ($50 CAD) — ledger infrastructure ready; trigger logic pending CEO decision (see FLAGS.md FLAG-002) | WO-002 CEO spec |
| Payroll export (REG/OT/STAT breakdown) | WO-002 CEO spec |
| Hiring model (FT/PT gap projection) | WO-002 CEO spec |
| 5 paid sick days / year (Ontario ESA) | WO-002 CEO spec |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/zonebot/schedule/generate` | Generate schedule for a week |
| `POST` | `/api/v1/zonebot/schedule/validate` | Validate an existing schedule |
| `GET`  | `/api/v1/zonebot/schedule/:weekStart` | Retrieve schedule by week |
| `GET`  | `/api/v1/zonebot/payroll/export?weekStart=` | Export payroll for a week |
| `GET`  | `/api/v1/zonebot/breaks/suggest?date=&supervisorId=` | Suggest break windows |
| `POST` | `/api/v1/zonebot/swap/initiate` | Initiate shift swap |
| `POST` | `/api/v1/zonebot/wellbeing/submit` | Submit wellbeing check-in |
| `GET`  | `/api/v1/zonebot/fatigue?staffId=` | Get fatigue report |
| `POST` | `/api/v1/zonebot/hiring/model` | Run hiring gap model |

---

## Database Tables

All tables created by migration `20260425100000_zonebot_scheduler`:

| Table | Purpose |
|-------|---------|
| `hcz_shifts` | Zoey-managed shift records |
| `hcz_leave_requests` | Sick/vacation/personal leave |
| `hcz_shift_offers` | Voluntary open-shift offers |
| `hcz_shift_swaps` | Bilateral shift exchanges |
| `hcz_wellbeing_responses` | Pulse check-ins (append-only) |
| `hcz_fatigue_scores` | Weekly fatigue index per staff |
| `hcz_incentive_ledger` | Cash incentives — **APPEND-ONLY** |
| `hcz_demand_history` | Historical volume data for ML |
| `hcz_budget_forecasts` | Rolling weekly budget projections |

New columns added to `staff_members`:

| Column | Type | Description |
|--------|------|-------------|
| `target_weekly_hours` | INT (tenths) | 385 = 38.5h FT target |
| `min_weekly_hours` | INT (tenths) | 360 = 36.0h FT floor |
| `jurisdiction` | TEXT | Province code (default: `ON`) |
| `birthday` | DATE | For age-aware scheduling |
| `sick_hours_remaining` | INT | Hours (40 = 5 days) |
| `sick_carryover_hours` | INT | Carried from prior year |
| `sick_carryover_expires` | DATE | Carryover expiry |

---

## Setup

```bash
# Install dependencies (yarn canonical per OQMI policy)
yarn install

# Apply migration and regenerate client
yarn prisma migrate dev
yarn prisma generate

# Start the service
yarn start:dev
```

See `.env.example` for required environment variables.

---

## Compliance

All scheduling logic enforces **Ontario Employment Standards Act (ESA) 2026**:

- Minimum 12h rest between shifts
- Maximum 6 consecutive work days
- 96h advance notice for published schedules
- 24h notice for changes
- 5 paid sick days annually
- 1.5× stat holiday premium pay

See `ASSUMPTIONS.md` for open policy questions and `FLAGS.md` for CEO decisions needed.
