# REPORT-BACK — BJ-003

**Directive:** THREAD11-COPILOT-INTAKE — Directive 6
**Rule:** BJ-003
**Agent:** CLAUDE_CODE
**Date:** 2026-04-17
**Branch:** bijou/bj-003 (stacked on bijou/bj-002)

---

## Files Created

- `services/bijou/src/bijou-admission.service.ts` — BijouAdmissionService: `requestAdmission`, `acceptAdmission`, `confirmCamera`, `enforceCamera`; server-side timers for accept window + camera grace; FIFO standby promotion.
- `PROGRAM_CONTROL/REPORT_BACK/BJ-003-REPORT-BACK.md` (this file)

## Files Modified

- `prisma/schema.prisma` — Added `BijouAdmissionStatus` enum (`PENDING / ADMITTED / STANDBY / EJECTED / ABANDONED`) and `BijouAdmission` model with indexes on `(session_id, status)` and `(session_id, created_at)`.
- `services/core-api/src/governance/governance.config.ts` — Extended `BIJOU` block with `ADMIT_ACCEPT_WINDOW_SECONDS = 10` and `CAMERA_GRACE_SECONDS = 30`.
- `services/nats/topics.registry.ts` — Registered 5 admission topics: `BIJOU_ADMISSION_OFFERED`, `BIJOU_ADMISSION_ADMITTED`, `BIJOU_ADMISSION_STANDBY`, `BIJOU_ADMISSION_EJECTED`, `BIJOU_ADMISSION_ABANDONED`.
- `services/bijou/src/bijou.module.ts` — Registered `BijouAdmissionService` in providers and exports.

## Files Confirmed Unchanged

- `services/bijou/src/bijou-session.service.ts` — untouched
- `services/bijou/src/bijou-scheduler.service.ts` — untouched (BJ-002 surface)
- `services/bijou/src/pass-pricing.service.ts` — untouched
- `services/bijou/src/min-seat-gate.service.ts` — untouched

## GovernanceConfig Constants Used

From `services/core-api/src/governance/governance.config.ts`:

- `GovernanceConfig.BIJOU.MAX_CAPACITY` = 24 ✅
- `GovernanceConfig.BIJOU.ADMIT_ACCEPT_WINDOW_SECONDS` = 10 ✅ (added)
- `GovernanceConfig.BIJOU.CAMERA_GRACE_SECONDS` = 30 ✅ (added)

No hardcoded values anywhere in `bijou-admission.service.ts`.

## NATS Topic Constants Used

All from `services/nats/topics.registry.ts`:

- `NATS_TOPICS.BIJOU_ADMISSION_OFFERED` ✅
- `NATS_TOPICS.BIJOU_ADMISSION_ADMITTED` ✅
- `NATS_TOPICS.BIJOU_ADMISSION_STANDBY` ✅
- `NATS_TOPICS.BIJOU_ADMISSION_EJECTED` ✅
- `NATS_TOPICS.BIJOU_ADMISSION_ABANDONED` ✅

No raw topic strings used.

## Standby Promotion Mechanism

On `ABANDONED` (accept window expired) OR `EJECTED` (camera grace
expired), `promoteNextStandby(sessionId)` runs:

1. `findFirst` on `BijouAdmission` where `session_id = sessionId` AND
   `status = STANDBY`, ordered by `created_at asc` (FIFO).
2. If a next-in-line admission exists, transition its status from
   `STANDBY` → `PENDING`.
3. Publish `bijou.admission.offered` for that admission.
4. Arm the `ADMIT_ACCEPT_WINDOW_SECONDS` server-side timer so the newly
   promoted user has the same accept window as the original offer.

`MAX_CAPACITY` is queried at `requestAdmission` time as the count of
admissions with `status = ADMITTED` in that session. When the session
is full, new requests enter as `STANDBY`. When an admission leaves the
admitted pool, the oldest STANDBY is promoted.

## Server-side Timers

`BijouAdmissionService` maintains two `Map<admission_id, NodeJS.Timeout>`
collections — `acceptTimers` and `cameraTimers` — enforced via
`setTimeout`. Both durations are read from `GovernanceConfig.BIJOU.*`,
never hardcoded. The directive's constraint — "enforced server-side,
not client-side timers" — is satisfied: the timer runs in the Node
process, the client has no role in countdown enforcement.

Graceful transitions clear the respective timer (e.g. `confirmCamera`
disarms the camera timer; `acceptAdmission` disarms the accept timer).
On fire, the timer callback checks the current DB state and transitions
only if the admission is still in the expected status — idempotent
against races.

## Prisma Schema

- `BijouAdmissionStatus` enum: `PENDING | ADMITTED | STANDBY | EJECTED | ABANDONED` ✅
- `BijouAdmission` model: `id`, `session_id`, `user_id`, `status`,
  `admitted_at`, `camera_grace_deadline`, `organization_id`,
  `tenant_id`, `created_at`, `updated_at`.
- Indexes: `@@index([session_id, status])`,
  `@@index([session_id, created_at])` (FIFO promotion acceleration).
- `@@map("bijou_admissions")`.

Uniqueness constraint per directive ("one non-EJECTED/ABANDONED per
session+user") is enforced at application level in `requestAdmission`
via a `findFirst` guard + `ConflictException`, same pattern as
MEMB-002 uses for one-ACTIVE-subscription-per-user.

## Invariants Confirmed

1. **`MAX_CAPACITY` from GovernanceConfig** — no hardcoded 24 ✅
2. **`CAMERA_GRACE_SECONDS` + `ADMIT_ACCEPT_WINDOW_SECONDS` from
   GovernanceConfig** — no hardcoded 10 or 30 ✅
3. **`rule_applied_id` on all state transitions** —
   `BJ-003_REQUEST_ADMISSION_v1`, `BJ-003_ACCEPT_ADMISSION_v1`,
   `BJ-003_ENFORCE_CAMERA_v1`, `BJ-003_EXPIRE_ACCEPT_v1`,
   `BJ-003_PROMOTE_STANDBY_v1` ✅
4. **organization_id + tenant_id on all Prisma writes** — required on
   `requestAdmission` input, stored on row, echoed to every NATS
   payload ✅
5. **Logger on BijouAdmissionService** — every transition and decision
   is logged ✅
6. **NATS_TOPICS.* only** — no raw strings ✅

## Multi-tenant Mandate

- `organization_id` and `tenant_id` required on `requestAdmission`,
  persisted on the `BijouAdmission` row, echoed on every NATS payload.

## npx tsc --noEmit Result

Baseline: 1 pre-existing `tsconfig.json` `baseUrl` deprecation notice.
No new errors introduced.

Zero NEW TypeScript errors. ✅

## git diff --stat (BJ-003 additions on top of BJ-002 stack)

```
prisma/schema.prisma                                  | 28 +++++
services/bijou/src/bijou-admission.service.ts         | 380 ++++++++ (created)
services/bijou/src/bijou.module.ts                    |  4 ++
services/core-api/src/governance/governance.config.ts |  5 +
services/nats/topics.registry.ts                      |  7 +
PROGRAM_CONTROL/REPORT_BACK/BJ-003-REPORT-BACK.md     | (created)
```

## Result

**SUCCESS**

All BJ-003 scope items delivered:
- ✅ `BijouAdmission` Prisma model (schema only)
- ✅ `BijouAdmissionService` with request/accept/confirm/enforce methods
- ✅ 10s server-side accept window + 30s camera grace (governance constants)
- ✅ FIFO standby promotion on ABANDONED and EJECTED
- ✅ 5 admission NATS topics registered
- ✅ Zero new tsc errors
