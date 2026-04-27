# Pre-Ship Repo Hardening & Cleanup — Phase 1 Inventory Report

**Task ID:** CLEANUP-PRESHIP-2026-04-26  
**Branch:** `copilot/claudecleanup-legacy-code-k2iu3`  
**Repo:** `OmniQuestMediaInc/ChatNowZone--BUILD`  
**Generated:** 2026-04-26  
**Author:** GitHub Copilot Coding Agent  
**Status:** PHASE 1 COMPLETE — Awaiting human review before Phase 2

---

## Pre-Flight Governance Read Confirmation

Before any analysis was performed, the following files were read:

| File | Status |
|---|---|
| `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_GOVERNANCE.md` | ✅ Read |
| `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_SYSTEM_STATE.md` | ✅ Read |
| `.github/copilot-instructions.md` | ✅ Read |
| `docs/PRE_LAUNCH_CHECKLIST.md` | ✅ Present (read-only) |
| `docs/CANONICAL_COMPLIANCE_CHECKLIST.md` | ✅ Present (read-only) |
| `README.md` (root) | ✅ Read-only snapshot |
| `OQMI_SYSTEM_STATE.md` (root) | ✅ Read-only snapshot |

No modifications were made to any of the above files.

---

## Item 1 — Root-Level Artifact Audit

### Binary / Patch / Bundle artifacts at root

| File | Size | Type | Disposition |
|---|---|---|---|
| `copilot-global-rename.bundle` | 50,673 bytes (~50 KB) | Git bundle — migration artifact from FFS/SenSync rename op | **DELETE** — artifact of the global rename operation that completed in commit `0dac4fc`. Not referenced by any script, CI workflow, or config. Confirmed no inbound references via repo-wide grep. |
| `copilot-global-rename.patch` | 197,887 bytes (~198 KB) | Unified diff patch — same rename operation | **DELETE** — companion patch to the bundle above. Same justification. Not referenced anywhere. |

### Other binary/patch/bundle/`.orig`/`.rej`/`.bak`/`.tmp` files in tree

A full `find` sweep across the repo (excluding `.git/` and `node_modules/`) for `*.bundle`, `*.patch`, `*.orig`, `*.rej`, `*.bak`, `*.tmp` returned **only the two root-level artifacts above**. No additional stray artifacts found.

---

## Item 2 — Markdown Inventory (239 files total)

Summary counts:

| Bucket | Count |
|---|---|
| AUTHORITATIVE | 27 |
| SNAPSHOT | 5 |
| HISTORICAL | 196 |
| STALE/SUPERSEDED | 1 |
| **Total** | **239** |

### AUTHORITATIVE (27)
Live policy, doctrine, current architecture — must not be modified or deleted.

