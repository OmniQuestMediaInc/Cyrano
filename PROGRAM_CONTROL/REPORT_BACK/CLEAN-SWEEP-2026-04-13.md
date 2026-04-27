# CLEAN SWEEP — 2026-04-13

**Task:** Clean sweep of repo — identify drag/noise, delete what's certain, flag what needs human action.  
**Branch:** `copilot/cleanup-repo-noise`  
**HEAD:** see git log

---

## DELETIONS EXECUTED

| File | Reason |
|------|--------|
| `package-lock.json` | Yarn is the canonical package manager (OQMI CODING DOCTRINE v2.0, Package Manager Policy). Both `package-lock.json` AND `yarn.lock` were present. `package-lock.json` is npm-generated noise — deleted. |
| `docs/manuals` | Not a directory — a 1-byte file containing only `\n` (confirmed via `xxd`). Clearly a corrupted stub or placeholder that was never completed. Not referenced in `required-files.txt` or any import. Deleted. |
| `services/core-api/.gitkeep` | `.gitkeep` is used to hold empty directories in git. `services/core-api/` has 26 subdirectories and is fully populated. `.gitkeep` is no longer needed. |
| `services/rewards-api/.gitkeep` | Same reason — `rewards-api/src/engine/` and `src/white-label/` have content. |
| `services/risk-engine/.gitkeep` | Same reason — `risk-engine/src/` has content. |

---

## FINDINGS REQUIRING HUMAN ACTION

### ⚠️ CRITICAL — Missing `docs/DOMAIN_GLOSSARY.md`

**Status:** MISSING  
**Impact:** HIGH — Referenced as the naming authority in three governance files:
- `.github/copilot-instructions.md` line 32
- `CLAUDE.md` line 7
- `services/core-api/src/config/governance.config.ts` lines 199–203

Every agent operating in this repo is instructed to consult `docs/DOMAIN_GLOSSARY.md` before naming any domain concept. Without it, there is no authoritative naming check — agents are operating blind on nomenclature governance.

**Action required:** CEO / Product Owner must author and commit `docs/DOMAIN_GLOSSARY.md`.

---

### ⚠️ MEDIUM — `issues/` directory is vestigial

**Files:** `issues/WO-019.md`, `issues/WO-021.md`  
**Content:** Thin stubs (1–2 lines each). These pre-date the `.github/workflows/populate-issues.yml` workflow which now creates GitHub Issues programmatically.

**Assessment:** These files have no active purpose. They are not referenced by any workflow, not included in `required-files.txt`, and not imported by any code. Safe to delete.

**Action required:** Human confirmation to delete. Will not touch without authorization.

---

### ⚠️ MEDIUM — TypeORM migration exists alongside Prisma

**File:** `services/core-api/src/database/migrations/1710500000000-CreateLedgerAndAudit.ts`  
**Issue:** This is a TypeORM `MigrationInterface` file. The project has fully migrated to Prisma (`prisma/schema.prisma`, `prisma/migrations/`, `services/core-api/src/prisma.service.ts`). This old TypeORM migration defines `ledger_entries` and `audit_log` tables — the same tables managed by `infra/postgres/init-ledger.sql` and Prisma.

The `services/core-api/src/database/` directory has no module file, is not imported anywhere, and is not registered in AppModule. It is dead code.

**Action required:** Confirm whether this migration was fully superseded by Prisma + `init-ledger.sql`. If yes, the `services/core-api/src/database/` directory can be deleted entirely.

---

### ℹ️ INFO — `.gitkeep` files in populated PROGRAM_CONTROL directories

The following `.gitkeep` files are still present in directories with actual content. They are 0-byte and harmless, but are technically noise:
- `tests/seed_data/.gitkeep` (10 CSV files alongside it)
- `PROGRAM_CONTROL/DIRECTIVES/DONE/.gitkeep` (11 directive files)
- `PROGRAM_CONTROL/DIRECTIVES/QUEUE/.gitkeep` (4 directive files)
- `PROGRAM_CONTROL/REPORT_BACK/.gitkeep` (77 report-back files)
- `PROGRAM_CONTROL/CLEARANCES/.gitkeep` (3 clearance files)
- `docs/doctrine/.gitkeep` (1 guardrails file)

These are left in place — their presence is harmless and removal is a cosmetic preference.

---

### ℹ️ INFO — Root-level `finance/`, `governance/`, `safety/` directories

These root-level directories exist alongside `services/core-api/src/finance`, `src/governance`, `src/safety`. They are NOT duplicates:

- Root `finance/` contains FIZ-specific utilities (`ForensicHasher`, `BatchPayout`, `CommissionSplit`, etc.) included in `tsconfig.json` and cross-referenced by `governance/pre-ship-audit.service.ts`.
- Root `governance/` contains `pre-ship-audit.service.ts` (pre-ship certification utility).
- Root `safety/` contains `security-guardrails.service.ts` (JWT guard utility).

These are **intentional standalone utilities** not registered in NestJS AppModule. They compile cleanly and serve specific FIZ-layer purposes. No action needed.

---

### ℹ️ INFO — Two `governance.config.ts` files

- `services/core-api/src/config/governance.config.ts` — `GovernanceConfigService` class (platform constants, payout rates, scheduling, webhook hardening, geo pricing, gamification). Used by ~14 services.
- `services/core-api/src/governance/governance.config.ts` — `GovernanceConfig` object (DFSP-specific constants: integrity holds, purchase windows, OTP, risk scoring). Used by DFSP services and webhook hardening.

These are **different configs with different scopes**, not duplicates. No action needed.

---

### ℹ️ INFO — Stub/placeholder TODO items in source

The following TODOs are present in production code and represent known incomplete work:

| File | TODO |
|------|------|
| `src/audit/audit-dashboard.controller.ts` | Full Red Book scenario filtering not implemented |
| `src/dfsp/checkout-confirmation.service.ts` | Email/SMS delivery stubbed — wired in v6 |
| `src/compliance/geo-fencing.service.ts` | GEO-OVERRIDE-DB — migrate to DB-backed store before go-live |
| `src/finance/ledger.service.ts` | `recordSplitTip` is a stub |
| `src/growth/guarded-notification.service.ts` | SendGrid/Twilio/APNs integration pending Scale Phase |
| `src/creator/roster.gateway.ts` | Roster and contract retrieval not implemented |
| `src/creator/dashboard.controller.ts` | Dashboard summary aggregation not implemented |

These are tracked in the backlog. No deletion warranted.

---

## RESULT

**DELETIONS:** 5 files removed (confirmed safe)  
**HUMAN ACTIONS REQUIRED:** 3 (DOMAIN_GLOSSARY.md creation, issues/ vestiges confirmation, TypeORM migration retirement confirmation)
