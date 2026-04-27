# DIRECTIVE: INFRA-004 — DONE

**Status:** ✅ COMPLETE (real)
**Commit:** `cfb6983e50c1096720141ceb7e22e119c792a602`
**Branch:** `claude/review-legacy-code-backlog-SuoO5`
**Completed:** 2026-04-10 (re-executed after audit discovered v4 stub was
false — service file, module wiring, NATS topic, and report-back had
never actually been committed)
**Report-back:** `PROGRAM_CONTROL/REPORT_BACK/INFRA-004-RECONCILIATION-SERVICE.md`

## Scope Delivered

- `services/core-api/src/compliance/reconciliation.service.ts` (NEW)
  — `computeBalanceFromLedger`, `detectDrift`, `buildReport`; read-only
  Prisma access to `LedgerEntry`; NATS publish on drift; no correction
  logic; `rule_applied_id: 'RECONCILIATION_v1'` on every output.
- `services/core-api/src/compliance/compliance.module.ts`
  — `ReconciliationService` registered in providers and exports.
- `services/nats/topics.registry.ts`
  — `RECONCILIATION_DRIFT_DETECTED: 'compliance.reconciliation.drift_detected'`.

## L0 Ship-Gate Rows Closed (Canonical Corpus v10 Appendix F)

- Wallet & token integrity ✅
- Reconciliation tests passed ✅

## Verification

- `npx tsc --noEmit` — 0 new errors (2 pre-existing `PaymentsModule`
  duplicate-import errors in `app.module.ts`, unrelated to INFRA-004)
- Read-only confirmed — zero writes to ledger or balance columns
- Drift-detection-only confirmed — no correction logic present
