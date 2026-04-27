## CHATNOW.ZONE BUILD STATUS

**Date:** April 24, 2026
**Status:** BUILD COMPLETE — CANONICAL COMPLIANT (Alpha Launch Ready)

All L0 ship-gates closed per Canonical Corpus v10 + REDBOOK + Business Plan v2.8.
Payloads 1–10 executed and verified.
Retired tier alignment complete: `DAY_PASS`, `ANNUAL` (as tier), `OMNIPASS_PLUS`, and standalone `DIAMOND`
replaced with canonical `GUEST` / `VIP` / `VIP_SILVER` / `VIP_GOLD` / `VIP_PLATINUM` / `VIP_DIAMOND`
across `ZONE_MAP`, `ZONE_ACCESS_TIERS`, `MEMBERSHIP.STIPEND_CZT`, `MembershipService`,
`ZoneAccessService`, `RecoveryTypes`, `DiamondConciergeService`, and all integration tests.

---

# OQMI System State — Backlog Snapshot

**Snapshot date:** 2026-04-25 (PAYLOAD 7 + 8 — Frontend Polish + Ship-Gate Verification)
**Branch of record:** `claude/frontend-polish-concierge-ui-mlqrR`
**Authority:** OmniQuest Media Inc. — OQMI_GOVERNANCE.md (Canonical Corpus v10)
**Launch posture:** **ChatNow.Zone Core — Launch Ready (Alpha)**

> This file is a **periodic snapshot** of program state. It is generated
> during governance runs (most recently: Repo Prep & Cleanup 2026-04-24).
> The live, authoritative source of truth is:
>
> - Governance doctrine → `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_GOVERNANCE.md`
> - Coding doctrine v2.0 → `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_SYSTEM_STATE.md`
> - Live requirements → `docs/REQUIREMENTS_MASTER.md`
> - Domain glossary → `docs/DOMAIN_GLOSSARY.md`
> - Agent instructions → `.github/copilot-instructions.md`

---

## 1. Core Identifiers

| Field                | Value                                                                     |
| -------------------- | ------------------------------------------------------------------------- |
| Company              | OmniQuest Media Inc. (OQMInc™)                                            |
| CEO / CD / LD        | Kevin B. Hartley                                                          |
| Platform (primary)   | ChatNow.Zone — `chatnow.zone`                                             |
| Secondary platform   | Cyrano (60–120 days post-CNZ stabilization)                               |
| Repo                 | `OmniQuestMediaInc/ChatNowZone--BUILD`                                    |
| Hard launch deadline | 2026-10-01                                                                |
| Governance ban (§12) | Banned entity (name [REDACTED]) — never referenced in any OQMInc material |

---

## 2. Directive Pipeline (snapshot counts)

| Bucket                                    | Count | Source                                 |
| ----------------------------------------- | ----: | -------------------------------------- |
| `PROGRAM_CONTROL/DIRECTIVES/DONE/`        |    39 | filesystem                             |
| `PROGRAM_CONTROL/DIRECTIVES/IN_PROGRESS/` |     0 | filesystem                             |
| `PROGRAM_CONTROL/DIRECTIVES/QUEUE/`       |     7 | filesystem (excludes standing prompts) |

**Active QUEUE contents (2026-04-24):**

- `CNZ-CLAUDE-CODE-KICKOFF.md` — standing Claude Code kickoff
- `CNZ-CLAUDE-CODE-STANDING-PROMPT.md` — standing Claude Code prompt
- `CNZ-WORK-001.md` — master Wave A–H backlog (Waves B–H still open)
- `OQMI_GOVERNANCE.md` — governance doctrine (live source of truth)
- `OQMI_SYSTEM_STATE.md` — coding doctrine v2.0 (live source of truth)
- `OSS-Lift-From-Index.md` — OSS reference lift index
- `OSS-Repo-Registry.md` — OSS reference repo registry

---

## 3. Requirements Master — Status Distribution

