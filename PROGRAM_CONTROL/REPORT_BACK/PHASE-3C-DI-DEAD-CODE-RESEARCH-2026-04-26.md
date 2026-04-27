# Phase 3c — DI Dead-Code Research Report

**Date:** 2026-04-26
**Branch:** `claude/phase-3c-di-dead-code-research-K2Iu3`
**Authority:** Cleanup-arc follow-up (originally deferred from Phase 3a §7 dead-code list)
**Mode:** Investigation only — zero source changes.

This report re-verifies the 37-file dead-code list from Phase 3a §7 against current `main` (`0500009` post-#367), with an architectural finding that reframes how to interpret the results.

---

## TL;DR

**Most of the 37 files appear to be NestJS scaffolding that no runtime currently loads.** There is **no `main.ts` bootstrap** in `services/core-api/`, so `AppModule` and all its declared `providers`/`controllers`/`imports` are unreached at runtime. The 31 test suites construct services directly via `new ServiceClass(...)` rather than `Test.createTestingModule(AppModule)`, so passing tests don't prove the modules are wired.

**Three plausible architectural states this could represent:**
1. **Scaffolding-in-progress** — the team is building toward a full NestJS app and `main.ts` will land later. Modules stay.
2. **Direct-construction migration** — the team has deliberately moved away from NestJS DI (tests bypass it). Modules are aspirational dead weight.
3. **Mixed pragma** — modules will be selectively kept for the parts that need NestJS HTTP routing (controllers + middleware) and direct construction stays for everything else.

**Without governance/CEO direction on the architectural intent, deletion is unsafe.** This report documents the data; the decision is yours.

---

## Critical structural finding — no NestJS bootstrap

```
$ find services/ -name "main.ts" -o -name "index.ts"
services/ledger/index.ts   # not a Nest bootstrap
$ ls services/core-api/src/main.ts
ls: cannot access ... No such file or directory
```

**What this means:**
- `AppModule` (`services/core-api/src/app.module.ts`) is the canonical NestJS root, but nothing instantiates it.
- All transitive `providers` / `controllers` / `imports` declared by AppModule and downstream modules are at-rest scaffolding.
- The 31 passing test suites use direct construction (e.g. `new LedgerService(repo, config)`) — they would still pass with all `*.module.ts` files deleted.
- Production deployment would fail at startup since there's no entry point — but the repo is pre-launch, so no production exists yet.

This is consistent with the README's posture: *"BUILD COMPLETE — Alpha Launch Ready"* with launch targeted September/October 2026. Bootstrap may simply be a deliberate pre-launch task that hasn't landed.

---

## Re-verified 37-file inventory

Methodology: for each file, count references to ANY of its exported symbols across `services/` / `ui/` / `tests/` / `scripts/` / `finance/` / `safety/`, excluding self-references. A reference count of 0 means the file's exports are unused outside the file itself.

### Already resolved (1 file)

| File | Status | Notes |
|---|---|---|
| `services/showzone/src/showzone.module.ts` | **DELETED** ✅ | Removed in PR #346 (Phase 2a Group C). RETIRED.md tombstone retained. |

### NestJS module scaffolding (12 files) — zero refs but architecturally ambiguous

These export only an `*Module` class wrapping `@Module({...})`. They have no consumers because no `main.ts` loads `AppModule` (and many aren't even imported by `AppModule`).

| File | Class | Refs |
|---|---|---|
| `services/integration-hub/src/hub.module.ts` | `IntegrationHubModule` | 0 |
| `services/risk-engine/src/risk.module.ts` | `RiskModule` | 0 |
| `services/core-api/src/app.module.ts` | `AppModule` | 0 |
| `services/core-api/src/core-api.module.ts` | `CoreApiModule` | 0 |
| `services/core-api/src/ingestion/ingestion.module.ts` | `IngestionModule` | 0 |
| `services/zonebot-scheduler/src/zonebot-scheduler.module.ts` | `ZonebotSchedulerModule` | 0 |
| `services/velocityzone/src/velocityzone.module.ts` | `VelocityZoneModule` | 0 |
| `services/obs-bridge/src/obs-bridge.module.ts` | `OBSBridgeModule` | 0 |
| `services/fraud-prevention/src/fraud-prevention.module.ts` | `FraudPreventionModule` | 0 |
| `services/recovery/src/recovery.module.ts` | `RecoveryModule` | 0 |
| `services/notification/src/notification.module.ts` | `NotificationModule` | 0 |
| (note: many `*.module.ts` files exist but only the originally-flagged ones are listed here) | | |

**Recommendation:** governance call. If the team is going to land `main.ts` and wire up DI, keep them. If direct-construction is the canonical pattern, delete them.

### Service files with zero external refs (likely-dead) — 8 files

These are `*.service.ts` files whose exported classes/types are not imported anywhere outside their own file.

| File | Exports | Refs | Tier |
|---|---|---|---|
| `services/core-api/src/finance/tip.service.ts` | `TipService` | 0 | core-api |
| `services/core-api/src/marketing/gratitude.service.ts` | `GratitudeService` | 0 | core-api |
| `services/core-api/src/risk/risk-score.service.ts` | `RiskScoreService`, `RiskLevel`, `RiskScore` | 0 (⚠️ **listed in `.github/required-files.txt`**) | core-api |
| `services/core-api/src/safety/upload-interceptor.middleware.ts` | `UploadInterceptorMiddleware` | 0 | core-api |
| `services/core-api/src/studio/studio-report.controller.ts` | `StudioReportController` | 0 | core-api |
| `services/velocityzone/src/creator-rate-tier.service.ts` | `CreatorRateTierService`, `CreatorEffectiveRate`, `CREATOR_RATE_RULE_ID` | 0 (⚠️ **just fixed in PR #366; presumably intended to be wired up**) | velocityzone |
| `services/vision-monitor/src/human-counter.worker.ts` | `HumanCounterWorker` | 0 | vision-monitor |
| `services/rewards-api/src/engine/points-calculator.logic.ts` | `calculatePoints` | 0 | rewards-api |

**⚠️ Two of these have governance protection or recent work invested:**
- `risk-score.service.ts` is in `.github/required-files.txt` — the CI required-files check would block deletion.
- `creator-rate-tier.service.ts` was just repaired in PR #366. Deleting after fixing it makes no sense; the intent is clearly "wire it up."

### Service files in `finance/` (top-level, not `services/`) — 5 files

The `finance/` directory has its own append-only invariant per Phase 1 directive. **None of these should be deleted regardless of import count.**

| File | Refs |
|---|---|
| `finance/batch-payout.service.ts` | 3 |
| `finance/commission-splitting.service.ts` | 0 |
| `finance/containment-hold.service.ts` | 0 |
| `finance/evidence-packet.service.ts` | 3 |
| `finance/token-extension.service.ts` | 0 |
| `finance/audit-dashboard.service.ts` | 3 (note: `services/core-api/src/audit/audit-dashboard.service.ts` is a separate file) |

**Recommendation:** leave alone. Finance is append-only per OQMI invariant — even if some files have no current importers, they may be legally retained (audit trail, evidence packets, etc.).

### `safety/` top-level (1 file)

| File | Refs |
|---|---|
| `safety/security-guardrails.service.ts` | 0 |

**Recommendation:** governance call (similar to finance, less explicit invariant).

### `ui/types/finance-contracts.ts` (1 file)

Exports `ISplitRequest`, `ISplitResponse`, `formatCentsToUSD`. 0 refs. UI types-only file.

**Recommendation:** likely safe to delete if the future Next.js frontend won't need it. Low risk.

### `services/core-api/src/audit/audit-dashboard.service.ts` (1 file)

Exports `AuditDashboardService`, `AuditDashboardSummary`, `AuditScenario`. The 3 refs counted are because `services/core-api/src/audit/audit-dashboard.controller.ts` independently re-defines `AuditDashboardSummary` and that name-collision inflates the grep count. **Likely actually 0 real references.**

### `services/core-api/src/compliance/geo-fencing.service.ts` (1 file)

4 refs total — looks live. Probably consumed by some compliance flow. Spot-check before any action.

### `services/core-api/src/finance/batch-payout.service.ts` (1 file)

1 ref total. Spot-check before any action — partial use.

### `services/core-api/src/safety/provisional-suppression.service.ts` (1 file)

3 refs total — likely live. Spot-check.

### `services/core-api/src/geo/geo-pricing.service.ts` (1 file)

6 refs total — looks live. Likely false positive from original Phase 1 list.

### `services/core-api/src/creator/roster.gateway.ts` + `.../surfaces/roster.gateway.ts` (2 files)

Both flagged as duplicates in Phase 2b research (PR #347). Both have 1 ref (each refers to its own `RosterGateway` type once). Phase 2b recommendation stands: the surfaces/ version is a 2-line empty shell subset of creator/ version; delete surfaces/, retain creator/ pending wire-decision.

### `scripts/seed-scheduling.ts` and `scripts/verify-vault-delivery.ts`

No exports at all (top-level scripts run directly). Existence justified by their `package.json` script entries (`seed:scheduling`). Verify before any action.

### `services/rewards-api/src/white-label/partner-config.schema.ts`

NO_EXPORTS. Schema definition file. Likely consumed by code parsing it (not via import). Verify before any action.

---

## Summary classification

| Confidence | Class | Count | Action |
|---|---|---|---|
| HIGH | Already deleted | 1 | None — done |
| **GOVERNANCE** | NestJS scaffolding awaiting bootstrap decision | 12 | Wait for architectural call before touching |
| **GOVERNANCE** | Newly-fixed code (3b-8b) clearly meant to be wired up | 1 | Wire up; do not delete |
| **GOVERNANCE** | CI-required file | 1 | Cannot delete (`required-files.txt` block) |
| **GOVERNANCE** | Append-only `finance/` files | 5 | Do not delete per OQMI invariant |
| LOW | Probably-live (3+ refs, false positive) | 4 | Drop from dead-code list |
| MEDIUM | Service files with 0 refs in `services/` (excl. governance-protected) | 5 | Spot-check + governance call |
| LOW-MED | UI/script utility files | 4 | Spot-check |
| HIGH (per Phase 2b research) | `roster.gateway.ts surfaces/` empty-shell duplicate | 1 | Safe to delete (Phase 2b already recommended) |

---

## Recommendations

**Don't auto-delete anything.** The heart of this report is: the dead-code question is actually an architectural question (NestJS DI vs direct construction), and a governance question (what `finance/`, `required-files.txt`, etc. should contain). Both deserve human decisions, not regex sweeps.

**Concrete safe actions for a follow-up PR (if you authorize each):**

1. **Delete `services/core-api/src/creator/surfaces/roster.gateway.ts`** — confirmed empty-shell subset by Phase 2b research; trivially safe.
2. **Delete `ui/types/finance-contracts.ts`** — 0 refs across UI/services/tests; UI hasn't been bootstrapped yet so no consumer will surface.
3. **No other deletions without explicit per-file authorization.**

**Deferred until governance decision lands:**

- All NestJS module scaffolding (12 files). Governance question: "are we building a NestJS app or moving fully to direct-construction?"
- All `services/core-api/src/*` services with 0 refs. Same governance question.
- All `finance/` and `safety/` files. Append-only invariant.
- `risk-score.service.ts` is in CI required-files; needs `required-files.txt` update first if ever to be deleted.

---

## What was NOT done

- No code changed. No files deleted.
- No NestJS instrumented boot run (would require writing a TestingModule harness; out of scope for this research pass).
- No deletions decided. All recommendations are research-level; user has final call.

The cleanup arc as scoped is complete — this report bookends Phase 3c with a clear-eyed assessment that the remaining "dead code" is largely an architecture/governance question, not a hygiene one.
