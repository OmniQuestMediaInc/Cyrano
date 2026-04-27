# PHASE-3A-BASELINE-SCOPING-2026-04-26

**Task:** Phase 3a Directive — Baseline Repair Scoping (Investigation Only)
**Branch:** `copilot/claudephase-3a-baseline-scoping-k2iu3`
**HEAD:** `909cd16`
**Date:** 2026-04-26
**Agent:** COPILOT (GitHub Copilot Coding Agent)
**Result:** SUCCESS — investigation complete, no code changed

---

## 1. Environment Fingerprint

| Field | Value |
|---|---|
| Node version | `v20.20.2` |
| Yarn version | `1.22.22` |
| `node_modules/.prisma/client/` | **PRESENT** (files: `default.d.ts`, `default.js`, `edge.d.ts`, `edge.js`, `index-browser.js`, `index.d.ts`, `index.js`, `wasm.d.ts`, `wasm.js`) |
| `node_modules/@prisma/client/index.d.ts` | **PRESENT** (content: `export * from '.prisma/client/default'`) |
| `node_modules/.prisma/client/index.d.ts` | **PRESENT but STALE** — exports `PrismaClient = any`, `dmmf = any`; no model types or enums |
| Prisma schema location | `prisma/schema.prisma` |
| Prisma client generator target | Default (`node_modules/.prisma/client`) — `generator client { provider = "prisma-client-js" }` (no custom `output`) |

**Key note on Prisma state:** Both client directories exist but the generated client is a **placeholder/stale build** — it was not regenerated after the latest schema additions (Bijou models, membership enums, ShiftTemplate). All exported members that the code expects are absent; the type system sees `PrismaClient as any`, which is why TS2305 errors surface for enum types rather than the client class itself.

**`yarn install --frozen-lockfile` result:** `Already up-to-date. Done in 0.45s.` — lockfile is clean.

**`node PROGRAM_CONTROL/ship-gate-verifier.ts` result:** Runtime error — `TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".ts"`. Node v20 cannot execute `.ts` files directly without `ts-node`. The file is exercised through jest (suite `tests/e2e/ship-gate-verifier.spec.ts` — **PASS**).

---

## 2. TSC Error Inventory

Command: `yarn tsc --noEmit` — **25 errors**, exit code 2.  
Full output written to `/tmp/tsc-output.txt`.

> **Note:** `tsconfig.json` excludes `**/*.spec.ts` — test-file-only errors do not appear here; they surface in §4 only via jest.