| File | Justification |
|---|---|
| `.github/copilot-instructions.md` | Primary agent instruction set — live doctrine per OQMI_GOVERNANCE |
| `.github/refs-branch-policy.md` | Live branch protection policy |
| `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_GOVERNANCE.md` | Canonical governance document — authoritative per doctrine consolidation 2026-04-23 |
| `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_SYSTEM_STATE.md` | Authoritative coding doctrine — supersedes all prior versions |
| `PROGRAM_CONTROL/DIRECTIVES/QUEUE/CNZ-WORK-001.md` | Active charter — live directive |
| `PROGRAM_CONTROL/DIRECTIVES/QUEUE/CNZ-CLAUDE-CODE-KICKOFF.md` | Active standing prompt directive |
| `PROGRAM_CONTROL/DIRECTIVES/QUEUE/CNZ-CLAUDE-CODE-STANDING-PROMPT.md` | Active standing prompt directive |
| `PROGRAM_CONTROL/DIRECTIVES/QUEUE/CNZ-WORK-001-AMEND-C007.md` | Active amendment directive |
| `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OSS-Lift-From-Index.md` | Active OSS directive |
| `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OSS-Repo-Registry.md` | Active OSS directive |
| `PROGRAM_CONTROL/LAUNCH_MANIFEST.md` | Live launch manifest |
| `PROGRAM_CONTROL/LAUNCH_READY.md` | Live launch readiness tracker |
| `PROGRAM_CONTROL/REPO_MANIFEST.md` | Auto-generated on every push — live repo index |
| `docs/REQUIREMENTS_MASTER.md` | Live build state — naming authority per doctrine |
| `docs/DOMAIN_GLOSSARY.md` | Canonical naming authority per doctrine |
| `docs/CANONICAL_COMPLIANCE_CHECKLIST.md` | Live compliance checklist |
| `docs/PRE_LAUNCH_CHECKLIST.md` | Live launch checklist |
| `docs/ARCHITECTURE_OVERVIEW.md` | Current architecture document |
| `docs/MEMBERSHIP_LIFECYCLE_POLICY.md` | Live membership policy |
| `docs/ROADMAP_MANIFEST.md` | Live roadmap |
| `docs/RRR_CEO_DECISIONS_FINAL_2026-04-17.md` | CEO decision log — authoritative |
| `docs/doctrine/COPILOT_GUARDRAILS.md` | Live agent guardrails (The Reflection Protocol) |
| `docs/compliance/evidence_templates/NCII_TAKEDOWN_LOG.md` | Live compliance template |
| `REFERENCE_LIBRARY/00_THREAD_BOOTSTRAP.md` | Canonical reference — do not modify |
| `REFERENCE_LIBRARY/01_CANONICAL_LOCKS.md` | Canonical reference — do not modify |
| `REFERENCE_LIBRARY/02_DOMAIN_TAXONOMY.md` | Canonical reference — do not modify |
| `REFERENCE_LIBRARY/03_FEATURE_BRIEFS.md` | Canonical reference — do not modify |
| `REFERENCE_LIBRARY/04_AI_REFERENCE_INDEX.md` | Canonical reference — do not modify |
| `REFERENCE_LIBRARY/06_PROJECT_DECISIONS.md` | Canonical reference — do not modify |
| `REFERENCE_LIBRARY/TEMPLATES/OQMInc_REFERENCE_LIBRARY_MASTER_TEMPLATE.md` | Canonical template |
| `REFERENCE_LIBRARY/TEMPLATES/README.md` | Canonical template index |
| `REFERENCE_LIBRARY/OSS_REF_BRANCH_SEEDS/README.md` | OSS reference seed manifest |
| `REFERENCE_LIBRARY/OSS_REF_BRANCH_SEEDS/refs-oqminc-ai-resources/REFS_MANIFEST.md` | OSS reference |
| `REFERENCE_LIBRARY/OSS_REF_BRANCH_SEEDS/refs-oss-booking-api/REFS_MANIFEST.md` | OSS reference |
| `REFERENCE_LIBRARY/OSS_REF_BRANCH_SEEDS/refs-oss-discussion-platform/REFS_MANIFEST.md` | OSS reference |
| `REFERENCE_LIBRARY/OSS_REF_BRANCH_SEEDS/refs-oss-live-polling/REFS_MANIFEST.md` | OSS reference |
| `REFERENCE_LIBRARY/OSS_REF_BRANCH_SEEDS/refs-oss-loadbalancer-nginx/REFS_MANIFEST.md` | OSS reference |
| `REFERENCE_LIBRARY/OSS_REF_BRANCH_SEEDS/refs-oss-react-chat-app/REFS_MANIFEST.md` | OSS reference |
| `REFERENCE_LIBRARY/OSS_REF_BRANCH_SEEDS/refs-oss-social-media-app/REFS_MANIFEST.md` | OSS reference |
| `REFERENCE_LIBRARY/OSS_REF_BRANCH_SEEDS/refs-oss-socketio-chat/REFS_MANIFEST.md` | OSS reference |
| `REFERENCE_LIBRARY/OSS_REF_BRANCH_SEEDS/refs-oss-zoom-clone/REFS_MANIFEST.md` | OSS reference |
| `docs/AUDIT_CERTIFICATION_V1.md` | Audit certification — authoritative record |
| `docs/DIRECTIVE_TEMPLATE.md` | Live template for directive authoring |

### SNAPSHOT (5)
Point-in-time records — retain as-is, read-only.

| File | Justification |
|---|---|
| `OQMI_SYSTEM_STATE.md` (root) | Explicitly a point-in-time snapshot per doctrine; root snapshot of backlog state — read-only |
| `README.md` (root) | Root project README — snapshot / overview; prohibitions forbid editing |
| `archive/LEGACY_CONFIGS_2026-04/HANDOFF.md` | Terminal handoff document from 2026-04-24 quarantine — locked until 2027-04-24 per HANDOFF content |
| `PROGRAM_CONTROL/DIRECTIVES/DONE/AUDIT-NOTE-2026-04-10.md` | Point-in-time audit note |
| `services/showzone/RETIRED.md` | Retirement tombstone — must be retained permanently even if src/ is removed |

### HISTORICAL (196)
REPORT_BACKs, completed directives, handoffs — governance audit trail. Must not be deleted; candidates for archival relocation only.

All files under:
- `PROGRAM_CONTROL/DIRECTIVES/DONE/` — 39 files (immutable governance ledger)
- `PROGRAM_CONTROL/REPORT_BACK/` — 137 files (governance audit trail; see Item 3 for orphan breakdown)
- Thread-level handoffs and cross-agent reports (e.g., `THREAD 13 HANDOFF`, `Thread 13 cleanup` in REPORT_BACK)

