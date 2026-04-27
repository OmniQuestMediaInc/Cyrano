# REPORT-BACK — MEMB-003

**Directive:** THREAD11-COPILOT-INTAKE — Directive 4
**Rule:** MEMB-003
**Agent:** CLAUDE_CODE
**Date:** 2026-04-17
**Branch:** fiz/memb-003

---

## Files Created

- `services/core-api/src/membership/stipend-distribution.job.ts` — StipendDistributionJob: iterates ACTIVE subscriptions, grants monthly CZT stipend via LedgerService with TokenOrigin.GIFTED, idempotent on `subscription_id + billing_period_start`.
- `PROGRAM_CONTROL/REPORT_BACK/MEMB-003-REPORT-BACK.md` (this file)

## Files Modified

- `services/core-api/src/config/governance.config.ts` — Added `MEMBERSHIP.STIPEND_CZT` block (DAY_PASS=0, ANNUAL=100, OMNIPASS_PLUS=250, DIAMOND=500).
- `services/nats/topics.registry.ts` — Registered `MEMBERSHIP_STIPEND_DISTRIBUTED = 'membership.stipend.distributed'`.
- `services/core-api/src/membership/membership.module.ts` — Imported `LedgerModule`, registered `StipendDistributionJob` provider and export.

## Files Confirmed Unchanged

- `services/core-api/src/membership/membership.service.ts` — not modified (MEMB-002 surface intact).
- `services/core-api/src/zone-access/zone-access.service.ts` — not modified.
- `services/core-api/src/finance/ledger.service.ts` — not modified (see idempotency note below).
- `prisma/schema.prisma` — no schema changes in this directive.

## GovernanceConfig Constants Used

All read from `services/core-api/src/config/governance.config.ts`:

- `MEMBERSHIP.STIPEND_CZT.DAY_PASS` = 0 ✅ (added in this directive)
- `MEMBERSHIP.STIPEND_CZT.ANNUAL` = 100 ✅ (added in this directive)
- `MEMBERSHIP.STIPEND_CZT.OMNIPASS_PLUS` = 250 ✅ (added in this directive)
- `MEMBERSHIP.STIPEND_CZT.DIAMOND` = 500 ✅ (added in this directive)

## NATS Topic Constants Used

- `NATS_TOPICS.MEMBERSHIP_STIPEND_DISTRIBUTED` ✅ registered in this directive

No raw topic strings used.

## Idempotency Approach

- `LedgerService.recordEntry` already enforces idempotency via its unique
  `reference_id` field (pre-existing in the TypeORM entity and the Prisma
  `LedgerEntry.idempotency_key` unique column in the DB schema).
- `StipendDistributionJob` composes the idempotency key as
  `${subscription_id}:${billing_period_start.toISOString()}` and passes it as
  `referenceId` to `recordEntry`. The unique constraint on the ledger table
  causes duplicate grants within the same billing period to be rejected —
  no double-grant possible.
- The composed `idempotency_key` is also persisted in `metadata` for audit
  traceability and mirrored on the `membership.stipend.distributed` NATS
  payload.

No schema change required — the Prisma `LedgerEntry.idempotency_key` column
already exists as a unique index.

## Invariants Confirmed

1. **Append-only ledger** — StipendDistributionJob only calls `recordEntry`;
   no UPDATE on ledger rows ✅
2. **token_origin: GIFTED on all stipend entries** — `TokenOrigin.GIFTED`
   hardcoded at the call site; no other origin used ✅
3. **idempotency_key prevents double-grant** — DB-level unique constraint
   via `reference_id` / `idempotency_key` ✅
4. **rule_applied_id on every ledger entry** — `MEMB-003_MONTHLY_STIPEND_v1`
   passed on `recordEntry` and on every NATS payload ✅
5. **organization_id + tenant_id on all writes** — populated on NATS
   payload and ledger metadata from the subscription record ✅
6. **No hardcoded stipend amounts** — read from `MEMBERSHIP.STIPEND_CZT`
   only ✅
7. **Logger on all code paths** — job start, each grant, each skip, each
   error, and job complete are logged ✅
8. **Error isolation** — per-subscription errors are logged and the batch
   continues (directive: "do not halt batch") ✅
9. **NATS_TOPICS.* only** — no raw strings ✅

## Multi-tenant Mandate

- `organization_id` and `tenant_id` are copied from each
  `MembershipSubscription` row into the ledger metadata and the NATS
  payload ✅

## Prisma Schema

- No schema changes required. `MembershipSubscription` already carries
  `organization_id`, `tenant_id`, `current_period_start`, and the `tier`
  enum from MEMB-002.
- `LedgerEntry.idempotency_key` is already a unique index
  (`prisma/schema.prisma` line 20).

## npx tsc --noEmit Result

Baseline (main): 1 pre-existing error in `tsconfig.json` (`baseUrl`
deprecation notice — TS5101). No new errors introduced by this directive.

```
tsconfig.json(12,5): error TS5101: Option 'baseUrl' is deprecated ...
```

Zero NEW TypeScript errors. ✅

## git diff --stat

```
services/core-api/src/config/governance.config.ts     |  8 ++++++++
services/core-api/src/membership/membership.module.ts |  8 ++++++--
services/nats/topics.registry.ts                      |  3 +++
3 files changed, 17 insertions(+), 2 deletions(-)
+ services/core-api/src/membership/stipend-distribution.job.ts (created, 134 lines)
+ PROGRAM_CONTROL/REPORT_BACK/MEMB-003-REPORT-BACK.md (created)
```

## Result

**SUCCESS**

All MEMB-003 scope items delivered:
- ✅ `MEMBERSHIP.STIPEND_CZT` constants in GovernanceConfig
- ✅ `StipendDistributionJob` with per-subscription error isolation
- ✅ `TokenOrigin.GIFTED` on all stipend ledger entries
- ✅ Idempotency via `subscription_id + billing_period_start`
- ✅ `MEMBERSHIP_STIPEND_DISTRIBUTED` NATS topic registered
- ✅ Logger + `rule_applied_id` on every path
- ✅ `organization_id` + `tenant_id` propagated from subscription
- ✅ Zero new tsc errors