| # | file:line:col | TS Code | Error message (≤80 chars) | Root-cause bucket | Proposed fix shape | Blast radius | Unblocks |
|---|---|---|---|---|---|---|---|
| 1 | `services/bijou/src/bijou-admission.service.ts:16:10` | TS2305 | Module '"@prisma/client"' has no exported member 'BijouAdmissionStatus' | `PRISMA_CLIENT_MISSING` | Regenerate Prisma client | `BUILD_PIPELINE` | — |
| 2 | `services/bijou/src/bijou-dwell.service.ts:11:10` | TS2305 | Module '"@prisma/client"' has no exported member 'BijouAdmissionStatus' | `PRISMA_CLIENT_MISSING` | Regenerate Prisma client | `BUILD_PIPELINE` | — |
| 3 | `services/bijou/src/bijou-scheduler.service.ts:10:10` | TS2305 | Module '"@prisma/client"' has no exported member 'BijouSessionStatus' | `PRISMA_CLIENT_MISSING` | Regenerate Prisma client | `BUILD_PIPELINE` | — |
| 4 | `services/core-api/src/app.module.ts:30:10` | TS2305 | Module '…/ffs.module' has no exported member 'FlickerNFlameScoringModule' | `FFS_RENAME_DRIFT` | Update import to use `FfsModule` | `SINGLE_FILE` | — |
| 5 | `services/core-api/src/membership/membership.service.ts:10:10` | TS2305 | Module '"@prisma/client"' has no exported member 'BillingInterval' | `PRISMA_CLIENT_MISSING` | Regenerate Prisma client | `BUILD_PIPELINE` | — |
| 6 | `services/core-api/src/membership/membership.service.ts:10:27` | TS2305 | Module '"@prisma/client"' has no exported member 'MembershipTier' | `PRISMA_CLIENT_MISSING` | Regenerate Prisma client | `BUILD_PIPELINE` | — |
| 7 | `services/core-api/src/membership/membership.service.ts:10:43` | TS2305 | Module '"@prisma/client"' has no exported member 'SubscriptionStatus' | `PRISMA_CLIENT_MISSING` | Regenerate Prisma client | `BUILD_PIPELINE` | — |
| 8 | `services/core-api/src/membership/stipend-distribution.job.ts:12:10` | TS2305 | Module '"@prisma/client"' has no exported member 'MembershipTier' | `PRISMA_CLIENT_MISSING` | Regenerate Prisma client | `BUILD_PIPELINE` | — |
| 9 | `services/core-api/src/membership/stipend-distribution.job.ts:12:26` | TS2305 | Module '"@prisma/client"' has no exported member 'SubscriptionStatus' | `PRISMA_CLIENT_MISSING` | Regenerate Prisma client | `BUILD_PIPELINE` | — |
| 10 | `services/core-api/src/scheduling/compliance-guard.service.ts:10:15` | TS2305 | Module '"@prisma/client"' has no exported member 'ShiftTemplate' | `PRISMA_CLIENT_MISSING` | Regenerate Prisma client | `BUILD_PIPELINE` | — |
| 11 | `services/creator-control/src/ffs.engine.ts:92:35` | TS2339 | Property 'FFS_SCORE_SAMPLE' does not exist on type '{…}' | `NATS_TOPIC_NAME_DRIFT` | Update to correct NATS topic constant name | `SINGLE_FILE` | — |
| 12 | `services/creator-control/src/ffs.engine.ts:103:37` | TS2551 | Property 'FFS_SCORE_TIER_CHANGED' does not exist. Did you mean 'FFS_TIER_CHANGED'? | `NATS_TOPIC_NAME_DRIFT` | Rename to `FFS_TIER_CHANGED` | `SINGLE_FILE` | 8 (jest creator-control) |
| 13 | `services/creator-control/src/ffs.engine.ts:115:37` | TS2339 | Property 'FFS_SCORE_PEAK' does not exist on type '{…}' | `NATS_TOPIC_NAME_DRIFT` | Update to correct NATS topic constant name | `SINGLE_FILE` | — |
| 14 | `services/guest-heat/src/fan-fervor-score.service.ts:191:35` | TS2339 | Property 'FFS_SCORED' does not exist on type '{…}' | `NATS_TOPIC_NAME_DRIFT` | Update to correct NATS topic constant name | `SINGLE_FILE` | — |
| 15 | `services/nats/topics.registry.ts:286:3` | TS1117 | An object literal cannot have multiple properties with the same name | `SENSYNC_MERGE_DUPLICATE` | Remove duplicate block (lines 285–320) | `SINGLE_FILE` | 16–25, jest 2–7,9–14 |
| 16 | `services/nats/topics.registry.ts:291:3` | TS1117 | An object literal cannot have multiple properties with the same name | `SENSYNC_MERGE_DUPLICATE` | Remove duplicate block | `SINGLE_FILE` | cleared by #15 |
| 17 | `services/nats/topics.registry.ts:296:3` | TS1117 | An object literal cannot have multiple properties with the same name | `SENSYNC_MERGE_DUPLICATE` | Remove duplicate block | `SINGLE_FILE` | cleared by #15 |
| 18 | `services/nats/topics.registry.ts:305:3` | TS1117 | An object literal cannot have multiple properties with the same name | `SENSYNC_MERGE_DUPLICATE` | Remove duplicate block | `SINGLE_FILE` | cleared by #15 |
| 19 | `services/nats/topics.registry.ts:306:3` | TS1117 | An object literal cannot have multiple properties with the same name | `SENSYNC_MERGE_DUPLICATE` | Remove duplicate block | `SINGLE_FILE` | cleared by #15 |
| 20 | `services/nats/topics.registry.ts:307:3` | TS1117 | An object literal cannot have multiple properties with the same name | `SENSYNC_MERGE_DUPLICATE` | Remove duplicate block | `SINGLE_FILE` | cleared by #15 |
| 21 | `services/nats/topics.registry.ts:308:3` | TS1117 | An object literal cannot have multiple properties with the same name | `SENSYNC_MERGE_DUPLICATE` | Remove duplicate block | `SINGLE_FILE` | cleared by #15 |
| 22 | `services/nats/topics.registry.ts:309:3` | TS1117 | An object literal cannot have multiple properties with the same name | `SENSYNC_MERGE_DUPLICATE` | Remove duplicate block | `SINGLE_FILE` | cleared by #15 |
| 23 | `services/nats/topics.registry.ts:316:3` | TS1117 | An object literal cannot have multiple properties with the same name | `SENSYNC_MERGE_DUPLICATE` | Remove duplicate block | `SINGLE_FILE` | cleared by #15 |
| 24 | `services/nats/topics.registry.ts:319:3` | TS1117 | An object literal cannot have multiple properties with the same name | `SENSYNC_MERGE_DUPLICATE` | Remove duplicate block | `SINGLE_FILE` | cleared by #15 |
| 25 | `services/nats/topics.registry.ts:320:3` | TS1117 | An object literal cannot have multiple properties with the same name | `SENSYNC_MERGE_DUPLICATE` | Remove duplicate block | `SINGLE_FILE` | cleared by #15 |