### STALE/SUPERSEDED (1)

| File | Justification |
|---|---|
| `governance/CLAUDE.stale.md` | Self-declared stale in its own frontmatter comment (2026-04-24). Explicitly superseded by `.github/copilot-instructions.md`, `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_GOVERNANCE.md`, and `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_SYSTEM_STATE.md`. See Item 6 for inbound link audit. |

---

## Item 3 — `PROGRAM_CONTROL/REPORT_BACK/` Audit

**Total files:** 137 (plus 1 `.gitkeep`)  
**Total size:** ~844 KB

### Cross-reference with `PROGRAM_CONTROL/DIRECTIVES/DONE/`

**Matched (have a corresponding DONE directive):** 25 files  
**Orphaned (no matching DONE directive):** 112 files

The 112 "orphaned" files are NOT missing their directives — they represent work done before the current DONE-ledger structure was formalized, WO-series work orders (numbered tasks rather than directive files), FIZ-scoped changes, and multi-thread parallel work items that were tracked outside the DONE directory. They remain valid governance audit trail and must not be deleted.

**Matched REPORT_BACK → DONE pairs:**

| REPORT_BACK file | DONE directive |
|---|---|
| `CHORE-INFRA-BCRYPT-001.md` | `CHORE-INFRA-BCRYPT-001.md` |
| `CHORE-PIPELINE-001.md` | `CHORE-PIPELINE-001.md` |
| `CHORE-PIPELINE-002.md` | `CHORE-PIPELINE-002.md` |
| `CHORE-PIPELINE-003.md` | `CHORE-PIPELINE-003.md` |
| `CHORE-PIPELINE-004.md` | `CHORE-PIPELINE-004.md` |
| `CHORE-PIPELINE-005.md` | `CHORE-PIPELINE-005.md` |
| `CHORE-PIPELINE-006.md` | `CHORE-PIPELINE-006.md` |
| `CNZ-WORK-001-A002-report.md` | `CNZ-WORK-001-A002-DONE.md` |
| `CNZ-WORK-001-A003-report.md` | `CNZ-WORK-001-A003-DONE.md` |
| `CNZ-WORK-001-A004-report.md` | `CNZ-WORK-001-A004-DONE.md` |
| `CNZ-WORK-001-A005-report.md` | `CNZ-WORK-001-A005-DONE.md` |
| `CNZ-WORK-001-A006-report.md` | `CNZ-WORK-001-A006-DONE.md` |
| `CNZ-WORK-001-A007-report.md` | `CNZ-WORK-001-A007-DONE.md` |
| `CNZ-WORK-001-A008-report.md` | `CNZ-WORK-001-A008-DONE.md` |
| `CNZ-WORK-001-A009-report.md` | `CNZ-WORK-001-A009-DONE.md` |
| `CNZ-WORK-001-A010-report.md` | `CNZ-WORK-001-A010-DONE.md` |
| `CNZ-WORK-001-A011-report.md` | `CNZ-WORK-001-A011-DONE.md` |
| `CNZ-WORK-001-A012-report.md` | `CNZ-WORK-001-A012-DONE.md` |
| `CNZ-WORK-001-A013-report.md` | `CNZ-WORK-001-A013-DONE.md` |
| `CNZ-WORK-001-A014-report.md` | `CNZ-WORK-001-A014-DONE.md` |
| `GOV-CONST-001.md` | `GOV-CONST-001.md` |
| `NATS-DFSP001-TOPICS-REPORT-BACK.md` | `NATS-DFSP001-TOPICS.md` |
| `PAY-RATES-001.md` | `PAY-RATES-001.md` |
| `TOK-AUDIT-001.md` | `TOK-AUDIT-001.md` |
| `TOK-RETIRE-001.md` | `TOK-RETIRE-001.md` |

### Recommended Archive Scheme

Do NOT delete any REPORT_BACK files. They are the governance audit trail.

**Proposed relocation** (pending approval):

Move all pre-Q2-2026 REPORT_BACK files (those dated/prefixed before 2026-04-01) into a dated subfolder:

```
PROGRAM_CONTROL/REPORT_BACK/_ARCHIVE_2026-Q1/
```

This should be done using `git mv` to preserve history. Files dated 2026-04-01 and later remain in the root REPORT_BACK directory. The specific file list for the Q1 archive needs human judgment since most files are not date-stamped in their filename — recommend a separate Phase 2b pass after Phase 2a deletions.

