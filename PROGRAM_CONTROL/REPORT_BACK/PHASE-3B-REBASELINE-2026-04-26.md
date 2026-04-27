# PHASE-3B-REBASELINE-2026-04-26

**Task:** Phase 3b-0 Directive — Re-Baseline Against Current main
**Branch:** `claude/rebaseline-against-current-main`
**HEAD:** `d656017` (chore(scoping): Phase 3a — baseline repair classification (no fixes) (#348))
**Date:** 2026-04-26
**Agent:** COPILOT (GitHub Copilot Task Agent)
**Result:** SUCCESS — re-measurement complete, no code changed

---

## 1. Environment Fingerprint

| Field | Value |
|---|---|
| Node version | `v20.20.2` |
| Yarn version | `1.22.22` |
| `node_modules/.prisma/client/` | **PRESENT** (files: `default.d.ts`, `default.js`, etc.) |
| `node_modules/@prisma/client/index.d.ts` | **PRESENT** (39 bytes) |
| `node_modules/.prisma/client/index.d.ts` | **PRESENT but STALE** — exports `PrismaClient = any`, `dmmf = any`; no model types or enums |
| Prisma schema location | `prisma/schema.prisma` |
| Prisma client generator target | Default (`node_modules/.prisma/client`) |

**`yarn install --frozen-lockfile` result:** `Already up-to-date. Done in 0.28s.` — lockfile is clean.

**`node PROGRAM_CONTROL/ship-gate-verifier.ts` result:** Runtime error — `TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".ts"`. Node v20 cannot execute `.ts` files directly without `ts-node`. The file is exercised through jest (suite `tests/e2e/ship-gate-verifier.spec.ts` — **PASS**).

---

## 2. Headline Counts Table

| Metric | Phase 3a baseline | Phase 3b-0 (now) | Δ |
|---|---|---|---|
| TSC errors | 25 | **14** | **-11** ✅ |
| Lint errors | 4 | **4** | 0 |
| Jest suite failures | 14 | **4** | **-10** ✅ |
| Jest tests passed | 202 | **357** | **+155** ✅ |
| Ship-gate | 19/19 GREEN (via jest) | 19/19 GREEN (via jest) | 0 |

**Summary:** The SENSYNC_MERGE_DUPLICATE fix that landed in d656017 delivered exactly as predicted:
- TSC errors: 25 → 14 (11 errors cleared, **44% reduction**)
- Jest suite failures: 14 → 4 (10 suites unblocked, **71% reduction**)
- Jest tests passed: 202 → 357 (+155 tests, **77% increase**)

---

## 3. Per-Error Reconciliation Table

### TSC Errors from Phase 3a — Status Accounting

| Phase 3a # | file:line:col | TS Code | Status | Notes |
|---|---|---|---|---|
| 1 | `bijou-admission.service.ts:16:10` | TS2305 | **STILL_PRESENT** | PRISMA_CLIENT_MISSING (BijouAdmissionStatus) |
| 2 | `bijou-dwell.service.ts:11:10` | TS2305 | **STILL_PRESENT** | PRISMA_CLIENT_MISSING (BijouAdmissionStatus) |
| 3 | `bijou-scheduler.service.ts:10:10` | TS2305 | **STILL_PRESENT** | PRISMA_CLIENT_MISSING (BijouSessionStatus) |
| 4 | `app.module.ts:30:10` | TS2305 | **STILL_PRESENT** | FFS_RENAME_DRIFT (FlickerNFlameScoringModule) |
| 5 | `membership.service.ts:10:10` | TS2305 | **STILL_PRESENT** | PRISMA_CLIENT_MISSING (BillingInterval) |
| 6 | `membership.service.ts:10:27` | TS2305 | **STILL_PRESENT** | PRISMA_CLIENT_MISSING (MembershipTier) |
| 7 | `membership.service.ts:10:43` | TS2305 | **STILL_PRESENT** | PRISMA_CLIENT_MISSING (SubscriptionStatus) |
| 8 | `stipend-distribution.job.ts:12:10` | TS2305 | **STILL_PRESENT** | PRISMA_CLIENT_MISSING (MembershipTier) |
| 9 | `stipend-distribution.job.ts:12:26` | TS2305 | **STILL_PRESENT** | PRISMA_CLIENT_MISSING (SubscriptionStatus) |
| 10 | `compliance-guard.service.ts:10:15` | TS2305 | **STILL_PRESENT** | PRISMA_CLIENT_MISSING (ShiftTemplate) |
| 11 | `ffs.engine.ts:92:35` | TS2339 | **STILL_PRESENT** | NATS_TOPIC_NAME_DRIFT (FFS_SCORE_SAMPLE) |
| 12 | `ffs.engine.ts:103:37` | TS2551 | **STILL_PRESENT** | NATS_TOPIC_NAME_DRIFT (FFS_SCORE_TIER_CHANGED) |
| 13 | `ffs.engine.ts:115:37` | TS2339 | **STILL_PRESENT** | NATS_TOPIC_NAME_DRIFT (FFS_SCORE_PEAK) |
| 14 | `fan-fervor-score.service.ts:191:35` | TS2339 | **STILL_PRESENT** | NATS_TOPIC_NAME_DRIFT (FFS_SCORED) |
| 15 | `topics.registry.ts:286:3` | TS1117 | **RESOLVED** | Duplicate key removed (SENSYNC fix d656017) |
| 16 | `topics.registry.ts:291:3` | TS1117 | **RESOLVED** | Duplicate key removed (SENSYNC fix d656017) |
| 17 | `topics.registry.ts:296:3` | TS1117 | **RESOLVED** | Duplicate key removed (SENSYNC fix d656017) |
| 18 | `topics.registry.ts:305:3` | TS1117 | **RESOLVED** | Duplicate key removed (SENSYNC fix d656017) |
| 19 | `topics.registry.ts:306:3` | TS1117 | **RESOLVED** | Duplicate key removed (SENSYNC fix d656017) |
| 20 | `topics.registry.ts:307:3` | TS1117 | **RESOLVED** | Duplicate key removed (SENSYNC fix d656017) |
| 21 | `topics.registry.ts:308:3` | TS1117 | **RESOLVED** | Duplicate key removed (SENSYNC fix d656017) |
| 22 | `topics.registry.ts:309:3` | TS1117 | **RESOLVED** | Duplicate key removed (SENSYNC fix d656017) |
| 23 | `topics.registry.ts:316:3` | TS1117 | **RESOLVED** | Duplicate key removed (SENSYNC fix d656017) |
| 24 | `topics.registry.ts:319:3` | TS1117 | **RESOLVED** | Duplicate key removed (SENSYNC fix d656017) |
| 25 | `topics.registry.ts:320:3` | TS1117 | **RESOLVED** | Duplicate key removed (SENSYNC fix d656017) |

**Resolution summary:**
- **STILL_PRESENT:** 14 errors (TSC #1–14) — all match Phase 3a bucket assignments
- **RESOLVED:** 11 errors (TSC #15–25) — all cleared by SENSYNC_MERGE_DUPLICATE fix in d656017
- **LOCATION_CHANGED:** 0 errors

**Confirmation:** The SENSYNC dedup fix (removal of duplicate block lines 285–320 in topics.registry.ts) cleared all 11 TS1117 errors as predicted. The file now ends at line 302 (previously 320+). Net-new unique keys (`VELOCITYZONE_EVENT_ENDED`, `VELOCITYZONE_RATE_LOCKED`, `CYRANO_FFS_FRAME_CONSUMED`) were correctly preserved in the canonical sections.

---

## 4. Newly-Surfaced Errors

**Count:** 0 (zero)

No new TSC errors surfaced after the SENSYNC fix. Phase 3a §8.4 predicted 0–N new errors might emerge once `topics.registry.ts` compiled cleanly. The actual result is **N = 0**. All 14 remaining errors were already cataloged in Phase 3a.

---

## 5. Updated Bucket Roll-Up

### TSC error buckets (14 total, down from 25)

| Bucket | Count | % | Change from 3a |
|---|---|---|---|
| `PRISMA_CLIENT_MISSING` | 9 | 64% | +28pp (was 36%) |
| `NATS_TOPIC_NAME_DRIFT` | 4 | 29% | +13pp (was 16%) |
| `FFS_RENAME_DRIFT` | 1 | 7% | +3pp (was 4%) |
| `SENSYNC_MERGE_DUPLICATE` | 0 | 0% | **CLEARED** ✅ (was 44%) |
| `SHOWZONE_REMOVAL_DRIFT` | 0 | 0% | — |
| `EXTERNAL_TYPE_MISSING` | 0 | 0% | — |
| `REAL_BUG` | 0 | 0% | — |
| `OTHER` | 0 | 0% | — |

### Lint error buckets (4 total, unchanged)

| Bucket | Count | % |
|---|---|---|
| `UNUSED_IMPORT` | 2 | 50% |
| `UNUSED_VAR` | 2 | 50% |
| `OTHER` | 0 | 0% |

**Lint errors unchanged:**
- L1: `app.module.ts:29` — `RefundModule` unused import
- L2: `guest-heat.service.ts:22` — `OfferType` unused import
- L3: `creator-rate-day61.job.ts:14` — `randomUUID` unused import
- L4: `zonebot-scheduler.service.ts:51` — `forecast` unused var (needs `_` prefix)

### Jest failure mode buckets (4 suites, down from 14)

| Failure mode | Count | % | Change from 3a |
|---|---|---|---|
| `TSC_CASCADE` | 4 | 100% | -10 suites ✅ (was 14) |
| `RUNTIME_ASSERTION` | 0 | 0% | — |
| `MISSING_FIXTURE` | 0 | 0% | — |
| `IMPORT_ERROR` | 0 | 0% | — |
| `TIMEOUT` | 0 | 0% | — |
| `OTHER` | 0 | 0% | — |

**Jest suites still failing (4):**
1. `tests/integration/ledger-service.spec.ts` — duplicate `TokenOrigin` import + `TokenType.REGULAR` not existing (spec-only issues)
2. `tests/integration/creator-control-service.spec.ts` — imports ffs.engine.ts which uses `FFS_SCORE_TIER_CHANGED` (TSC #12)
3. `tests/integration/integration-hub.spec.ts` — imports ffs.engine.ts which uses `FFS_SCORE_SAMPLE` (TSC #11)
4. `tests/e2e/high-heat-cyrano-payout-flow.spec.ts` — imports ffs.engine.ts which uses `FFS_SCORE_SAMPLE` (TSC #11)

**Jest suites unblocked (10):**
- J2: `refund-disclosure.spec.ts` ✅
- J3: `gateguard-service.spec.ts` ✅
- J4: `bijou-session.spec.ts` ✅
- J5: `purchase-hours-gate.spec.ts` ✅
- J6: `immutable-audit-service.spec.ts` ✅
- J7: `gateguard-scorer.spec.ts` ✅
- J9: `gateguard-middleware.spec.ts` ✅
- J10: `cyrano-service.spec.ts` ✅
- J11: (original ID unclear, but 10 suites unblocked total)
- J12–J14: (original IDs unclear, but 10 suites unblocked total)

All 10 suites previously failed due to `topics.registry.ts` TS1117 duplicate key errors. Now that the registry compiles cleanly, they pass.

---

## 6. Updated Dependency Graph

```
PRISMA_CLIENT_MISSING (1 root fix — `yarn prisma:generate`, BUILD_PIPELINE)
  └─► Clears TSC #1–3, #5–10 (9 errors)
  └─► No direct jest suite unblocks (remaining 4 failing suites fail due to
       NATS topic drift, not Prisma)
  └─► Eliminates all TS2305 "@prisma/client" noise

NATS_TOPIC_NAME_DRIFT (4 errors, 3 files — ffs.engine.ts x3, fan-fervor-score.service.ts x1)
  └─► No prerequisite fixes (can be done independently)
  └─► Fixes TSC #11, #12, #13, #14
  └─► Fixing #12 (FFS_SCORE_TIER_CHANGED → FFS_TIER_CHANGED) will unblock J2
       (creator-control-service.spec.ts)
  └─► Fixing #11 (FFS_SCORE_SAMPLE) will unblock J3, J4 (integration-hub,
       high-heat-cyrano)
  └─► #11, #13, #14 have no equivalent topic in the registry — correct names TBD
       (requires human confirmation; see §8)

FFS_RENAME_DRIFT (1 error, 1 file — app.module.ts)
  └─► No prerequisite fixes (can be done independently)
  └─► Fixes TSC #4; import `FfsModule` instead of `FlickerNFlameScoringModule`
  └─► No direct jest suite unblocks

LINT errors (4, all SINGLE_FILE)
  └─► All independent; no prerequisites; no jest impact
  └─► L1 (app.module.ts RefundModule) co-located with TSC #4 — same file, same PR candidate

JEST J1 (ledger-service.spec.ts — spec-only issues)
  └─► Duplicate TokenOrigin import: fix independently within spec file
  └─► TokenType.REGULAR + TokenType.BIJOU bugs: REAL_BUG requiring human review (see §8)
  └─► Not gated on any of the 14 main TSC fixes
```

**Bottom line (updated from Phase 3a):**
- ~~Fixing `SENSYNC_MERGE_DUPLICATE`~~ ✅ **DONE** — cleared 44% of TSC errors and unblocked 10/14 jest suites
- Fixing `PRISMA_CLIENT_MISSING` (run `yarn prisma:generate` as a build step) will clear 64% of remaining TSC errors (9 of 14)
- Fixing `NATS_TOPIC_NAME_DRIFT` (4 errors) will unblock the remaining 3 non-spec jest suites (J2, J3, J4)
- Together, those two fixes will clear 13 of 14 TSC errors and bring jest to 1 failing suite (J1, which has spec-only issues)

---

## 7. Phase 3b-2/3/4 Readiness Check

### Is PRISMA_CLIENT_MISSING still 9 errors?
**YES.** Still 9 errors (TSC #1–3, #5–10). No change from Phase 3a. The stale Prisma client state is identical.

### Is FFS_RENAME_DRIFT still 1 error?
**YES.** Still 1 error (TSC #4: `app.module.ts:30` importing `FlickerNFlameScoringModule` instead of `FfsModule`). No change from Phase 3a.

### Is the FFS_SCORE_TIER_CHANGED → FFS_TIER_CHANGED rename still unambiguous?
**YES.** TSC #12 still shows TS2551 with suggestion: "Did you mean 'FFS_TIER_CHANGED'?". The canonical name `FFS_TIER_CHANGED` exists in topics.registry.ts at line 248 (previously line 235 in Phase 3a — line number shifted due to SENSYNC fix, but key is unchanged).

### Are the 3 ambiguous NATS topics still present in the same locations?
**YES.** TSC #11, #13, #14 still reference:
- `FFS_SCORE_SAMPLE` (ffs.engine.ts:92)
- `FFS_SCORE_PEAK` (ffs.engine.ts:115)
- `FFS_SCORED` (fan-fervor-score.service.ts:191)

None of these exist in the registry. No equivalent topics found. Human confirmation required (see §8.2).

### Is TokenType.REGULAR still referenced in tests/integration/ledger-service.spec.ts?
**YES.** The spec still references `TokenType.REGULAR` (which doesn't exist) and now **also** `TokenType.BIJOU` (which also doesn't exist). See §8.1 — this is now confirmed as a broader REAL_BUG beyond Phase 3a's initial identification.

### Summary
All Phase 3b-2/3/4 fix waves remain viable and unblocked. The SENSYNC fix changed no preconditions for the remaining work.

---

## 8. Risks & Open Questions

### 8.1 REAL_BUG: TokenType.REGULAR + TokenType.BIJOU in ledger-service.spec.ts

**Updated from Phase 3a §8.1.** The spec now shows references to **both** `TokenType.REGULAR` and `TokenType.BIJOU`:
- `TokenType.REGULAR` at lines 138, 155, 169, 177, 191, 210, 229, 236, 237, 238, 239, 246, 248, 290, 299, 316, 325, 344, 353, 375, 385, 397, 406, 431, 452, 463, 477, 486
- `TokenType.BIJOU` at lines 247, 249

The `TokenType` enum in `services/core-api/src/finance/ledger.service.ts` defines only `CZT`. Neither `REGULAR` nor `BIJOU` exist.

**Hypothesis:** The ledger was designed to support multiple token types (CZT, REGULAR for general-purpose tokens, BIJOU for theatre-specific tokens), but only CZT was implemented. The spec was written against a planned data model that was never completed.

**Impact:** This cannot be resolved without human confirmation of the token taxonomy. **Flag for human review before Phase 3b-6.**

### 8.2 NATS topic names for FFS_SCORE_SAMPLE, FFS_SCORE_PEAK, FFS_SCORED

**Unchanged from Phase 3a §8.2.** Three topic constants used in production code do not exist in the registry. The registry has `FFS_SCORE_UPDATE` (line 247) and `FFS_TIER_CHANGED` (line 248) as canonical names. The question remains:
- Are these old names that should map to `FFS_SCORE_UPDATE` / `FFS_TIER_CHANGED` / (some peak variant)?
- Or are they distinct, separate events that should be added to the registry?

Until confirmed, the unambiguous fix (TSC #12: `FFS_SCORE_TIER_CHANGED → FFS_TIER_CHANGED`) can proceed independently. The three ambiguous topics (TSC #11, #13, #14) remain blocked on human confirmation.

### 8.3 No new errors surfaced (Phase 3a §8.4 resolved)

**RESOLVED.** Phase 3a §8.4 predicted that fixing `topics.registry.ts` might unmask 0–N additional errors. The actual result is **N = 0**. No new errors surfaced. The error count delta matches the prediction exactly:
- Phase 3a: 25 errors
- Phase 3b-0: 14 errors
- Delta: -11 (exactly the 11 SENSYNC_MERGE_DUPLICATE errors cleared)

### 8.4 Prisma client is stale, not absent (Phase 3a §8.5 unchanged)

**Unchanged from Phase 3a §8.5.** The `.prisma/client/` directory exists and exports `PrismaClient = any`. This means **no import of `PrismaClient` itself causes a type error** (it's `any`), but all enum and model types imported by name cause TS2305. After `yarn prisma:generate`, the actual number of Prisma-related errors could differ from 9 if the schema is missing definitions that are referenced in code but not yet added to schema.prisma. Recommend running `yarn tsc --noEmit` immediately after generation and diffing against the 14-error baseline.

### 8.5 RefundModule lint error (L1) co-located with TSC #4 (Phase 3a §8.6 unchanged)

**Unchanged from Phase 3a §8.6.** `app.module.ts` line 29 has an unused `RefundModule` import, and line 30 has the stale `FlickerNFlameScoringModule` import. These are in the same file and should land in the same PR (3b-4/3b-5). However, it's worth checking whether `RefundModule` was intentionally removed from the NestJS DI graph or was accidentally dropped — if dropped accidentally, the correct fix is to re-add it to `@Module({ imports: [...] })`, not remove the import.

### 8.6 NEW: Jest tests passed count jumped from 202 → 357

**New observation.** Phase 3a showed 202 tests passed (from 17 passing suites). Phase 3b-0 shows 357 tests passed (from 27 passing suites). This is a **+155 test increase** (+77%).

This confirms that the 10 unblocked suites collectively contain **155 test cases**, all of which were previously prevented from running by the topics.registry.ts compilation failure. No test assertions failed in any of these suites — they all pass now that they can compile and execute.

This validates the Phase 3a dependency graph prediction: the SENSYNC fix was the highest-leverage single change, unblocking the majority of the test suite.

---

## 9. What Was NOT Done

- No code changed. The only file written was this report.
- No `yarn prisma:generate` run.
- No `yarn prisma:push`, `yarn prisma:migrate` run.
- No suppressions added (`// @ts-ignore`, `// @ts-expect-error`, `// eslint-disable`).
- No tests modified, skipped, or snapshot-updated.
- No dependencies changed (`package.json`, `yarn.lock` untouched).
- No `--fix` flag used on lint.
- No formatter writes.
- No modifications to any source files (including `services/nats/topics.registry.ts`, `tsconfig.json`, `jest.config.js`, `.eslintrc.js`, CI workflows, `prisma/migrations/`, or any service code).
- No rebase, force-push, or `--no-verify`.

---

## Appendix: Commands Run

```bash
node --version          → v20.20.2
yarn --version          → 1.22.22
ls node_modules/.prisma/client   → present (default.d.ts, default.js, edge.d.ts, edge.js, ...)
ls node_modules/@prisma/client/index.d.ts → present (39 bytes)
yarn install --frozen-lockfile   → Already up-to-date. Done in 0.28s.
yarn tsc --noEmit        → 14 errors (exit 2) — logged to /tmp/tsc-output.txt
yarn lint                → 4 errors (exit 1) — logged to /tmp/lint-output.txt
yarn jest --passWithNoTests → 4 suites failed, 27 passed, 357 tests passed (exit 1) — logged to /tmp/jest-output.txt
node PROGRAM_CONTROL/ship-gate-verifier.ts → ERR_UNKNOWN_FILE_EXTENSION (.ts) — not a ts-node environment
```

---

## Appendix: Full TSC Error List (14 errors)

```
services/bijou/src/bijou-admission.service.ts(16,10): error TS2305: Module '"@prisma/client"' has no exported member 'BijouAdmissionStatus'.
services/bijou/src/bijou-dwell.service.ts(11,10): error TS2305: Module '"@prisma/client"' has no exported member 'BijouAdmissionStatus'.
services/bijou/src/bijou-scheduler.service.ts(10,10): error TS2305: Module '"@prisma/client"' has no exported member 'BijouSessionStatus'.
services/core-api/src/app.module.ts(30,10): error TS2305: Module '"../../ffs/src/ffs.module"' has no exported member 'FlickerNFlameScoringModule'.
services/core-api/src/membership/membership.service.ts(10,10): error TS2305: Module '"@prisma/client"' has no exported member 'BillingInterval'.
services/core-api/src/membership/membership.service.ts(10,27): error TS2305: Module '"@prisma/client"' has no exported member 'MembershipTier'.
services/core-api/src/membership/membership.service.ts(10,43): error TS2305: Module '"@prisma/client"' has no exported member 'SubscriptionStatus'.
services/core-api/src/membership/stipend-distribution.job.ts(12,10): error TS2305: Module '"@prisma/client"' has no exported member 'MembershipTier'.
services/core-api/src/membership/stipend-distribution.job.ts(12,26): error TS2305: Module '"@prisma/client"' has no exported member 'SubscriptionStatus'.
services/core-api/src/scheduling/compliance-guard.service.ts(10,15): error TS2305: Module '"@prisma/client"' has no exported member 'ShiftTemplate'.
services/creator-control/src/ffs.engine.ts(92,35): error TS2339: Property 'FFS_SCORE_SAMPLE' does not exist on type '{...}'.
services/creator-control/src/ffs.engine.ts(103,37): error TS2551: Property 'FFS_SCORE_TIER_CHANGED' does not exist on type '{...}'. Did you mean 'FFS_TIER_CHANGED'?
services/creator-control/src/ffs.engine.ts(115,37): error TS2339: Property 'FFS_SCORE_PEAK' does not exist on type '{...}'.
services/guest-heat/src/fan-fervor-score.service.ts(191,35): error TS2339: Property 'FFS_SCORED' does not exist on type '{...}'.
```

---

**END PHASE-3B-REBASELINE-2026-04-26**