**Structural detail on SENSYNC_MERGE_DUPLICATE (errors 15–25):**  
`services/nats/topics.registry.ts` has two appended blocks (lines 285–320) that re-declare keys already canonical in the first part of the object. The first appended block (lines 285–296) re-declares `VELOCITYZONE_EVENT_ACTIVE` (orig: line 267), `SENSYNC_BIOMETRIC_DATA` (orig: line 45), and `FFS_SCORE_UPDATE` (orig: line 234) — and also introduces net-new unique keys (`VELOCITYZONE_EVENT_ENDED`, `VELOCITYZONE_RATE_LOCKED`, `SENSYNC_DEVICE_CONNECTED`, `SENSYNC_DEVICE_DISCONNECTED`) which are **only** defined in this block. The second appended block (lines 304–313) re-declares `SENSYNC_CONSENT_GRANTED/REVOKED` (orig: lines 49/50), `SENSYNC_BIOMETRIC_DATA` again (line 307, triple-duplicate), `SENSYNC_PLAUSIBILITY_REJECTED/TIER_DISABLED` (orig: lines 52/53) — and introduces additional unique keys (`SENSYNC_PURGE_REQUESTED`, `SENSYNC_PURGE_COMPLETED`, `SENSYNC_HARDWARE_CONNECTED`, `SENSYNC_HARDWARE_DISCONNECTED`). The third sub-block (lines 315–320) re-declares `FFS_SCORE_UPDATE` and `VELOCITYZONE_EVENT_ACTIVE/EVENT_ENDED`. The fix is not a wholesale delete — the net-new unique keys introduced in these blocks must be retained, deduplicated, and moved to appropriate existing sections.

**Structural detail on FFS_RENAME_DRIFT (error 4):**  
`services/ffs/src/ffs.module.ts` exports `class FfsModule`. `services/core-api/src/app.module.ts` imports `FlickerNFlameScoringModule` from that same file. The class was renamed to `FfsModule` but the import in `app.module.ts` was not updated.