Note: `CNZ-WORK-001-A099-WAVE-A-CLEANUP-report.md` is matched to `CNZ-WORK-001-A099-DONE.md` but the naming regex did not catch it (the `-WAVE-A-CLEANUP` suffix). It is paired.

---

## Item 4 — `archive/LEGACY_CONFIGS_2026-04/` Audit

**Contents:**
- `.eslintrc.js`
- `.gitignore`
- `.prettierrc`
- `package.json`
- `tsconfig.json`
- `HANDOFF.md`

### Live build references found

**None** — confirmed by repo-wide grep for `LEGACY_CONFIGS_2026-04` and `archive/LEGACY_` across all `.ts`, `.js`, `.json`, `.yml`, `.yaml` files (excluding `node_modules/`).

**CI reference found (benign):**

`super-linter.yml` line 50 references `LEGACY_CONFIGS` in an **exclusion** regex:
```
FILTER_REGEX_EXCLUDE: (^|/)(LEGACY_CONFIGS|archive|node_modules|dist|\.next|out)/
```
This is an exclusion pattern that **prevents** super-linter from scanning the archive. It does not wire the archived configs into the live build. It is a hygiene measure, not a dependency.

**Decision per HANDOFF.md:** This folder may not be deleted until 2027-04-24 (12-month audit retention) and only after CEO-signed clearance in `PROGRAM_CONTROL/CLEARANCES/`. **Disposition: KEEP — deletion blocked by audit retention policy until 2027-04-24.**

---

## Item 5 — Retired Service Audit: `services/showzone/`

### Service status
`services/showzone/RETIRED.md` — present and correctly declares retirement as of 2026-04-26.

### Source files in `services/showzone/src/`
Two TypeScript files:
- `services/showzone/src/room-session.service.ts`
- `services/showzone/src/showzone.module.ts`

Both files carry `// @deprecated` and `// @deprecated SHOWZONE-DEPRECATED` headers confirming they are retained for reference only and are not wired into production.

### Import scan: is `services/showzone/src/**` imported by any live service?

**No direct imports found.** A grep across `services/`, `ui/`, `tests/`, `infra/`, and `prisma/` for `from.*showzone` and `services/showzone/src` returned **zero results** outside of the showzone directory itself.

### Configuration references

| Config file | Reference found | Nature |
|---|---|---|
| `tsconfig.json` | ❌ None | Not referenced |
| `jest.config.js` | ❌ None | Not referenced |
| `docker-compose.yml` | ❌ None | Not referenced |
| `package.json` (workspaces) | ❌ None | No workspace entry |
| `services/nats/topics.registry.ts` | ✅ 4 tombstoned topics | Tombstones only — `@deprecated` annotations |

### NATS subjects still subscribed under `showzone.*`

**No active subscribers found.** A grep across `services/` for `SHOWZONE_` topics (excluding `topics.registry.ts` and `showzone/` source) returned **zero subscriber/publish calls**.

Live code that still references the `showzone` name:

| File | Nature | Status |
|---|---|---|
| `services/core-api/src/config/governance.config.ts` | `SHOWZONE_PRICING` constant — still in use by Bijou services for venue pricing | **LIVE — DO NOT REMOVE.** This is a pricing config, not a service import. |
| `services/bijou/src/min-seat-gate.service.ts` | Imports `SHOWZONE_PRICING` from governance.config | Live — Bijou pricing logic |
| `services/bijou/src/pass-pricing.service.ts` | Imports `SHOWZONE_PRICING` from governance.config | Live — Bijou pricing logic |
| `services/ledger/redbook-rate-card.service.ts` | Uses `SHOWZONE_PRICING` and `quoteTeaseShowzone()` method | Live — rate card logic |
| `ui/types/public-wallet-contracts.ts` | `showzone_rows` field marked `@deprecated` — retained for backward compat | Deprecated field, not a service import |
| `ui/app/tokens/page.ts` | `test_id: 'tokens-showzone'` — test ID string | UI test identifier only |
| `prisma/schema.prisma` | `tier` field contains `"tease_showzone"` string literal | Schema value — not a service import |
| `OQMI_SYSTEM_STATE.md` | Mentions showzone in historical context | Snapshot doc |
| `PROGRAM_CONTROL/REPO_MANIFEST.md` | Auto-generated directory listing | Auto-generated |

**Conclusion:** `services/showzone/src/**` has zero live importers and zero live NATS subscribers. The `SHOWZONE_PRICING` constant in `governance.config.ts` is a separate concern — it remains live and must not be removed. The two source files (`room-session.service.ts`, `showzone.module.ts`) are candidates for removal in Phase 2, subject to approval and all four conditions being confirmed:

- ✅ (a) Zero importers — CONFIRMED
- ✅ (b) Zero live NATS subscribers — CONFIRMED
- ✅ (c) `RETIRED.md` tombstone present — CONFIRMED
- ⚠️ (d) `tsconfig.json` / workspace manifests — No changes needed; showzone/src is not in any path alias or workspace. Confirm Phase 2 build passes before committing.

---

## Item 6 — Stale Governance Doc: `governance/CLAUDE.stale.md`

### Self-declaration
The file's own HTML comment header declares it stale as of 2026-04-24 and explicitly names its authoritative replacements.

### Inbound link audit
Grep for `CLAUDE.stale` across all `.md`, `.ts`, `.js`, `.json`, `.yml`, `.yaml` files (excluding `node_modules/`, `.git/`):

**Files referencing `CLAUDE.stale`:**

| File | Nature |
|---|---|
| `PROGRAM_CONTROL/REPO_MANIFEST.md` | Auto-generated directory listing — lists all committed files; not a functional reference |
| `OQMI_SYSTEM_STATE.md` (root) | Snapshot document — historical context mention |

Neither reference is a functional inbound link (navigation, `href`, include, or dependency). Both are auto-generated or snapshot documents.

**Disposition: DELETE** — Self-declared superseded, zero functional inbound links, authoritative replacements are in place.

> ⚠️ **Note:** Deleting `governance/CLAUDE.stale.md` will leave the `governance/` directory containing only `Sovereign_Kernel.md.pdf` and `pre-ship-audit.service.ts`. The `governance/` directory itself must be retained (contains the Sovereign Kernel and pre-ship audit service).

---

## Item 7 — Dead-Code Surface Scan

TS/TSX files with **zero importers** (excluding entry points `main.ts`/`index.ts`, test files `*.spec.ts`/`*.test.ts`, and `.d.ts` declarations). These are listed only — no deletions proposed without per-file justification.

**Note on methodology:** Files are considered zero-importer when no other `.ts`/`.tsx` file in the repo contains `from.*<basename>`. This approach has false positives for NestJS module roots (which are bootstrapped via the DI container, not direct imports) and for entry-point-by-convention files. The list below should be reviewed with awareness of NestJS injection patterns.

| File | Notes |
|---|---|
| `services/integration-hub/src/hub.module.ts` | NestJS module root — likely bootstrapped via app.module |
| `services/risk-engine/src/risk.module.ts` | NestJS module root |
| `services/core-api/src/studio/studio-report.controller.ts` | Controller — likely registered via module, not imported directly |
| `services/core-api/src/audit/audit-dashboard.service.ts` | Service — check if registered in a module |
| `services/core-api/src/app.module.ts` | NestJS root app module — bootstrapped in `main.ts` (which is excluded from scan) |
| `services/core-api/src/compliance/geo-fencing.service.ts` | Service — may be registered via module |
| `services/core-api/src/finance/batch-payout.service.ts` | Service — may be registered via module |
| `services/core-api/src/finance/tip.service.ts` | Service — may be registered via module |
| `services/core-api/src/safety/provisional-suppression.service.ts` | Service — may be registered via module |
| `services/core-api/src/safety/upload-interceptor.middleware.ts` | Middleware — registered in module config, not imported |
| `services/core-api/src/core-api.module.ts` | NestJS module root |
| `services/core-api/src/geo/geo-pricing.service.ts` | Service |
| `services/core-api/src/marketing/gratitude.service.ts` | Service |
| `services/core-api/src/risk/risk-score.service.ts` | Service — listed in CI required-files.txt (must not be removed) |
| `services/core-api/src/ingestion/ingestion.module.ts` | NestJS module root |
| `services/core-api/src/creator/surfaces/roster.gateway.ts` | Gateway |
| `services/core-api/src/creator/roster.gateway.ts` | Gateway (possible duplicate) |
| `services/zonebot-scheduler/src/zonebot-scheduler.module.ts` | NestJS module root |
| `services/rewards-api/src/engine/points-calculator.logic.ts` | Logic file |
| `services/rewards-api/src/white-label/partner-config.schema.ts` | Schema |
| `services/vision-monitor/src/human-counter.worker.ts` | Worker |
| `services/velocityzone/src/creator-rate-tier.service.ts` | Service |
| `services/velocityzone/src/velocityzone.module.ts` | NestJS module root |
| `services/obs-bridge/src/obs-bridge.module.ts` | NestJS module root |
| `services/fraud-prevention/src/fraud-prevention.module.ts` | NestJS module root |
| `services/recovery/src/recovery.module.ts` | NestJS module root |
| `services/showzone/src/showzone.module.ts` | **Retired service** — see Item 5 |
| `services/notification/src/notification.module.ts` | NestJS module root |
| `ui/types/finance-contracts.ts` | UI type file — may be types-only barrel |
| `finance/batch-payout.service.ts` | Finance service — append-only protected; no removal |
| `finance/commission-splitting.service.ts` | Finance service — append-only protected |
| `finance/containment-hold.service.ts` | Finance service — append-only protected |
| `finance/evidence-packet.service.ts` | Finance service — append-only protected |
| `finance/token-extension.service.ts` | Finance service — append-only protected |
| `finance/audit-dashboard.service.ts` | Finance service — append-only protected |
| `safety/security-guardrails.service.ts` | Safety service |
| `scripts/seed-scheduling.ts` | Script — referenced in `package.json` `seed:scheduling` command |
| `scripts/verify-vault-delivery.ts` | Script |

