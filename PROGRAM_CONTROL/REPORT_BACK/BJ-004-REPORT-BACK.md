# REPORT-BACK — BJ-004

**Directive:** THREAD11-COPILOT-INTAKE — Directive 7
**Rule:** BJ-004
**Agent:** CLAUDE_CODE
**Date:** 2026-04-17
**Branch:** bijou/bj-004 (stacked on bijou/bj-003 → bijou/bj-002)

---

## Files Created

- `services/bijou/src/bijou-dwell.service.ts` — BijouDwellService: subscribes to `BIJOU_SESSION_CLOSED`, credits guests per dwell interval, writes DwellLog + CreatorDwellAccrual, publishes `BIJOU_DWELL_CREDITED`.
- `PROGRAM_CONTROL/REPORT_BACK/BJ-004-REPORT-BACK.md` (this file)

## Files Modified

- `prisma/schema.prisma` — Added `DwellLog` and `CreatorDwellAccrual` models (both append-only; no `updated_at`).
- `services/core-api/src/governance/governance.config.ts` — Extended `BIJOU` block with `DWELL_CREDIT_INTERVAL_SECONDS = 60`, `DWELL_CREDIT_PER_INTERVAL = 5`, `BIJOU_CREATOR_SPLIT = 0.65`.
- `services/nats/topics.registry.ts` — Registered `BIJOU_DWELL_CREDITED`.
- `services/bijou/src/bijou.module.ts` — Imports `LedgerModule`, registers `BijouDwellService` as provider + export.

## Files Confirmed Unchanged

- `services/bijou/src/bijou-scheduler.service.ts` — untouched
- `services/bijou/src/bijou-admission.service.ts` — untouched
- `services/bijou/src/bijou-session.service.ts` — untouched
- `services/core-api/src/finance/ledger.service.ts` — untouched (uses existing `recordEntry` contract)

## Dwell Formula

For each `BijouAdmission` with `status = ADMITTED` on a session that fires
`BIJOU_SESSION_CLOSED`:

```
dwell_seconds = floor((session.scheduled_end - admission.admitted_at) / 1000)
intervals     = floor(dwell_seconds / DWELL_CREDIT_INTERVAL_SECONDS)  // 60s default
czt_credited  = intervals * DWELL_CREDIT_PER_INTERVAL                  // 5 CZT/interval default
payout_czt    = floor(czt_credited * BIJOU_CREATOR_SPLIT)              // 0.65 default
platform_czt  = czt_credited - payout_czt                              // residual
```

All four numeric knobs (`DWELL_CREDIT_INTERVAL_SECONDS`,
`DWELL_CREDIT_PER_INTERVAL`, `BIJOU_CREATOR_SPLIT`, and the implied
platform share) are read from `GovernanceConfig.BIJOU`. No hardcoded
ratios in service code.

## Creator Accrual Staging

`CreatorDwellAccrual` is written with `settled = false`, `creator_id`
from the `BijouSession.creator_id`, `payout_czt` computed above. The
directive explicitly scopes creator payout settlement OUT of this
directive — accrual rows are queryable for the settlement pipeline in
a later directive.

## Idempotency Approach

- Composite key: `BIJOU_DWELL:${admission_id}:${session_id}` passed as
  `referenceId` to `LedgerService.recordEntry` (which enforces
  uniqueness via the DB's `reference_id` / `idempotency_key`).
- `DwellLog` has `@@unique([admission_id, session_id])` — a second
  credit attempt for the same admission+session is rejected by
  Postgres.
- Duplicate-key errors propagate as per-admission errors and the batch
  continues (no double-credit).

## GovernanceConfig Constants Used

From `services/core-api/src/governance/governance.config.ts`:

- `GovernanceConfig.BIJOU.DWELL_CREDIT_INTERVAL_SECONDS` = 60 ✅ (added)
- `GovernanceConfig.BIJOU.DWELL_CREDIT_PER_INTERVAL` = 5 ✅ (added)
- `GovernanceConfig.BIJOU.BIJOU_CREATOR_SPLIT` = 0.65 ✅ (added)

## NATS Topic Constants Used

- Subscribes: `NATS_TOPICS.BIJOU_SESSION_CLOSED` (from BJ-002)
- Publishes: `NATS_TOPICS.BIJOU_DWELL_CREDITED` ✅ (registered in this directive)

No raw topic strings used.

## Prisma Schema — Append-only Models

- `DwellLog`: `id`, `admission_id`, `session_id`, `user_id`,
  `dwell_seconds`, `czt_credited`, `payout_czt`, `platform_czt`,
  `organization_id`, `tenant_id`, `created_at`. No `updated_at`, no
  `DELETE`. `@@unique([admission_id, session_id])` guarantees
  idempotent credit.
- `CreatorDwellAccrual`: `id`, `creator_id`, `session_id`,
  `payout_czt`, `settled (default false)`, `organization_id`,
  `tenant_id`, `created_at`. No `updated_at`; settlement lives in a
  separate append-only ledger entry later.

## Invariants Confirmed

1. **Append-only** — no `UPDATE`/`DELETE` on DwellLog or LedgerEntry in
   this service ✅
2. **`idempotency_key = admission_id + session_id`** — enforced via
   `recordEntry.referenceId` uniqueness AND `@@unique([admission_id,
   session_id])` on DwellLog ✅
3. **`token_origin: GIFTED` on all guest dwell credits** — hardcoded
   at the `recordEntry` call site; no other origin used ✅
4. **All split constants from GovernanceConfig.BIJOU** — no hardcoded
   0.65 / 60 / 5 ✅
5. **`rule_applied_id` on every ledger entry** —
   `BJ-004_BIJOU_DWELL_CREDIT_v1` ✅
6. **`organization_id` + `tenant_id` on all Prisma writes** — copied
   from admission row onto DwellLog + CreatorDwellAccrual + ledger
   metadata + NATS payload ✅
7. **Per-record error isolation** — errors logged and batch continues ✅

## Multi-tenant Mandate

`organization_id` and `tenant_id` are propagated from the
`BijouAdmission` row through DwellLog, LedgerEntry metadata,
CreatorDwellAccrual, and the `BIJOU_DWELL_CREDITED` NATS payload.

## npx tsc --noEmit Result

Baseline: 1 pre-existing `tsconfig.json` `baseUrl` deprecation notice.
Zero NEW TypeScript errors. ✅

## git diff --stat (BJ-004 additions on top of the stack)

```
prisma/schema.prisma                                  | 38 +++++++++
services/bijou/src/bijou-dwell.service.ts             | 220 ++++++++ (created)
services/bijou/src/bijou.module.ts                    |  6 ++
services/core-api/src/governance/governance.config.ts |  6 ++
services/nats/topics.registry.ts                      |  3 ++
PROGRAM_CONTROL/REPORT_BACK/BJ-004-REPORT-BACK.md     | (created)
```

## Result

**SUCCESS**

All BJ-004 scope items delivered:
- ✅ `DwellLog` + `CreatorDwellAccrual` Prisma schemas (append-only)
- ✅ 65/35 split; guest credited GIFTED CZT on session close
- ✅ Creator payout staged in `CreatorDwellAccrual` (`settled=false`;
     settlement out of scope)
- ✅ `BIJOU_DWELL_CREDITED` NATS topic registered
- ✅ Idempotent on `admission_id + session_id`
- ✅ Zero new tsc errors