**Structural detail on NATS_TOPIC_NAME_DRIFT (errors 11–14):**  
Four NATS topic constant references in production code do not exist in `topics.registry.ts`:  
- `FFS_SCORE_SAMPLE` (ffs.engine.ts:92) — no equivalent; `FFS_SCORE_UPDATE` is the closest existing key  
- `FFS_SCORE_TIER_CHANGED` (ffs.engine.ts:103) — TS suggests `FFS_TIER_CHANGED` (canonical name confirmed at line 235)  
- `FFS_SCORE_PEAK` (ffs.engine.ts:115) — no equivalent in registry  
- `FFS_SCORED` (fan-fervor-score.service.ts:191) — no equivalent; `FFS_SCORE_UPDATE` is the closest  

These appear to be pre-rename topic names that survived the FFS migration. The correct canonical mappings require a human to confirm intent before fixing (see §8).

---

## 3. Lint Error Inventory

Command: `yarn lint` (`eslint 'services/**/*.ts' --max-warnings 0`) — **4 errors**, exit code 1.  
Full output written to `/tmp/lint-output.txt`.

| # | file:line:col | Rule | Description (≤80 chars) | Bucket | Proposed fix shape | Blast radius | Unblocks |
|---|---|---|---|---|---|---|---|
| L1 | `services/core-api/src/app.module.ts:29:10` | `@typescript-eslint/no-unused-vars` | 'RefundModule' is defined but never used | `UNUSED_IMPORT` | Remove unused import | `SINGLE_FILE` | — |
| L2 | `services/guest-heat/src/guest-heat.service.ts:22:8` | `@typescript-eslint/no-unused-vars` | 'OfferType' is defined but never used | `UNUSED_IMPORT` | Remove unused import | `SINGLE_FILE` | — |
| L3 | `services/zonebot-scheduler/src/creator-rate-day61.job.ts:14:10` | `@typescript-eslint/no-unused-vars` | 'randomUUID' is defined but never used | `UNUSED_VAR` | Remove unused import | `SINGLE_FILE` | — |
| L4 | `services/zonebot-scheduler/src/zonebot-scheduler.service.ts:51:45` | `@typescript-eslint/no-unused-vars` | 'forecast' is defined but never used (must match /^\_/) | `UNUSED_VAR` | Prefix with `_` or remove | `SINGLE_FILE` | — |

---

## 4. Jest Suite Failure Inventory

Command: `yarn jest --passWithNoTests` — **14 suites failed**, 17 passed, 31 total. **202 individual tests passed** (all from the 17 passing suites). **0 individual test assertions failed** — every failure is a pre-run compilation error preventing the suite from loading.  
Full output written to `/tmp/jest-output.txt`.