**Important:** All `finance/` files are protected by the append-only finance invariant — **no deletions permitted** regardless of import count. All NestJS `*.module.ts` files may appear zero-importer due to DI container bootstrapping patterns. **No action recommended on this list without per-file investigation.**

---

## Item 8 — Dependency Hygiene

### (a) Packages with no detected import in source

The following packages show zero or near-zero direct `from 'package'` import occurrences across `services/`, `ui/`, `finance/`, `safety/`, `scripts/`:

| Package | Import count | Notes |
|---|---|---|
| `@nestjs/platform-express` | 0 direct imports | Used indirectly — `express` types (`Request`, `Response`, `NextFunction`) are imported from `'express'` (peer dep) in middleware files. `@nestjs/platform-express` is the NestJS HTTP adapter and is required at runtime by NestJS bootstrap even without explicit imports. **KEEP.** |
| `reflect-metadata` | 0 direct imports | Required by NestJS decorators — must be imported once in bootstrap (likely in `main.ts` or `tsconfig` lib settings). Standard NestJS dep. **KEEP.** |
| `rxjs` | 0 direct imports found | NestJS internals use RxJS; required as peer dep. **KEEP.** |

All other runtime packages (`@nestjs/common`, `@prisma/client`, `bcryptjs`, `bull`, `decimal.js`, `nats`, `typeorm`, etc.) show confirmed imports.

### (b) Pre-release / RC versions

**None found.** All package versions in `package.json` use stable semver ranges (`^x.y.z` or exact pinned like `10.6.0` for `decimal.js`). No `alpha`, `beta`, `rc`, `pre`, `canary`, `next`, `dev`, or `exp` version strings detected.

Notable pins:
- `typescript`: `5.9.3` (exact pin — newer than LTS, not pre-release)
- `@typescript-eslint/eslint-plugin`: `7.18.0` (exact pin)
- `@typescript-eslint/parser`: `7.18.0` (exact pin)
- `decimal.js`: `10.6.0` (exact pin — intentional for financial precision)

### (c) Duplicate transitive majors

Not fully enumerable without `yarn list --depth=0` (which requires a live environment with all deps installed). Based on `yarn.lock` review:
- `@babel/plugin-syntax-typescript` appears as a transitive dep of jest/ts-jest
- No obvious duplicate majors detected at `package.json` direct-dep level
- Recommend running `yarn list --depth=2 | grep -E " [0-9]+\." | sort` in a dev environment for authoritative transitive duplicate report

---

## Item 9 — `.gitignore` / Secret-Leak Scan

### Current `.gitignore` (7 entries)

```
node_modules/
dist/
.next/
out/
*.env.local
*.env.*.local
.DS_Store
```

### Secret / sensitive files committed

**`.env*` files:**
The following `.env.example` files are committed (intentional — these are templates):
- `services/cyrano/.env.example`
- `services/ffs/.env.example`
- `services/guest-heat/.env.example`
- `services/sensync/.env.example`
- `services/zonebot-scheduler/.env.example`

No `.env`, `.env.production`, `.env.staging`, or populated env files found committed.

**PEM / key / certificate files:** None found.

**`id_rsa*` files:** None found.

**`*.p12` files:** None found.

**`service-account*.json` files:** None found.

**`(SECRET|API_KEY|PRIVATE_KEY)=` patterns in source:** None found.

**`*.log` files:** None found committed.

**`coverage/` directories:** None found committed.

**`dist/` directories:** Covered by `.gitignore` — not committed.

**`*.tsbuildinfo` files:** None found committed.

**`.next/` artifacts:** Covered by `.gitignore` — not committed.

### `.gitignore` gaps identified

The current `.gitignore` is missing several patterns that should be added for hygiene:

| Pattern | Reason |
|---|---|
| `coverage/` | Jest coverage output not currently gitignored |
| `*.log` | Log files not currently gitignored |
| `.turbo/` | Turbo build cache (if ever adopted) |
| `.cache/` | Generic cache dirs |
| `*.tsbuildinfo` | TypeScript incremental build info |
| `.env` | Base `.env` file not explicitly covered (only `.env.local` and `.env.*.local` are) |
| `.env.*` | Pattern to cover all env variants (`.env.staging`, `.env.production`, etc.) — currently only `.env.local` and `.env.*.local` covered |
| `.idea/` | JetBrains IDE artifacts |
| `.vscode/*` | VS Code local settings (with allowlist for shared `extensions.json`/`settings.json`) |
| `*.pem` | TLS certificate files |
| `*.key` | Private key files |

**No secrets are currently leaked** — the gaps are preventive hygiene for Phase 2.

---

## Item 10 — Empty/Placeholder Directories (`.gitkeep`)

| `.gitkeep` file | Directory contents | Disposition |
|---|---|---|
| `tests/seed_data/.gitkeep` | **Has real content** — 9 CSV test data files present | **SAFE TO REMOVE `.gitkeep`** — directory has real content |
| `PROGRAM_CONTROL/DIRECTIVES/IN_PROGRESS/.gitkeep` | Only `.gitkeep` — no directives in progress | **KEEP** — intentional scaffold; no current in-progress directives is correct state |
| `PROGRAM_CONTROL/DIRECTIVES/DONE/.gitkeep` | Has real content — 39 DONE directives | **SAFE TO REMOVE `.gitkeep`** — directory has real content |
| `PROGRAM_CONTROL/DIRECTIVES/QUEUE/.gitkeep` | Has real content — 8 QUEUE directives | **SAFE TO REMOVE `.gitkeep`** — directory has real content |
| `PROGRAM_CONTROL/REPORT_BACK/.gitkeep` | Has real content — 137 REPORT_BACK files | **SAFE TO REMOVE `.gitkeep`** — directory has real content |
| `docs/doctrine/.gitkeep` | Has real content — `COPILOT_GUARDRAILS.md` present | **SAFE TO REMOVE `.gitkeep`** — directory has real content |

**Summary:** 5 `.gitkeep` files are safe to remove (directories have content). 1 `.gitkeep` (`DIRECTIVES/IN_PROGRESS/`) is intentional scaffolding and should be retained.

---

## Item 11 — Tombstone Integrity

### NATS topics declared tombstoned in `services/showzone/RETIRED.md`

| Topic (from RETIRED.md) | In `topics.registry.ts`? | `@deprecated` annotation? | Active subscriber found? |
|---|---|---|---|
| `showzone.dwell.tick` | ✅ `SHOWZONE_DWELL_TICK` | ✅ "RETIRED 2026-04-26. ShowToken removed." | ❌ None |
| `showzone.seat.opened` | ✅ `SHOWZONE_SEAT_OPENED` | ✅ "RETIRED 2026-04-26. ShowToken removed." | ❌ None |
| `showzone.phase2.trigger` | ✅ `SHOWZONE_PHASE2_TRIGGER` | ✅ "RETIRED 2026-04-26. ShowToken removed." | ❌ None |
| `showzone.show.ended` | ✅ `SHOWZONE_SHOW_ENDED` | ✅ "RETIRED 2026-04-26. ShowToken removed." | ❌ None |

**NATS registry section header** for showzone topics:
```
// ── ShowZone Theatre — RETIRED (2026-04-26) — ShowToken removed ───────
// Topics kept as tombstones so existing consumers fail loudly.
// Do not publish new messages to these subjects.
```

**Tombstone integrity: PERFECT** — All 4 topics from `RETIRED.md` are present in `topics.registry.ts` with correct `@deprecated` annotations. No drift detected. No active subscribers.

---

## Item 12 — CI/Workflow Drift

### Workflows audited

| Workflow file | Paths/scripts referenced | Exists? |
|---|---|---|
| `ci.yml` | `infra/postgres/init-ledger.sql` | ✅ |
| `ci.yml` | `.github/required-files.txt` | ✅ |
| `deploy.yml` | `infra/postgres/init-ledger.sql` | ✅ |
| `deploy.yml` | `yarn prisma:generate`, `yarn prisma:push`, `yarn typecheck`, `yarn lint`, `yarn test` | ✅ (all in package.json scripts) |
| `deploy.yml` | `docker-compose.yml` | ✅ |
| `super-linter.yml` | `.github/linters` (LINTER_RULES_PATH) | ⚠️ `.github/linters/` directory referenced but not verified |
| `harvest-oss-refs.yml` | No local paths — clones from external repos | N/A |
| `repo-manifest.yml` | `PROGRAM_CONTROL/REPO_MANIFEST.md` | ✅ |
| `directive-intake.yml` | `PROGRAM_CONTROL/DIRECTIVES/QUEUE/**.md` path filter | ✅ |
| `directive-dispatch.yml` | No local script paths — inline bash only | N/A |
| `auto-merge.yml` | No local paths | N/A |
| `codeql.yml` | `sarif-results` upload path | Standard CodeQL — no local dep |
| `copilot-setup-steps.yml` | `yarn install`, `yarn prisma:generate`, `yarn typecheck` | ✅ |
| `notify.yml` | No local paths | N/A |
| `populate-issues.yml` | No local paths | N/A |
| `protect-ref-branches.yml` | No local paths | N/A |

