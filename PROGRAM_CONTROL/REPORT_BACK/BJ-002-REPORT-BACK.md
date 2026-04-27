# REPORT-BACK — BJ-002

**Directive:** THREAD11-COPILOT-INTAKE — Directive 5
**Rule:** BJ-002
**Agent:** CLAUDE_CODE
**Date:** 2026-04-17
**Branch:** bijou/bj-002

---

## Files Created

- `services/bijou/src/bijou-scheduler.service.ts` — BijouSchedulerService: `createSession`, `openSession`, `closeSession`, `cancelSession`. Enforces 15-minute slot alignment and MAX_SESSIONS_PER_HOUR velocity rule.
- `PROGRAM_CONTROL/REPORT_BACK/BJ-002-REPORT-BACK.md` (this file)

## Files Modified

- `prisma/schema.prisma` — Added `BijouSessionStatus` enum and `BijouSession` model with `@@index([status, scheduled_start])` and `@@index([creator_id, scheduled_start])`.
- `services/core-api/src/governance/governance.config.ts` — Added `BIJOU` block: `MAX_CAPACITY=24`, `SESSION_DURATION_MINUTES=60`, `SCHEDULE_SLOT_MINUTES=15`, `MAX_SESSIONS_PER_HOUR=2`.
- `services/nats/topics.registry.ts` — Registered `BIJOU_SESSION_SCHEDULED`, `BIJOU_SESSION_OPENED`, `BIJOU_SESSION_CLOSED`, `BIJOU_SESSION_CANCELLED`.
- `services/bijou/src/bijou.module.ts` — Registered `BijouSchedulerService` in providers and exports.

## Files Confirmed Unchanged

- `services/bijou/src/bijou-session.service.ts` — existing BIJOU-002 runtime session service untouched.
- `services/bijou/src/pass-pricing.service.ts` — untouched.
- `services/bijou/src/min-seat-gate.service.ts` — untouched.
- `services/core-api/src/config/governance.config.ts` — existing `BIJOU_PRICING` block untouched (new BJ-002 constants go in the other governance config file per directive).

## GovernanceConfig Constants Used

Read from `services/core-api/src/governance/governance.config.ts`:

- `GovernanceConfig.BIJOU.MAX_CAPACITY` = 24 ✅ (added in this directive)
- `GovernanceConfig.BIJOU.SESSION_DURATION_MINUTES` = 60 ✅ (added)
- `GovernanceConfig.BIJOU.SCHEDULE_SLOT_MINUTES` = 15 ✅ (added)
- `GovernanceConfig.BIJOU.MAX_SESSIONS_PER_HOUR` = 2 ✅ (added)

No hardcoded bijou constants in `bijou-scheduler.service.ts`.

## NATS Topic Constants Used

- `NATS_TOPICS.BIJOU_SESSION_SCHEDULED` ✅ registered
- `NATS_TOPICS.BIJOU_SESSION_OPENED` ✅ registered
- `NATS_TOPICS.BIJOU_SESSION_CLOSED` ✅ registered
- `NATS_TOPICS.BIJOU_SESSION_CANCELLED` ✅ registered

No raw topic strings used.

## Velocity Rule Logic

`assertVelocityCompliance(creatorId, scheduledStart)`:

1. Reads `GovernanceConfig.BIJOU.MAX_SESSIONS_PER_HOUR` (= 2).
2. Constructs a rolling 60-minute window
   `[scheduledStart - 60m + 1ms, scheduledStart + 60m - 1ms]`.
   This catches any overlap where another session falls within 60 minutes
   on either side of the new start time.
3. Counts `BijouSession` records for the creator in that window with
   `status != CANCELLED`.
4. If count ≥ `MAX_SESSIONS_PER_HOUR`, throws
   `UnprocessableEntityException` with `statusCode: 429` and
   `error: 'BIJOU_VELOCITY_LIMIT_EXCEEDED'` — the 429-equivalent domain
   error the directive requires.
5. CANCELLED sessions do not count against velocity.

## Slot Alignment

`assertSlotAligned(scheduledStart)`:

- Reads `GovernanceConfig.BIJOU.SCHEDULE_SLOT_MINUTES` (= 15).
- Requires `minute % 15 === 0` and `seconds === 0` and `ms === 0`.
- Throws `BadRequestException` with `rule_applied_id` when not aligned.

## Prisma Schema

- `BijouSessionStatus` enum: `SCHEDULED | OPEN | CLOSED | CANCELLED` ✅
- `BijouSession` model fields: `id`, `creator_id`, `scheduled_start`,
  `scheduled_end`, `capacity (default 24)`, `status (default SCHEDULED)`,
  `organization_id`, `tenant_id`, `created_at`, `updated_at`.
- Indexes: `@@index([status, scheduled_start])` (directive-required),
  `@@index([creator_id, scheduled_start])` (velocity query acceleration).
- `@@map("bijou_sessions")`.

Schema-only — no migration generated per directive.

## Invariants Confirmed

1. **No hardcoded Bijou constants** — all BIJOU values sourced from
   `GovernanceConfig.BIJOU` ✅
2. **rule_applied_id on every state change** — `BJ-002_*_v1` ids logged
   and published for create/open/close/cancel ✅
3. **organization_id + tenant_id on Prisma writes** — required on
   `createSession` input, persisted on the model, echoed to NATS payload ✅
4. **Logger on all methods** — `Logger(BijouSchedulerService.name)`
   invoked on every code path ✅
5. **NATS_TOPICS.* constants only** — no raw strings ✅
6. **Multi-tenant mandate** — enforced via constructor input ✅

## Multi-tenant Mandate

- `organization_id` and `tenant_id` are required on `createSession` and
  stored on the `BijouSession` row; propagated to NATS payloads on every
  lifecycle event ✅

## npx tsc --noEmit Result

Baseline: 1 pre-existing error in `tsconfig.json` (`baseUrl` deprecation
notice — TS5101). No new errors introduced.

```
tsconfig.json(12,5): error TS5101: Option 'baseUrl' is deprecated ...
```

Zero NEW TypeScript errors. ✅

## git diff --stat

```
prisma/schema.prisma                                 | 28 ++++++
services/bijou/src/bijou-scheduler.service.ts        | 243 ++++++++++ (created)
services/bijou/src/bijou.module.ts                   | 18 ++-
services/core-api/src/governance/governance.config.ts|  9 ++
services/nats/topics.registry.ts                     |  6 +
PROGRAM_CONTROL/REPORT_BACK/BJ-002-REPORT-BACK.md    | (created)
```

## Result

**SUCCESS**

All BJ-002 scope items delivered:
- ✅ `BijouSession` Prisma model (schema only)
- ✅ `BijouSchedulerService` with create/open/close/cancel + velocity rule
- ✅ `BIJOU` block in GovernanceConfig
- ✅ 4 session lifecycle NATS topics registered
- ✅ 15-minute slot alignment enforced
- ✅ Zero new tsc errors