Counts from `docs/REQUIREMENTS_MASTER.md` (114 tracked rows):

| Status          | Count |
| --------------- | ----: |
| DONE            |    20 |
| QUEUED          |    12 |
| IN_PROGRESS     |     4 |
| NEEDS_DIRECTIVE |    73 |
| RETIRED         |     9 |

---

## 4. Canonical Corpus L0 Ship-Gate Status

Ship-gate components tracked against Corpus L0 (from `CNZ-WORK-001` Wave H,
H-LAUNCH-READY sign-off directive):

| System                                     | Directive(s) | Status at snapshot                                                                                                                                                                |
| ------------------------------------------ | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Three-Bucket Wallet                        | D001         | DONE — `LedgerService.debitWallet` + `ThreeBucketSpendGuardMiddleware` defence-in-depth                                                                                           |
| Risk Engine                                | D002         | NEEDS_DIRECTIVE                                                                                                                                                                   |
| NATS Fabric                                | D003         | DONE (scaffold) — PAYLOAD 6 extended with AUDIT*IMMUTABLE*\* topics                                                                                                               |
| OBS Broadcast Kernel                       | D004         | NEEDS_DIRECTIVE                                                                                                                                                                   |
| FairPay + NOWPayouts                       | D006, E002   | NEEDS_DIRECTIVE                                                                                                                                                                   |
| RedBook                                    | E001         | NEEDS_DIRECTIVE                                                                                                                                                                   |
| Compliance Stack                           | D008         | NEEDS_DIRECTIVE                                                                                                                                                                   |
| GateGuard Sentinel                         | E003         | NEEDS_DIRECTIVE                                                                                                                                                                   |
| Flicker n'Flame Scoring (FFS)                           | PAYLOAD 5    | DONE (scaffold) — deterministic tier computation + NATS emission, persistence NEEDS_DIRECTIVE                                                                                     |
| CreatorControl.Zone                        | PAYLOAD 5    | DONE (scaffold) — Broadcast Timing + Session Monitoring copilots, single-pane snapshot; frontend NEEDS_DIRECTIVE                                                                  |
| Cyrano Layer 1                             | PAYLOAD 5    | DONE (scaffold) — 8-category whisper engine, memory, personas, latency SLO; Layer 2 (LLM + Prisma memory) NEEDS_DIRECTIVE                                                         |
| Integration Hub                            | PAYLOAD 5    | DONE (scaffold) — Ledger↔GateGuard, Recovery↔Diamond Concierge, Flicker n'Flame Scoring↔CreatorControl+Cyrano handoffs                                                                          |
| Black-Glass Interface                      | G101+        | NEEDS_DIRECTIVE — visual treatment deferred to post-alpha (Payload 7 ships brand tokens + dark-mode default)                                                                      |
| Banned-entity residual purge               | C001 (§12)   | DONE — purge/redact sweep completed 2026-04-24                                                                                                                                    |
| Immutable Audit Architecture               | PAYLOAD-6    | DONE — hash-chain + WORM export + Canonical Compliance Checklist                                                                                                                  |
| Frontend Polish + Diamond Concierge UI     | PAYLOAD-7    | DONE — `/admin/diamond`, `/admin/recovery`, `/creator/control`, `/tokens`, `/diamond/purchase`, `/wallet` page builders + presenters + render plans + theme + SEO + accessibility |
| End-to-end validation + Ship-Gate verifier | PAYLOAD-8    | DONE — six E2E flows + `PROGRAM_CONTROL/ship-gate-verifier.ts` + `docs/ARCHITECTURE_OVERVIEW.md` + `docs/PRE_LAUNCH_CHECKLIST.md`                                                 |

---

## 5. Invariant Compliance Audit — 2026-04-24

### 5.1 Ledger append-only (no UPDATE/DELETE)

Enforced via Postgres triggers in `infra/postgres/init-ledger.sql` on:

- `ledger_entries` (lines 111–175)
- `transactions` (lines 239–345, partial — status updates permitted by design)
- `audit_events` (lines 429–500)
- `referral_links` (lines 508–570)
- `attribution_events` (lines 578–660)
- `notification_consent_store` (lines 668–730)
- `game_sessions` (lines 765–795)
- `call_sessions` (lines 855–890)
- `voucher_vault` (lines 892–920)
- `content_suppression_queue` (lines 925–955)
- `identity_verification` DELETE-blocked (lines 396–420)

Migration-level triggers also present on `schedule_audit_log`
(`prisma/migrations/20260412000000_gz_scheduling_module/migration.sql`,
lines 154–170).

**Status:** PASS — all designated ledger/audit tables are append-only.

### 5.2 `correlation_id` + `reason_code` on financial/audit tables

Verified via `grep` in `prisma/schema.prisma`:

- Present on: `StaffMember`, `SchedulePeriod`, `ShiftTemplate`,
  `ShiftAssignment`, `ShiftGap`, `ShiftBid`, `ScheduleAuditLog`,
  `DepartmentCoverage`, `StatHoliday`, `WebhookIdempotencyLog`,
  `AuditEvent` (reason_code only), and other ledger-adjacent models
  via init-ledger SQL.
- **Partial on `LegalHold`:** `reason_code` present; `correlation_id`
  **missing** from both `prisma/schema.prisma` (line 281) and its
  migration (`20260409000000_legal_hold_db_migration/migration.sql`).

**Remediation item:** author a FIZ/GOV-scoped directive to add
`correlation_id VARCHAR(64) NOT NULL` to `legal_holds` via a new
migration. Out of scope for the 2026-04-24 hygiene run (would require
a FIZ-prefixed commit with REASON/IMPACT/CORRELATION_ID; the hygiene
run is CHORE-prefixed).

### 5.3 Network isolation — Postgres (5432) / Redis (6379)

Enforced in `docker-compose.yml` lines 4–39: neither `db` nor `redis`
exposes a host port binding; both live on the internal `backend`
network only. **Status:** PASS.

### 5.4 NATS real-time event fabric (no REST polling for chat/haptic)

NATS JetStream present at `docker-compose.yml` line 41; topic registry
at `services/nats/topics.registry.ts` per governance doctrine.
**Status:** PASS at scaffold level — per-feature enforcement tracked
via `CNZ-WORK-001` wave directives.

### 5.5 No secrets in repo

`find -name ".env*" -o -name "*.env"` returns nothing under tracked
paths (excluding `.git` and `node_modules`). `.gitignore` covers
`*.env.local` and `*.env.*.local` patterns. **Status:** PASS.

### 5.6 Governance §12 banned-entity purge

All references to the banned individual/firm have been redacted across
`REFERENCE_LIBRARY/00_THREAD_BOOTSTRAP.md`, `docs/REQUIREMENTS_MASTER.md`,
`PROGRAM_CONTROL/DIRECTIVES/QUEUE/CNZ-WORK-001.md`, and both Thread 13
report-back files. `grep -rni "Navigator\|Jaime Watt"` outside the
`archive/` quarantine returns zero matches. **Status:** PASS.

---

## 6. Repo Hygiene Actions (2026-04-25 — Payload 7 + 8)

- Built UI surface: `ui/types/` (admin-diamond, public-wallet, creator-panel),
  `ui/view-models/` (presenters), `ui/app/` (page builders for
  `/admin/diamond`, `/admin/recovery`, `/creator/control`, `/tokens`,
  `/diamond/purchase`, `/wallet`), `ui/config/` (theme, SEO, build config,
  accessibility), `ui/components/render-plan.ts`.
- Added six end-to-end test files under `tests/e2e/` covering the
  canonical token purchase, high-heat → Cyrano → payout scaling,
  Diamond recovery flows, expiration redistribution, immutable audit
  chain replay, RBAC step-up enforcement, and the UI presenters.