| # | Suite path | Failing test count | Failure mode | First error / assertion (truncated) | Depends on TSC fixes |
|---|---|---|---|---|---|
| J1 | `tests/integration/ledger-service.spec.ts` | 0 (suite won't load) | `TSC_CASCADE` | `TS2300: Duplicate identifier 'TokenOrigin'` at spec:12 & spec:15 | — (spec-only issue, not in main TSC) |
| J2 | `tests/integration/refund-disclosure.spec.ts` | 0 (suite won't load) | `TSC_CASCADE` | `TS1117: topics.registry.ts:286 duplicate VELOCITYZONE_EVENT_ACTIVE` | TSC #15 |
| J3 | `tests/integration/gateguard-service.spec.ts` | 0 (suite won't load) | `TSC_CASCADE` | `TS1117: topics.registry.ts:286 duplicate VELOCITYZONE_EVENT_ACTIVE` | TSC #15 |
| J4 | `tests/integration/bijou-session.spec.ts` | 0 (suite won't load) | `TSC_CASCADE` | `TS1117: topics.registry.ts:286 duplicate VELOCITYZONE_EVENT_ACTIVE` | TSC #15 |
| J5 | `tests/integration/purchase-hours-gate.spec.ts` | 0 (suite won't load) | `TSC_CASCADE` | `TS1117: topics.registry.ts:286 duplicate VELOCITYZONE_EVENT_ACTIVE` | TSC #15 |
| J6 | `tests/integration/immutable-audit-service.spec.ts` | 0 (suite won't load) | `TSC_CASCADE` | `TS1117: topics.registry.ts:286 duplicate VELOCITYZONE_EVENT_ACTIVE` | TSC #15 |
| J7 | `tests/integration/gateguard-scorer.spec.ts` | 0 (suite won't load) | `TSC_CASCADE` | `TS1117: topics.registry.ts:286 duplicate VELOCITYZONE_EVENT_ACTIVE` | TSC #15 |
| J8 | `tests/integration/creator-control-service.spec.ts` | 0 (suite won't load) | `TSC_CASCADE` | `TS2551: FFS_SCORE_TIER_CHANGED not found. Did you mean 'FFS_TIER_CHANGED'?` | TSC #12 |
| J9 | `tests/integration/gateguard-middleware.spec.ts` | 0 (suite won't load) | `TSC_CASCADE` | `TS1117: topics.registry.ts:286 duplicate VELOCITYZONE_EVENT_ACTIVE` | TSC #15 |
| J10 | `tests/integration/cyrano-service.spec.ts` | 0 (suite won't load) | `TSC_CASCADE` | `TS1117: topics.registry.ts:286 duplicate VELOCITYZONE_EVENT_ACTIVE` | TSC #15 |
| J11 | `tests/integration/integration-hub.spec.ts` | 0 (suite won't load) | `TSC_CASCADE` | `TS1117: topics.registry.ts:286 duplicate VELOCITYZONE_EVENT_ACTIVE` | TSC #15 |
| J12 | `tests/e2e/high-heat-cyrano-payout-flow.spec.ts` | 0 (suite won't load) | `TSC_CASCADE` | `TS1117: topics.registry.ts:286 duplicate VELOCITYZONE_EVENT_ACTIVE` | TSC #15 |
| J13 | `tests/integration/rbac-service.spec.ts` | 0 (suite won't load) | `TSC_CASCADE` | `TS1117: topics.registry.ts:286 duplicate VELOCITYZONE_EVENT_ACTIVE` | TSC #15 |
| J14 | `tests/integration/three-bucket-spend-guard.spec.ts` | 0 (suite won't load) | `TSC_CASCADE` | `TS1117: topics.registry.ts:286 duplicate VELOCITYZONE_EVENT_ACTIVE` | TSC #15 |

**Note on J1 (ledger-service.spec.ts):** This suite has a **spec-file-only** compilation issue invisible to `yarn tsc --noEmit` (because `tsconfig.json` excludes `**/*.spec.ts`). Two independent issues:
1. `TokenOrigin` is imported twice — once from `ledger.service` (which re-exports it) and once directly from `ledger.types`. TS2300 duplicate identifier.  
2. `TokenType.REGULAR` is referenced at lines 138, 155, 169+ — but `TokenType` only has `CZT`. TS2339. This is a **genuine test logic bug** (see §8).

**Note on J8 (creator-control-service.spec.ts):** Fails due to TS2551 on `FFS_SCORE_TIER_CHANGED` in the production code it imports (`ffs.engine.ts`), which is TSC error #12. Fixing TSC #12 will unblock this suite — but only if topics.registry.ts (TSC #15) is also fixed first, since that file is also in scope for this suite's compilation.

---

## 5. Bucket Roll-Up

### TSC error buckets (25 total)

| Bucket | Count | % |
|---|---|---|
| `SENSYNC_MERGE_DUPLICATE` | 11 | 44% |
| `PRISMA_CLIENT_MISSING` | 9 | 36% |
| `NATS_TOPIC_NAME_DRIFT` | 4 | 16% |
| `FFS_RENAME_DRIFT` | 1 | 4% |
| `SHOWZONE_REMOVAL_DRIFT` | 0 | 0% |
| `EXTERNAL_TYPE_MISSING` | 0 | 0% |
| `REAL_BUG` | 0 | 0% |
| `OTHER` | 0 | 0% |

### Lint error buckets (4 total)

| Bucket | Count | % |
|---|---|---|
| `UNUSED_IMPORT` | 2 | 50% |
| `UNUSED_VAR` | 2 | 50% |
| `OTHER` | 0 | 0% |

### Jest failure mode buckets (14 suites)

| Failure mode | Count | % |
|---|---|---|
| `TSC_CASCADE` | 14 | 100% |
| `RUNTIME_ASSERTION` | 0 | 0% |
| `MISSING_FIXTURE` | 0 | 0% |
| `IMPORT_ERROR` | 0 | 0% |
| `TIMEOUT` | 0 | 0% |
| `OTHER` | 0 | 0% |

---

## 6. Dependency / Unlock Graph

```
SENSYNC_MERGE_DUPLICATE (1 root fix, 11 TSC errors, single file)
  └─► Clears TSC #15–25 (11 errors)
  └─► Unblocks J2, J3, J4, J5, J6, J7, J9, J10, J11, J12, J13, J14 (12 jest suites)
  └─► topics.registry.ts compiles clean → creator-control suite (J8) also gains
       partial unblock (still needs TSC #12 fix)

PRISMA_CLIENT_MISSING (1 root fix — `yarn prisma:generate`, BUILD_PIPELINE)
  └─► Clears TSC #1–3, #5–10 (9 errors)
  └─► No direct jest suite unblocks (those suites fail due to topics.registry.ts,
       not Prisma; Bijou suites (J4) would additionally benefit)
  └─► Eliminates all TS2305 "@prisma/client" noise

NATS_TOPIC_NAME_DRIFT (4 errors, 3 files — ffs.engine.ts x3, fan-fervor-score.service.ts x1)
  └─► No prerequisite fixes (can be done independently)
  └─► Fixes #11, #12, #13, #14
  └─► Fixing #12 (FFS_SCORE_TIER_CHANGED → FFS_TIER_CHANGED) + SENSYNC fix together
       fully unblocks J8 (creator-control-service)
  └─► #11, #13, #14 have no equivalent topic in the registry — correct names TBD
       (requires human confirmation; see §8)

FFS_RENAME_DRIFT (1 error, 1 file — app.module.ts)
  └─► No prerequisite fixes (can be done independently)
  └─► Fixes #4; import `FfsModule` instead of `FlickerNFlameScoringModule`
  └─► No direct jest suite unblocks (none of the failing suites import app.module.ts
       in their compilation chain)

LINT errors (4, all SINGLE_FILE)
  └─► All independent; no prerequisites; no jest impact
  └─► L1 (app.module.ts RefundModule) co-located with TSC #4 — same file, same PR candidate

JEST J1 (ledger-service.spec.ts — spec-only issues)
  └─► Duplicate TokenOrigin import: fix independently within spec file
  └─► TokenType.REGULAR bug: REAL_BUG requiring human review (see §8)
  └─► Not gated on any of the 25 main TSC fixes
```

**Bottom line:**  
- Fixing `SENSYNC_MERGE_DUPLICATE` (1 edit to `topics.registry.ts`) clears 44% of TSC errors and unblocks 12/14 jest suites.  
- Fixing `PRISMA_CLIENT_MISSING` (run `yarn prisma:generate` as a build step) clears 36% of TSC errors.  
- Together, those two fixes clear 20 of 25 TSC errors and 12+ of 14 jest suites.  
- The remaining 5 TSC errors require targeted source edits (4× NATS topic name, 1× module import rename).

---

## 7. Recommended Fix Order — Phase 3b Bucket Plan

> **3b-1: `SENSYNC_MERGE_DUPLICATE`** — 11 TSC errors — Risk: **LOW** — Blast radius: `SINGLE_FILE` (`topics.registry.ts`)  
> Rationale: Highest leverage (11 errors, 12 jest suites). Single-file edit. The duplicate block (lines 285–320) must be carefully reconciled — net-new unique keys introduced in those lines (`VELOCITYZONE_EVENT_ENDED`, `VELOCITYZONE_RATE_LOCKED`, `SENSYNC_DEVICE_CONNECTED`, `SENSYNC_DEVICE_DISCONNECTED`, `SENSYNC_PURGE_REQUESTED`, `SENSYNC_PURGE_COMPLETED`, `SENSYNC_HARDWARE_CONNECTED`, `SENSYNC_HARDWARE_DISCONNECTED`, `CYRANO_FFS_FRAME_CONSUMED`) must be retained and placed in the correct existing sections, not deleted wholesale. This is `NATS: / GOV:` scoped (topics.registry is a NATS-fabric file). **Not FIZ-scoped.**

> **3b-2: `PRISMA_CLIENT_MISSING`** — 9 TSC errors — Risk: **LOW** — Blast radius: `BUILD_PIPELINE`  
> Rationale: Run `yarn prisma:generate` as a CI step (or pre-commit hook). No source code changes required. Clears 9 TSC errors across Bijou, membership, and scheduling services. This should be a CI/build configuration fix, not a code fix. **INFRA: scoped.** Not FIZ-scoped (schema is not being changed).

> **3b-3: `NATS_TOPIC_NAME_DRIFT`** — 4 TSC errors — Risk: **MED** — Blast radius: `MULTI_FILE` (2 source files, `ffs.engine.ts` + `fan-fervor-score.service.ts`)  
> Rationale: Requires human confirmation of correct topic names for `FFS_SCORE_SAMPLE`, `FFS_SCORE_PEAK`, and `FFS_SCORED` before fixing. `FFS_SCORE_TIER_CHANGED → FFS_TIER_CHANGED` is unambiguous (TS2551 suggests it directly). The other three have no clear equivalent in the registry — if the correct topic doesn't exist, it needs to be added to the registry first (which must happen in a separate PR from the registry dedup in 3b-1). Dependency: 3b-1 must land first so `topics.registry.ts` compiles cleanly before this PR is validated. **NATS: scoped.** Not FIZ-scoped.

> **3b-4: `FFS_RENAME_DRIFT`** — 1 TSC error — Risk: **LOW** — Blast radius: `SINGLE_FILE` (`app.module.ts`)  
> Rationale: Trivial rename of import: `FlickerNFlameScoringModule` → `FfsModule`. Can be batched with lint fixes L1 and L4 (same or adjacent file). No prerequisites. **CHORE: scoped.** Not FIZ-scoped.

> **3b-5: Lint cleanup** — 4 lint errors — Risk: **LOW** — Blast radius: `SINGLE_FILE` ×4  
> Rationale: All four are unused variable/import removals. Two in the same file as other fixes (app.module.ts and creator-rate-day61.job.ts). Can batch with 3b-4. **CHORE: scoped.**

> **3b-6: Spec-only fixes (J1 — ledger-service.spec.ts)** — 1 suite — Risk: **MED** — Blast radius: `SINGLE_FILE` (test spec)  
> Rationale: Two issues: (a) duplicate TokenOrigin import — safe removal; (b) `TokenType.REGULAR` not existing — requires human review before fix (see §8). Only after human confirms intent should the spec be corrected. **CHORE: scoped.** Not FIZ-scoped (test file).

---

## 8. Risks & Open Questions

### 8.1 REAL_BUG: `TokenType.REGULAR` in ledger-service.spec.ts

`tests/integration/ledger-service.spec.ts` references `TokenType.REGULAR` at lines 138, 155, 169, 178, 192, 214, 236, 237 — but `TokenType` in `services/core-api/src/finance/ledger.service.ts` defines only `CZT`. This is **not a type drift** — `REGULAR` has never existed. Either:
- The test was written against an older data model and the correct value is `CZT`; or  
- A `REGULAR` variant was intended to be added to the enum and wasn't.  
This cannot be resolved without human confirmation of the token taxonomy. **Flag for human review before Phase 3b-6.**

### 8.2 NATS topic names for FFS_SCORE_SAMPLE, FFS_SCORE_PEAK, FFS_SCORED

Three topic constants used in production code do not exist in the registry. The registry has `FFS_SCORE_UPDATE` and `FFS_TIER_CHANGED` as canonical names. The question is whether:
- These are simply the old names that should have been updated to `FFS_SCORE_UPDATE` / `FFS_TIER_CHANGED` / `FFS_PEAK`; or  
- They represent distinct, separate events that should be added to the registry.  
Until confirmed, 3b-3 is blocked on this question. `FFS_SCORE_TIER_CHANGED → FFS_TIER_CHANGED` can proceed independently.

### 8.3 SenSync unique keys in the duplicate block

The duplicate block (lines 285–320) is NOT a wholesale copy — it mixes duplicate keys with net-new ones. A naïve "delete the block" would silently remove `VELOCITYZONE_EVENT_ENDED`, `VELOCITYZONE_RATE_LOCKED`, and all `SENSYNC_PURGE_*` / `SENSYNC_HARDWARE_*` keys from the registry. Any service that publishes or subscribes to those topics would break. **The 3b-1 PR author must diff the block against the canonical section and migrate unique keys to the correct location before deleting the duplicate entries.**

### 8.4 Errors masked behind earlier failures

The TSC reported exactly 25 errors. However, because `topics.registry.ts` fails to compile (TS1117 on duplicate keys), TypeScript **may** be suppressing further errors in files that import `NATS_TOPICS`. Once the registry compiles cleanly, additional consumers of stale topic names may surface. The actual error count after 3b-1 may be slightly lower than 25 (some errors might disappear) or slightly higher (masked errors emerge). Delta must be reported in Phase 3c scoping.

### 8.5 Prisma client is stale, not absent

The `.prisma/client/` directory exists and exports `PrismaClient = any`. This means **no import of `PrismaClient` itself causes a type error** (it's `any`), but all enum and model types imported by name cause TS2305. After `yarn prisma:generate`, the actual number of Prisma-related errors could differ from 9 if the schema is missing definitions that are referenced in code but not yet added to schema.prisma. Recommend running `yarn tsc --noEmit` immediately after generation and diffing against the 25-error baseline.

### 8.6 `RefundModule` lint error (L1) co-located with TSC #4 (FFS_RENAME_DRIFT)

`app.module.ts` line 29 has an unused `RefundModule` import, and line 30 has the stale `FlickerNFlameScoringModule` import. These are in the same file and should land in the same PR (3b-4/3b-5). However, it's worth checking whether `RefundModule` was intentionally removed from the NestJS DI graph or was accidentally dropped — if dropped accidentally, the correct fix is to re-add it to `@Module({ imports: [...] })`, not remove the import.

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
- No modifications to `services/nats/topics.registry.ts`, `tsconfig.json`, `jest.config.js`, `.eslintrc.js`, CI workflows, or `prisma/migrations/`.
- No rebase, force-push, or `--no-verify`.

---

## Appendix: Commands Run

```
node --version          → v20.20.2
yarn --version          → 1.22.22
ls node_modules/.prisma/client   → present (default.d.ts, default.js, edge.d.ts, edge.js, index-browser.js, index.d.ts, index.js, wasm.d.ts, wasm.js)
ls node_modules/@prisma/client/index.d.ts → present
yarn install --frozen-lockfile   → Already up-to-date. Done in 0.45s.
yarn tsc --noEmit        → 25 errors (exit 2) — logged to /tmp/tsc-output.txt
yarn lint                → 4 errors (exit 1) — logged to /tmp/lint-output.txt
yarn jest --passWithNoTests → 14 suites failed, 17 passed, 202 tests passed (exit 1) — logged to /tmp/jest-output.txt
node PROGRAM_CONTROL/ship-gate-verifier.ts → ERR_UNKNOWN_FILE_EXTENSION (.ts) — not a ts-node environment
```