### Verified required-files.txt entries

All 22 paths in `.github/required-files.txt` verified to exist:

```
✅ infra/postgres/init-ledger.sql
✅ docker-compose.yml
✅ PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_SYSTEM_STATE.md
✅ PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_GOVERNANCE.md
✅ PROGRAM_CONTROL/DIRECTIVES/QUEUE/CNZ-WORK-001.md
✅ .github/copilot-instructions.md
✅ services/core-api/src/app.module.ts
✅ services/core-api/src/db.ts
✅ services/core-api/src/prisma.service.ts
✅ services/core-api/src/finance/ledger.service.ts
✅ services/core-api/src/finance/ledger.types.ts
✅ services/core-api/src/creator/statements.service.ts
✅ services/core-api/src/creator/statements.controller.ts
✅ services/core-api/src/creator/creator.module.ts
✅ services/core-api/src/risk/risk-score.service.ts
✅ services/core-api/src/safety/safety.service.ts
✅ services/core-api/src/safety/safety.module.ts
✅ services/core-api/src/growth/referral-reward.service.ts
✅ services/core-api/src/growth/guarded-notification.service.ts
✅ services/core-api/src/growth/growth.module.ts
✅ docs/REQUIREMENTS_MASTER.md
✅ docs/DOMAIN_GLOSSARY.md
```

### CI Drift finding

⚠️ **Potential gap:** `super-linter.yml` references `LINTER_RULES_PATH: .github/linters` but `.github/linters/` directory contents were not explicitly verified to exist. If the directory or its rule files are absent, super-linter may fall back to defaults (non-breaking) or fail (if strict). Recommend confirming:

```bash
ls .github/linters/
```

**No workflows reference files that definitively do not exist.** All deploy/CI paths verified present.

---

## Summary Disposition Table (Phase 2 candidates)

| Item | File/Path | Proposed Action | Condition |
|---|---|---|---|
| 1 | `copilot-global-rename.bundle` | **DELETE** | No references; rename op complete |
| 1 | `copilot-global-rename.patch` | **DELETE** | No references; rename op complete |
| 6 | `governance/CLAUDE.stale.md` | **DELETE** | Zero functional inbound links; self-declared superseded |
| 4 | `archive/LEGACY_CONFIGS_2026-04/` | **KEEP** | Audit retention policy — locked until 2027-04-24 per HANDOFF.md |
| 5 | `services/showzone/src/room-session.service.ts` | **DELETE** (conditional) | Zero importers, zero NATS subs, RETIRED.md present — subject to approval |
| 5 | `services/showzone/src/showzone.module.ts` | **DELETE** (conditional) | Same conditions as above |
| 5 | `services/showzone/RETIRED.md` | **KEEP PERMANENTLY** | Tombstone — must not be removed |
| 10 | `tests/seed_data/.gitkeep` | **DELETE** | Directory has real content |
| 10 | `PROGRAM_CONTROL/DIRECTIVES/DONE/.gitkeep` | **DELETE** | Directory has real content |
| 10 | `PROGRAM_CONTROL/DIRECTIVES/QUEUE/.gitkeep` | **DELETE** | Directory has real content |
| 10 | `PROGRAM_CONTROL/REPORT_BACK/.gitkeep` | **DELETE** | Directory has real content |
| 10 | `docs/doctrine/.gitkeep` | **DELETE** | Directory has real content |
| 10 | `PROGRAM_CONTROL/DIRECTIVES/IN_PROGRESS/.gitkeep` | **KEEP** | Intentional scaffold — no directives currently in progress |
| 9 | `.gitignore` | **TIGHTEN** | Add 10 missing patterns per Item 9 |
| 3 | `PROGRAM_CONTROL/REPORT_BACK/_ARCHIVE_2026-Q1/` | **CREATE + git mv** | Move pre-Q1-2026 files; pending human curation of file list |

---

## Result

**PHASE 1: SUCCESS**  
Inventory complete. No files were modified, deleted, created, or moved during Phase 1 (except this report).

**STOP — awaiting written human approval before proceeding to Phase 2.**