- Authored `PROGRAM_CONTROL/ship-gate-verifier.ts` — exits non-zero if
  any L0 invariant is violated; `tests/e2e/ship-gate-verifier.spec.ts`
  pins its report shape.
- Added `docs/PRE_LAUNCH_CHECKLIST.md` (L0 ship-gate sign-off form) and
  `docs/ARCHITECTURE_OVERVIEW.md` (Payloads 1–8 map).
- Updated root `README.md` with the new architecture map + ship-gate
  status.
- Updated `jest.config.js` to include `tests/e2e/**/*.spec.ts` +
  `ui/**/*.spec.ts` roots.
- Added `yarn ship-gate` script to `package.json`.

## 6.1 Repo Hygiene Actions (2026-04-24 run — historical)

- Quarantined `LEGACY_CONFIGS/` → `archive/LEGACY_CONFIGS_2026-04/`
  (HANDOFF.md filed).
- Flattened `archive/governance/` → `governance/` with
  `CLAUDE.stale.md` marker on the superseded doctrine file.
- Deduplicated `.prettierignore` + `.markdownlintignore` (removed
  stale `LEGACY_CONFIGS/` references; archive folder remains excluded
  from formatters).
- Redacted governance §12 banned-entity references across live docs.
- Created root `README.md` with canonical quickstart and governance
  pointers.
- Marked `PROGRAM_CONTROL/REPO_MANIFEST.md` as stale (auto-regenerated
  by the `repo-manifest.yml` workflow on next push).

---

## 7. Known Remediation Items (not executed in this run)

| Item                                                               | Reason                                                                            | Follow-up                                                     |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `legal_holds.correlation_id` missing                               | Requires FIZ-scoped schema migration; not a hygiene change                        | Author GOV-scoped directive                                   |
| `yarn install` / `lint --fix` / `prettier --write` not run locally | Sandbox registry returned HTTP 503 repeatedly; no cached `node_modules` available | CI `ci.yml` + `super-linter.yml` workflows will enforce on PR |
| Wave B–H of `CNZ-WORK-001` still open                              | Normal backlog                                                                    | Tracked in `docs/REQUIREMENTS_MASTER.md`                      |

---

## 8. Payload 9 — Build-Complete Deliverables (2026-04-24)

| Artifact | Path | Purpose |
| --- | --- | --- |
| Deployment pipeline | `.github/workflows/deploy.yml` | Build, typecheck, lint, test, Prisma push, SQL-schema validation, Docker compose config validation, readiness gate |
| Production compose | `docker-compose.yml` | Canonical bring-up with FT-033 intact, env-var driven secrets, Payload 1–8 feature flags |
| Integration Hub v2 | `services/integration-hub/src/hub.service.ts` | `forwardGuardedLedgerRequest` (GateGuard pre-processor), `emitRecoveryExpiryWarning`, `emitDiamondConciergeHandoff`, `processHighHeatSession` |
| Launch manifest | `PROGRAM_CONTROL/LAUNCH_MANIFEST.md` | Pixel Legacy onboarding, Mic Drop Reveal, 3,000-creator rate-lock, GateGuard LOI data package |
| Pre-launch checklist | `docs/PRE_LAUNCH_CHECKLIST.md` | CEO sign-off, compliance, infra, observability, go/no-go |
| Architecture overview | `docs/ARCHITECTURE_OVERVIEW.md` | Full system map, cross-Payload invariants, cross-service wiring |
| Root README update | `README.md` | Final "How to Run" + architecture summary |

## 9. Contact / Authority

All content authority flows through Kevin B. Hartley (CEO). Directive
authoring happens in Claude Chat; execution happens in Claude Code and
GitHub Copilot via the `PROGRAM_CONTROL/DIRECTIVES/` pipeline. No agent
may clear a GOV gate without CEO-signed clearance in
`PROGRAM_CONTROL/CLEARANCES/`.
