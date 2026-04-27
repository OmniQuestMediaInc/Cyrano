# CNZ-WORK-001 — ChatNow.Zone Active Work Charter

**Type:** Persistent task list (does NOT move to DONE/ as a whole; individual tasks complete and amend in-place)
**Status:** ACTIVE — source of truth for ChatNow.Zone architecture and coding tasks
**Authority:** Kevin B. Hartley, CEO — OmniQuest Media Inc.
**Repo:** `OmniQuestMediaInc/ChatNowZone--BUILD`
**Path:** `PROGRAM_CONTROL/DIRECTIVES/QUEUE/CNZ-WORK-001.md`
**Date opened:** 2026-04-21 (Thread 19)
**Hard launch deadline:** April 30, 2026 — this is the authoritative deadline and supersedes any older references to October 1, 2026 elsewhere in this charter.

**Governing documents:**

- `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_GOVERNANCE.md` — governance, RoE, invariants
- `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_SYSTEM_STATE.md` — DONE/WIP/OUTSTANDING tracker

**Source of tasks:**

- `docs/ASSESSMENTS/REPO_VS_PLAN_TECHNICAL_DEFICIT_v1.md` (Thread 18, 36 rows)
- Thread 18 → Thread 19 handoff
- CEO directives 2026-04-21
- Tech-debt findings from Thread 19 repo scan (2026-04-21)

-----

## 0. PERSISTENCE & LIFECYCLE — READ FIRST

This file is NOT a normal directive. It does not move to DONE/ when individual tasks complete.

The charter file (this document) is persistent. It lives at `PROGRAM_CONTROL/DIRECTIVES/QUEUE/CNZ-WORK-001.md` indefinitely.

**Tasks are individually trackable.** Each task has a stable ID (`CNZ-WORK-001-A001`, `CNZ-WORK-001-A002`, …). When a task merges:

1. A completion record is written to `PROGRAM_CONTROL/DIRECTIVES/DONE/CNZ-WORK-001-<task-id>-DONE.md` using the template in §11.
1. The task’s `Status:` line in §6 is amended in-place from `QUEUED` → `DONE` and the merge commit SHA + DONE filename are appended.
1. The corresponding row in `OQMI_SYSTEM_STATE.md` §3 DONE / §5 OUTSTANDING is updated in the same PR per OQMI_GOVERNANCE.md §4.4.

**The charter is amended, not replaced.** New tasks may be appended to the active Wave by the CEO. Closed tasks are never deleted from the charter — they remain as history.

**The charter only retires when the CEO explicitly authors a successor charter** (e.g. CNZ-WORK-002) and marks this one RETIRED. At that point it moves to `archive/charters/`.

This file contains NO governance, NO RoE, NO invariants. Those live in `OQMI_GOVERNANCE.md`. This file lists work.

-----

## 1. SCOPE

This charter covers all architecture and coding work required to close the tech-debt deficit identified in Thread 18 and bring ChatNowZone–BUILD to the 1 October 2026 hard launch ship gate.

Scope is bounded to:

- ChatNowZone–BUILD repository
- Code, schema, infra, docs, governance-adjacent cleanup within the repo
- Plan-amendment tasks (R-P0-* documentation amendments to v2.8 business plan) that originate from the repo-vs-plan deficit assessment

**Out of scope:**

- Changes to other OmniQuest Media Inc. repos (RedRoomRewards, OmniQuest Media Inc. corporate site, etc.)
- Business plan content beyond the eight R-P0 amendments listed
- Marketing, creator onboarding, Telegram strategy (those have separate workstreams)

-----

## 2. AGENT ROUTING

Each task carries an `Agent:` hint:

- `copilot` — preferred for repo chores, file moves, config edits, multi-file mechanical work
- `claude-code` — preferred for service authoring, schema design, complex refactors, anything FIZ-scoped
- `either` — task is small and routing-agnostic; first-come-first-served

The hint is a **routing suggestion, not an exclusivity lock.** An agent that cannot satisfy a task’s `Agent:` hint may still execute it if no other agent has claimed it within 24h, but must note the override in the report-back.

All agents operate under OQMI_GOVERNANCE.md §1 (assignment-equals-approval) and §4.2 (Droid Mode default). HARD_STOP on any ambiguity, missing dependency, missing operator decision, or invariant conflict.

-----

## 3. WAVE STRUCTURE & CADENCE

Tasks are grouped into Waves. Waves execute roughly sequentially but tasks within a Wave may run in parallel where dependencies permit.

- **Wave A — Repo Hygiene & Pre-Read** (must complete before Wave B opens)
- **Wave B — CEO Decision Surfacing** (parallel to Wave A; surfaces clarifies)
- **Wave C — Plan Amendments** (R-P0-* documentation; parallel to anything)
- **Wave D — Verification & Extension of L0 Spine** (the eight existing services)
- **Wave E — Net-New L0 Build** (P0 stack assets not yet in repo)
- **Wave F — Plan IP Layer** (P1 stack assets, clarify-blocked)
- **Wave G — XL Decomposition Outputs** (Cyrano layers, Black-Glass decomposed pieces)
- **Wave H — Hardening & Pre-Launch Cleanup**

Each Wave terminates in a `CNZ-WORK-001-CHORE-<wave>` cleanup task. The next Wave does not open until the cleanup task is DONE.

-----

## 4. PRIORITY MODEL

- **P0** — Launch-blocking; must be done before 1 October 2026
- **P1** — Required for full v2.8 plan delivery; not strictly launch-blocking
- **P2** — Quality/governance hardening; can ship without
- **P3** — Nice-to-have, future roadmap

Within Waves, P0 > P1 > P2 > P3.

-----

## 5. STATUS ENUMS

- `QUEUED` — task in backlog, not yet started
- `CLAIMED` — agent has claimed; work begun
- `BLOCKED` — cannot proceed; reason in `Blocker:` field
- `IN-REVIEW` — PR open, CI running or human review pending
- `DONE` — merged to `main`; completion record filed
- `RETIRED` — task abandoned (rare; requires CEO sign-off)

-----

## 6. TASK LIST

Each task uses this shape:

```
CNZ-WORK-001-<ID>: <name>
Wave: A–H
Priority: P0–P3
Scope: S | M | L | XL
Agent: copilot | claude-code | either
Depends-on: [list of other CNZ-WORK-001 task IDs, or "none"]
CEO_GATE: YES | NO
FIZ: YES | NO
Source: <deficit row ID, CEO directive, or other origin>
Status: QUEUED
Directive: <single concrete instruction>
```

-----

### WAVE A — REPO HYGIENE & PRE-READ

```
CNZ-WORK-001-A001: Q-000-PRE-READ-AUDIT
Wave: A
Priority: P0
Scope: M
Agent: copilot
Depends-on: none
CEO_GATE: NO
FIZ: NO
Source: Deficit doc §1.3
Status: DONE — 2026-04-22 — 
Directive: Enumerate full subdirectory contents (recursive, depth >=3) for: services/, governance/, safety/, finance/, docs/, PROGRAM_CONTROL/, issues/, scripts/, infra/, tests/, ui/. Read and report contents of: prisma/schema.prisma, .github/copilot-instructions.md, docs/DOMAIN_GLOSSARY.md (if present). List all branches and flag stale candidates (no commits in 60+ days). File output as REPORT_BACK. This is the foundational audit that unblocks every VERIFY row in the deficit doc.
```

```
CNZ-WORK-001-A002: Delete CLAUDE.md from repo root
Wave: A
Priority: P0
Scope: S
Agent: either
Depends-on: A001
CEO_GATE: NO
FIZ: NO
Source: CEO directive 2026-04-21
Status: DONE — 2026-04-23 — PR pending — CNZ-WORK-001-A002-DONE.md (verified absent from root; only `archive/governance/CLAUDE.md` exists, which is the historical archive copy — left in place per archive policy)
Directive: Grep repo for inbound references to CLAUDE.md. If any exist, update them in the same PR. Then delete CLAUDE.md from repo root. Commit prefix CHORE.
```

```
CNZ-WORK-001-A003: Delete README.md from repo root
Wave: A
Priority: P0
Scope: S
Agent: either
Depends-on: A001, A004
CEO_GATE: NO
FIZ: NO
Source: CEO directive 2026-04-21
Status: DONE — 2026-04-23 — PR pending — CNZ-WORK-001-A003-DONE.md (Ghost Alpha provenance preserved by A004 prior; root README.md deleted)
Directive: Before deletion, capture the Ghost Alpha seed-data provenance line (currently "/tests/seed_data/ is the authoritative source for Ghost Alpha simulations") and land it in OQMI_SYSTEM_STATE.md §8 Provenance Notes via task A004. Then delete README.md from repo root. Commit prefix CHORE.
```

```
CNZ-WORK-001-A004: Land Ghost Alpha provenance into OQMI_SYSTEM_STATE.md
Wave: A
Priority: P0
Scope: S
Agent: either
Depends-on: none
CEO_GATE: NO
FIZ: NO
Source: Dependency of A003
Status: DONE
Directive: Add a single bullet to OQMI_SYSTEM_STATE.md §8 Provenance Notes stating: "/tests/seed_data/ is the authoritative source for Ghost Alpha simulations." This preserves the only fact README.md currently carries before A003 deletes README.md. Commit prefix CHORE.
```

```
CNZ-WORK-001-A005: Archive Sovereign_Kernel.md.pdf
Wave: A
Priority: P0
Scope: S
Agent: either
Depends-on: A001
CEO_GATE: NO
FIZ: NO
Source: CEO directive 2026-04-21 (RETIRED); Deficit doc cleanup item 4.3
Status: DONE — 2026-04-23 — PR pending — CNZ-WORK-001-A005-DONE.md (file moved to archive/governance/; inbound refs updated in REPO_MANIFEST.md, .github/copilot-instructions.md, OQMI_SYSTEM_STATE.md §8)
Directive: Move Sovereign_Kernel.md.pdf from repo root to archive/governance/Sovereign_Kernel.md.pdf (create archive/ if absent). Update any inbound references found in A001 grep. Commit prefix CHORE.
```

```
CNZ-WORK-001-A006: Delete superseded root-level OQMI_SYSTEM_STATE.md (v2.0 doctrine)
Wave: A
Priority: P0
Scope: S
Agent: either
Depends-on: A001 (confirm the QUEUE-path version is the live SoT)
CEO_GATE: NO
FIZ: NO
Source: Implied by CEO 2026-04-21 source-of-truth declaration
Status: DONE — 2026-04-23 — PR pending — CNZ-WORK-001-A006-DONE.md (root file deleted; .github/required-files.txt updated to point at PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_SYSTEM_STATE.md so CI validate-structure stays green; copilot-instructions.md header updated)
Directive: The root-level OQMI_SYSTEM_STATE.md is the OLD v2.0 doctrine version (March 28, 2026). It is superseded by PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_SYSTEM_STATE.md. Delete the root file. Confirm no inbound references first via A001 grep. Commit prefix CHORE.
```

```
CNZ-WORK-001-A007: Resolve package-lock.json + yarn.lock co-presence
Wave: A
Priority: P1
Scope: S
Agent: copilot
Depends-on: A001
CEO_GATE: NO
FIZ: NO
Source: OQMI_GOVERNANCE.md §5.3 Yarn default; tech debt finding 2026-04-21
Status: DONE — 2026-04-23 — PR pending — CNZ-WORK-001-A007-DONE.md (verified package-lock.json already absent from repo root; yarn.lock present and authoritative; no CI workflow references package-lock.json — paperwork only, file deletion was already accomplished prior to this charter run, likely by CHORE-PIPELINE-005 / CLEAN-SWEEP-2026-04-13)
Directive: OQMI_GOVERNANCE.md §5.3 mandates Yarn for OmniQuest Media Inc. repos and prohibits mixing package managers. Confirm no CI workflow references package-lock.json (check .github/workflows/ from A001 output). Then delete package-lock.json. Commit prefix CHORE.
```

```
CNZ-WORK-001-A008: Audit copilot/chore-update-program-control branch
Wave: A
Priority: P1
Scope: S
Agent: copilot
Depends-on: A001
CEO_GATE: NO
FIZ: NO
Source: Deficit doc cleanup item 4.6; Thread 16 §3.2 carryover
Status: DONE — 2026-04-23 — PR pending — CNZ-WORK-001-A008-DONE.md (branch `copilot/chore-update-program-control` is NOT present on origin as of 2026-04-23 — likely already deleted in a prior cleanup. RECOMMENDATION: no action; record the branch as historically resolved.)
Directive: Read the diff between copilot/chore-update-program-control and main. Report contents and recommend either merge (if still relevant) or close (if superseded by Thread 18 work). File recommendation as REPORT_BACK. CEO decides on action.
```

```
CNZ-WORK-001-A009: Stale branch report (no deletion)
Wave: A
Priority: P2
Scope: S
Agent: copilot
Depends-on: A001
CEO_GATE: NO
FIZ: NO
Source: Deficit doc cleanup item 4.10; Thread 16 stale-branch carryover
Status: DONE — 2026-04-23 — PR pending — CNZ-WORK-001-A009-DONE.md (10 remote branches enumerated and classified; no deletions performed)
Directive: From A001 branch list, produce a report classifying each branch as ACTIVE / STALE-CANDIDATE (no commits in 60+ days, no open PR) / CONFIRMED-MERGED. Report only — do not delete anything. CEO reviews; deletion is a separate authorized action.
```

```
CNZ-WORK-001-A010: Locate or confirm absent RRR_CEO_DECISIONS_FINAL_2026-04-17.md
Wave: A
Priority: P1
Scope: S
Agent: copilot
Depends-on: A001
CEO_GATE: NO
FIZ: NO
Source: Deficit doc cleanup item 4.9; six-thread blind spot
Status: DONE — 2026-04-23 — PR pending — CNZ-WORK-001-A010-DONE.md (file FOUND at `docs/RRR_CEO_DECISIONS_FINAL_2026-04-17.md`, 115 lines; contents indexed in REPORT_BACK; no contradictions with current canonical decisions surfaced)
Directive: Search the repo (all directories, all branches) for RRR_CEO_DECISIONS_FINAL_2026-04-17.md. If found, dump full contents to REPORT_BACK and cross-check against current canonical decisions. If not found, report not-present and CEO will decide whether to source from elsewhere or treat as never-landed.
```

```
CNZ-WORK-001-A011: Verify presence and contents of PROGRAM_CONTROL subdirectories
Wave: A
Priority: P1
Scope: S
Agent: copilot
Depends-on: A001
CEO_GATE: NO
FIZ: NO
Source: RRR-GOV-002 §0 references DONE/ and REPORT_BACK/ subdirs; need verification
Status: DONE — 2026-04-23 — PR pending — CNZ-WORK-001-A011-DONE.md (both directories present with substantive content; no .gitkeep needed)
Directive: Confirm whether PROGRAM_CONTROL/DIRECTIVES/DONE/ and PROGRAM_CONTROL/REPORT_BACK/ exist. If absent, create them as empty directories with .gitkeep files. These paths are required by the charter completion-record protocol (§11).
```

```
CNZ-WORK-001-A012: Reconcile commit prefix enums
Wave: A
Priority: P1
Scope: S
Agent: claude-code
Depends-on: A001
CEO_GATE: YES
FIZ: NO
Source: Tech debt finding 2026-04-21
Status: DONE — 2026-04-23 — PR pending — CNZ-WORK-001-A012-DONE.md (CEO decisions landed 2026-04-23: hybrid enum model, domain prefixes preserved, HCZ split from HZ, net-new domain prefixes added; resolves prefix half of R-CLARIFY-006)
Directive: Two commit-prefix enums exist in repo history. Old OQMI v2.0 (root OQMI_SYSTEM_STATE.md): FIZ | NATS | OBS | HZ | BIJOU | CRM | INFRA | UI | GOV | CHORE. RRR-GOV-002 §3.5: FIZ | DB | API | SVC | INFRA | UI | GOV | TEST | CHORE. These differ. Author CNZ-canonical commit prefix enum and document in docs/DOMAIN_GLOSSARY.md (or create the glossary if absent). Address R-CLARIFY-006 sub-question on HZ split (HZIO vs HCZ) at the same time. CEO_GATE because this is a naming-authority decision.
```

```
CNZ-WORK-001-A013: Move OQMI_GOVERNANCE.md path-reference reconciliation
Wave: A
Priority: P2
Scope: S
Agent: either
Depends-on: A001
CEO_GATE: NO
FIZ: NO
Source: Tech debt finding 2026-04-21
Status: DONE — 2026-04-23 — PR pending — CNZ-WORK-001-A013-DONE.md (directive premise partly incorrect — OQMI_GOVERNANCE.md does NOT contain "this repo, root" self-references in its Document header. The reference TO it lived in OQMI_SYSTEM_STATE.md header (fixed by A014) and §11 (fixed by this task A013). Other CNZ docs verified to reference correct PROGRAM_CONTROL/DIRECTIVES/QUEUE/ paths.)
Directive: OQMI_GOVERNANCE.md self-references its own location as "this repo, root" in its Document header and §11 cross-references, but the file actually lives at PROGRAM_CONTROL/DIRECTIVES/QUEUE/. Per CEO 2026-04-21 (these files all live together in DIRECTIVES/QUEUE), the file location is correct; the references inside the file need amendment. Update the self-references to match the actual path. Same pass: confirm all CNZ docs reference the correct path. Commit prefix GOV.
```

```
CNZ-WORK-001-A014: Repo visibility revert to PRIVATE
Wave: A
Priority: P0
Scope: S
Agent: CEO-only (cannot be performed by agent)
Depends-on: none
CEO_GATE: YES
FIZ: NO
Source: Thread 16 §7.4; Thread 18 §7.10
Status: DONE — 2026-04-23 — PR pending — CNZ-WORK-001-A014-DONE.md (CEO confirmed 2026-04-23 repo is presently private; paperwork landed OQMI_SYSTEM_STATE.md §1 Visibility=private and DONE record)
Directive: This task is CEO-action-only — agents cannot change repo visibility. Toggle repo Settings → Danger Zone → Change visibility to PRIVATE. Note in OQMI_SYSTEM_STATE.md §1 and §6 once complete.
```

```
CNZ-WORK-001-A099: WAVE A CLEANUP
Wave: A
Priority: P0
Scope: S
Agent: copilot
Depends-on: A001 through A013 (A014 is CEO-action and may run in parallel)
CEO_GATE: NO
FIZ: NO
Source: Wave cadence (§3)
Status: DONE — 2026-04-23 — PR pending — CNZ-WORK-001-A099-DONE.md (Wave A complete: A001-A014 all DONE; SoT consistency verified; §3/§7 of OQMI_SYSTEM_STATE.md updated to reflect all outcomes; §5 and §6 inspected — no Wave A items pending; lint coverage delegated to CI super-linter on PR; Wave A rollup REPORT_BACK filed; Wave B is now open)
Directive: Lint pass repo-wide. Dead-code sweep. Consistency check on the three SoT files in PROGRAM_CONTROL/DIRECTIVES/QUEUE/. Confirm OQMI_SYSTEM_STATE.md §3, §5, §6, §7 reflect all Wave A outcomes. Roll up Wave A REPORT_BACKs into a single Wave A summary. Wave B does not open until this completes.
```

-----

### WAVE B — CEO DECISION SURFACING

These tasks consolidate the twelve R-CLARIFY rows plus other open CEO decisions into a single decision pass. They run in parallel to Wave A and do not block Wave A completion.

```
CNZ-WORK-001-B001: Consolidate R-CLARIFY surface to CEO
Wave: B
Priority: P0
Scope: S
Agent: claude-in-chat
Depends-on: none
CEO_GATE: YES (CEO answers; agent only structures)
FIZ: NO
Source: Deficit doc Part 4
Status: QUEUED
Directive: Surface all twelve R-CLARIFY rows (R-CLARIFY-001 through R-CLARIFY-012) to CEO as a single consolidated question set, not one at a time. Format: question, options, downstream affected tasks. CEO answers in one pass. Answers feed Wave F task GAP_TYPE conversions.
```

```
CNZ-WORK-001-B002: Resolve XL decomposition for R-011 Cyrano
Wave: B
Priority: P1
Scope: S
Agent: claude-in-chat
Depends-on: B001 (specifically R-CLARIFY-007)
CEO_GATE: YES
FIZ: NO
Source: Deficit doc R-011, §5.3
Status: QUEUED
Directive: Once CEO has answered R-CLARIFY-007 (which Cyrano layers in launch scope), decompose into per-layer M/L tasks. Each layer becomes its own CNZ-WORK-001-G0NN row. Append to §6.
```

```
CNZ-WORK-001-B003: Resolve XL decomposition for R-108 Black-Glass Interface
Wave: B
Priority: P0
Scope: S
Agent: claude-in-chat
Depends-on: B001 (specifically R-CLARIFY-012), A001
CEO_GATE: YES
FIZ: NO
Source: Deficit doc R-108, §5.3
Status: QUEUED
Directive: Once CEO has answered R-CLARIFY-012 (frontend repo location), decompose Black-Glass Interface scope into per-feature M/L tasks. Each feature becomes its own CNZ-WORK-001-G0NN row. Compliance gates UI, RBAC enforcement, kill switch UI, consent workflow UI, age gate UI, wallet integrity UI per Corpus Ch.6 are minimum decomposition units.
```

-----

### WAVE C — PLAN AMENDMENTS (R-P0)

Eight documentation amendments to the v2.8 business plan. Not code. Run in parallel with anything.

```
CNZ-WORK-001-C001: R-P0-003 — Delete banned-entity residual (§12)
Wave: C
Priority: P0
Scope: S
Agent: claude-in-chat
Depends-on: none
CEO_GATE: NO
FIZ: NO
Source: Deficit doc R-P0-003; OQMI_GOVERNANCE.md §12 invariant
Status: QUEUED
Directive: Delete the banned-entity co-development line (the sentence naming the firm redacted per §12 on Q4 FY2026 Roadmap) from v2.8 plan Part I Roadmap Q4 FY2026. Per OQMI_GOVERNANCE.md §12 invariant, no references to the banned individual or firm ([REDACTED]) may appear in any OmniQuest Media Inc. material.
```

```
CNZ-WORK-001-C002: R-P0-001 — Resolve CZT vs SZT token architecture
Wave: C
Priority: P1
Scope: S
Agent: claude-in-chat
Depends-on: CEO decision
CEO_GATE: YES
FIZ: NO
Source: Deficit doc R-P0-001
Status: QUEUED
Directive: Plan §B.4.5 declares CZT the only token type; §B.4.7 lists SZT as a revenue pillar. Corpus v10 Ch.1 §3 affirms single-token economy. CEO chooses: (a) rename SZT line in §B.4.7 to a CZT-equivalent revenue stream, OR (b) amend architecture statement to permit named token classes. Implement chosen amendment.
```

```
CNZ-WORK-001-C003: R-P0-002 — Resolve SilverBullet tier mismatch
Wave: C
Priority: P1
Scope: S
Agent: claude-in-chat
Depends-on: CEO decision
CEO_GATE: YES
FIZ: NO
Source: Deficit doc R-P0-002
Status: QUEUED
Directive: Plan §B.4.6 lists SilverBullet as a tier; canonical lock treats it as a 30-day on-ramp variant of VIP_SILVER. CEO chooses: (a) align plan to canonical enum (GUEST, VIP, VIP_SILVER, VIP_GOLD, VIP_PLATINUM, VIP_DIAMOND), OR (b) amend canonical lock to make SilverBullet a tier. Implement chosen amendment.
```

```
CNZ-WORK-001-C004: R-P0-004 — Recalculate GateGuard volume model
Wave: C
Priority: P1
Scope: M
Agent: claude-in-chat (drafts) → CFO/CPA-equivalent (signs)
Depends-on: none
CEO_GATE: YES
FIZ: NO
Source: Deficit doc R-P0-004
Status: QUEUED
Directive: §B.5.8 contains "CPA review recommended before investor distribution" and volume correction notice. Recalculate margin model at correct ~$10.5M Y2 volume; remove warning boxes once recalculation is documented and CFO/CPA-equivalent has signed.
```

```
CNZ-WORK-001-C005: R-P0-005 — Define or pull JuryPulse™
Wave: C
Priority: P2
Scope: M
Agent: claude-in-chat
Depends-on: CEO decision
CEO_GATE: YES
FIZ: NO
Source: Deficit doc R-P0-005
Status: QUEUED
Directive: Add Part J or appendix to v2.8 plan defining JuryPulse™ structure, mechanism, and "twelfth lens" function. ALTERNATIVELY: pull JuryPulse references from v2.8 entirely if not ready. CEO chooses define vs pull. Resolution unblocks deficit row R-017.
```

```
CNZ-WORK-001-C006: R-P0-006 — Fix NOWPayments vs NOWPayouts naming
Wave: C
Priority: P2
Scope: S
Agent: claude-in-chat
Depends-on: none
CEO_GATE: NO
FIZ: NO
Source: Deficit doc R-P0-006
Status: QUEUED
Directive: Amend v2.8 changelog entry "B.5.9 NOWPayments™ added" to "B.5.9 NOWPayouts™ (nowpayments.com integration) added". The internal OQMInc™ layer is NOWPayouts™; nowpayments.com is the external vendor. There is no NOWPayments™ trademark.
```

```
CNZ-WORK-001-C007: R-P0-007 — Cite or qualify technical claims
Wave: C
Priority: P1
Scope: M
Agent: claude-in-chat
Depends-on: none
CEO_GATE: YES (per-claim sign-off)
FIZ: NO
Source: Deficit doc R-P0-007
Status: QUEUED
Directive: Cite or qualify each of: zk-SNARK production claim (§B.5.3 F4), federation-as-production claim (§B.5.3 F2), 72–85% precision/recall claim (§B.5.3 F1, currently uncited), 200ms latency budget (§B.5.1/§B.5.3, unanalyzed), HeartPleasure heart-rate-as-Flicker n'Flame Scoring-input (§B.7.1, no engineering pathway). Required before next investor pass.
```

```
CNZ-WORK-001-C008: R-P0-008 — Differentiate Day 91 Parity vs Pixel Legacy
Wave: C
Priority: P3
Scope: S
Agent: claude-in-chat
Depends-on: none
CEO_GATE: NO
FIZ: NO
Source: Deficit doc R-P0-008
Status: QUEUED
Directive: Make the differentiation explicit: Day 91 Parity grants full 7.5–9¢ range to all Days 1–90 sign-ups; Pixel Legacy gives the first 3,000 a 90-day temporal head start plus the Signing Bonus. Add one paragraph to §B.4.4 clarifying.
```

```
CNZ-WORK-001-C099: WAVE C CLEANUP
Wave: C
Priority: P1
Scope: S
Agent: claude-in-chat
Depends-on: C001 through C008
CEO_GATE: NO
FIZ: NO
Source: Wave cadence (§3)
Status: QUEUED
Directive: Confirm v2.8 plan reflects all eight amendments. Update v2.8 changelog with amendment list. File summary REPORT_BACK.
```

-----

### WAVE D — VERIFICATION & EXTENSION OF L0 SPINE

The eight services declared in the previous priority order. Verify-then-extend per Corpus L0 ship-gate requirements. Each row is prefixed with the deficit doc reference.

```
CNZ-WORK-001-D001: R-101 — Three-Bucket Wallet verify + extend
Wave: D
Priority: P0
Scope: M
Agent: claude-code
Depends-on: A001
CEO_GATE: NO (FIZ flag handles merge gating)
FIZ: YES
Source: Deficit doc R-101; Corpus Ch.1 §4, Ch.7 §5
Status: QUEUED
Directive: VERIFY: confirm three buckets are Promotional Bonus / Membership Allocation / Purchased Tokens (Corpus Ch.1 §4) and spend order is enforced 1→2→3. Confirm idempotent purchase endpoints, processor confirmation gating, no fractional tokens, ledger immutability per Corpus Ch.1 §5. EXTEND as needed to close gaps. FIZ-scoped commits required.
```

```
CNZ-WORK-001-D002: R-002/R-102 — Risk Engine verify + extend to full Risk Assessment Toolkit
Wave: D
Priority: P0
Scope: M
Agent: claude-code
Depends-on: A001
CEO_GATE: NO
FIZ: NO (compliance-adjacent but not ledger)
Source: Deficit doc R-002, R-102; Corpus Ch.1 §10, Ch.3 §6, Ch.7 §11
Status: QUEUED
Directive: Step 1: VERIFY services/risk/ exists and inventory current capabilities. Step 2: extend to cover full Risk Assessment Toolkit per plan: VAMP threshold hardening (0.75% per Corpus Ch.7 §11), 3DS2 enforcement, dispute lifecycle, chargeback isolation. Confirm whether Welfare Guardian Score (R-013) is sub-component of Risk Engine or independent (depends on R-CLARIFY-008).
```

```
CNZ-WORK-001-D003: R-103 — NATS Fabric verify
Wave: D
Priority: P0
Scope: M
Agent: claude-code
Depends-on: A001
CEO_GATE: NO
FIZ: NO
Source: Deficit doc R-103; Corpus Ch.7 §3
Status: QUEUED
Directive: VERIFY NATS deployment and that all chat and haptic events route via NATS (no REST polling, per OQMI_GOVERNANCE.md invariants). Confirm event schema includes mandatory fields per Corpus Ch.7 §3.1.
```

```
CNZ-WORK-001-D004: R-104 — OBS Broadcast Kernel verify + extend
Wave: D
Priority: P0
Scope: L
Agent: claude-code
Depends-on: A001, D006 (FairPay native vs OBS detection integrity)
CEO_GATE: NO
FIZ: NO
Source: Deficit doc R-104
Status: QUEUED
Directive: VERIFY current state. EXTEND to cover multi-stream relay, One-Button Private feature, and the native vs OBS relay detection mechanism that D006 depends on. Detection integrity is the highest-risk element per CEO memory — implement with auditable detection trail.
```

```
CNZ-WORK-001-D005: R-105 — HeartZone IoT Loop verify + extend
Wave: D
Priority: P1
Scope: L
Agent: claude-code
Depends-on: A001, B001 (R-CLARIFY-010)
CEO_GATE: NO
FIZ: NO
Source: Deficit doc R-105
Status: QUEUED
Directive: BLOCKED until R-CLARIFY-010 resolved (HeartZone IoT Loop ↔ HeartPleasureExperiences™ relationship). Once clarified, VERIFY current state (Web Bluetooth, GATT 0x180D, haptic webhooks per prior doctrine), EXTEND to plan-described capability.
```

```
CNZ-WORK-001-D006: R-006 — FairPay/FairPlay™ rate logic
Wave: D
Priority: P0
Scope: M
Agent: claude-code
Depends-on: A001, B001 (R-CLARIFY-004)
CEO_GATE: NO
FIZ: YES
Source: Deficit doc R-006
Status: QUEUED
Directive: BLOCKED until R-CLARIFY-004 resolved (FairPay inside Wallet or separate). Once clarified, EXTEND chosen service to implement rate engine for native streamer vs OBS relay tier (loyalty bonus framing per CEO memory). Audit rate decisions. Detection integrity for native vs OBS classification is highest execution risk per CEO — implement with full audit trail. FIZ-scoped commits required.
```

```
CNZ-WORK-001-D007: R-106 — Bijou.Zone Theatre verify + extend
Wave: D
Priority: P1
Scope: L
Agent: claude-code
Depends-on: A001, B001 (R-CLARIFY-011)
CEO_GATE: NO
FIZ: NO
Source: Deficit doc R-106
Status: QUEUED
Directive: BLOCKED until R-CLARIFY-011 resolved (Bijou.Zone Theatre Park scope). Once clarified, VERIFY (LiveKit/Mediasoup SFU, Dwell-Credit algorithm), EXTEND to cover whichever Park(s) are in scope.
```

```
CNZ-WORK-001-D008: R-007/R-107 — Compliance Stack extend to full jurisdictional matrix
Wave: D
Priority: P0
Scope: L
Agent: claude-code
Depends-on: A001
CEO_GATE: NO
FIZ: NO (but compliance-constants additions are §2.2 Human-Review)
Source: Deficit doc R-007, R-107; Corpus Ch.3
Status: QUEUED
Directive: Step 1: VERIFY governance/ contents from A001. Step 2: extend Sovereign CaC to cover full Corpus Ch.3 jurisdictional matrix (US 2257/2257A, DMCA, FinCEN, PIPEDA, GDPR, DSA, PCI-DSS, NCII frameworks). Per Corpus Ch.3 §11: rules must be configurable, documented, versioned, never hard-coded invisibly. Any new compliance constants are OQMI_GOVERNANCE §2.2 Human-Review Category.
```

```
CNZ-WORK-001-D099: WAVE D CLEANUP
Wave: D
Priority: P0
Scope: S
Agent: copilot
Depends-on: D001 through D008
CEO_GATE: NO
FIZ: NO
Source: Wave cadence (§3)
Status: QUEUED
Directive: Lint pass on services/ work. Test triage. Confirm OQMI_SYSTEM_STATE.md §2 service inventory updated to reflect verified statuses. Roll up Wave D REPORT_BACKs.
```

-----

### WAVE E — NET-NEW L0 BUILD (P0 STACK ASSETS)

```
CNZ-WORK-001-E001: R-001 — RedBook (likely EXTEND of safety/)
Wave: E
Priority: P0
Scope: L
Agent: claude-code
Depends-on: A001
CEO_GATE: NO
FIZ: NO
Source: Deficit doc R-001; Corpus Ch.3 §5–7
Status: QUEUED
Directive: Step 1: VERIFY safety/ contents from A001 — report whether RedBook scaffolding exists. Step 2 (if absent): BUILD-NEW per Corpus Ch.3 §5–7 incident architecture: incident object, severity classification (SEV1/2/3), state machine (RECEIVED→VERIFIED→ACTIONED→CLOSED), evidence preservation, hash registry for re-upload prevention. RedBook is plan vocabulary for the Corpus-defined incident/safety system. Plan extends with RedBook-specific naming/UX.
```

```
CNZ-WORK-001-E002: R-014 — NOWPayouts™ integration layer
Wave: E
Priority: P0
Scope: L
Agent: claude-code
Depends-on: D006, C006
CEO_GATE: NO
FIZ: YES
Source: Deficit doc R-014; Corpus Ch.7 §11
Status: QUEUED
Directive: BUILD-NEW integration layer to nowpayments.com per Corpus Ch.7 §11 webhook verification (signature validation, idempotency key, replay prevention, raw payload hash logging). FIZ-scoped commits required.
```

```
CNZ-WORK-001-E003: R-010 — GateGuard Sentinel™ full system
Wave: E
Priority: P0
Scope: L
Agent: claude-code
Depends-on: D008, E001 (RedBook integration), A001
CEO_GATE: NO
FIZ: NO
Source: Deficit doc R-010
Status: QUEUED
Directive: Sovereign CaC implements the age-gating subset (Corpus Ch.3 §3). EXTEND to cover the full plan-described GateGuard Sentinel six features: pre-processor risk evaluation, identity assurance per Corpus Ch.3 §4 (two-ID rule, liveness, vault segregation, "18+ at recorded_at"), publish gate enforcement, hash-based re-upload prevention (Ch.3 §5.3), takedown SLA, and integration with RedBook (E001). NOTE: GateGuard prototype v0.4 was incomplete per Thread 16 §3.5; recommend regenerate cleanly under new directive workflow rather than extending the prototype.
```

```
CNZ-WORK-001-E099: WAVE E CLEANUP
Wave: E
Priority: P0
Scope: S
Agent: copilot
Depends-on: E001, E002, E003
CEO_GATE: NO
FIZ: NO
Source: Wave cadence (§3)
Status: QUEUED
Directive: Confirm net-new L0 services have integration tests, audit logging per OQMI_GOVERNANCE §6.5, and OQMI_SYSTEM_STATE.md §2/§3 updated. Roll up Wave E REPORT_BACKs.
```

-----

### WAVE F — PLAN IP LAYER (P1 STACK ASSETS, MOSTLY CLARIFY-BLOCKED)

```
CNZ-WORK-001-F001: R-003 — CreatorControl.Zone™
Wave: F
Priority: P1
Scope: L
Agent: claude-code
Depends-on: B001 (R-CLARIFY-001)
CEO_GATE: NO
FIZ: NO
Source: Deficit doc R-003
Status: QUEUED
Directive: BLOCKED until R-CLARIFY-001 resolved (CreatorControl.Zone™ scope vs My Zone Manager™). Once clarified, BUILD-NEW per defined scope. Default proposed scope: creator-facing dashboard for rate card management, schedule control, payout visibility, promotional opt-in.
```

```
CNZ-WORK-001-F002: R-004 — MyCrew.Zone™
Wave: F
Priority: P1
Scope: L
Agent: claude-code
Depends-on: B001 (R-CLARIFY-002)
CEO_GATE: NO
FIZ: NO
Source: Deficit doc R-004
Status: QUEUED
Directive: BLOCKED until R-CLARIFY-002 resolved (custom service vs Twenty CRM integration vs hybrid). Once clarified, BUILD-NEW per chosen approach. If integration: define which Twenty CRM objects/schemas are required and build integration layer.
```

```
CNZ-WORK-001-F003: R-005 — Flicker n'Flame Scoring (FFS)
Wave: F
Priority: P1
Scope: M
Agent: claude-code
Depends-on: B001 (R-CLARIFY-003)
CEO_GATE: NO
FIZ: NO
Source: Deficit doc R-005
Status: QUEUED
Directive: BLOCKED until R-CLARIFY-003 resolved (standalone vs feature of HeartZone vs feature of Bijou vs shared). Once clarified, BUILD-NEW (if standalone) or EXTEND parent service (if feature). Tied to plan §B.5.3 F1 precision/recall claim flagged in C007.
```

```
CNZ-WORK-001-F004: R-008 — DFSP™
Wave: F
Priority: P1
Scope: L
Agent: claude-code
Depends-on: B001 (R-CLARIFY-005)
CEO_GATE: NO
FIZ: NO
Source: Deficit doc R-008
Status: QUEUED
Directive: BLOCKED until R-CLARIFY-005 resolved (define DFSP™ acronym and scope; relationship to Welfare Guardian Score). Once defined, BUILD-NEW per scope.
```

```
CNZ-WORK-001-F005: R-009 — Human Contact Zone
Wave: F
Priority: P1
Scope: L
Agent: claude-code
Depends-on: B001 (R-CLARIFY-006), A012
CEO_GATE: NO
FIZ: NO
Source: Deficit doc R-009
Status: QUEUED
Directive: BLOCKED until R-CLARIFY-006 resolved (HCZ separate from HeartZone; commit prefix). Once clarified, BUILD-NEW. Likely separate operational layer (human moderator/concierge/support) vs HeartZone (IoT/biometric).
```

```
CNZ-WORK-001-F006: R-012 — Diamond Concierge
Wave: F
Priority: P1
Scope: L
Agent: claude-code
Depends-on: C003 (Diamond tier in canonical enum, post-R-P0-002)
CEO_GATE: NO
FIZ: NO
Source: Deficit doc R-012; project-knowledge Diamond_VIP_Protocol_Operations_Manual.docx
Status: QUEUED
Directive: BUILD-NEW per project-knowledge Diamond_VIP_Protocol_Operations_Manual.docx. Service handles VIP_DIAMOND tier concierge workflows. Read manual before implementation.
```

```
CNZ-WORK-001-F007: R-013 — Welfare Guardian Score
Wave: F
Priority: P1
Scope: M
Agent: claude-code
Depends-on: B001 (R-CLARIFY-008), D002
CEO_GATE: NO
FIZ: NO
Source: Deficit doc R-013; Corpus Ch.4 §6.3
Status: QUEUED
Directive: BLOCKED until R-CLARIFY-008 resolved (subsume into Risk Engine vs standalone). Per Corpus Ch.4 §6.3, HSV is non-gating and non-punitive. WGS likely follows same pattern. Implement as advisory, never as enforcement.
```

```
CNZ-WORK-001-F008: R-015 — RedRoomRewards™ scope decision
Wave: F
Priority: P2
Scope: UNKNOWN
Agent: claude-in-chat
Depends-on: B001 (R-CLARIFY-009)
CEO_GATE: YES
FIZ: NO
Source: Deficit doc R-015
Status: QUEUED
Directive: BLOCKED until R-CLARIFY-009 resolved (separate repo or inside ChatNowZone--BUILD). If separate repo, this row retires from this charter. If inside, define scope and convert to BUILD-NEW task(s).
```

```
CNZ-WORK-001-F009: R-017 — JuryPulse™
Wave: F
Priority: P3
Scope: UNKNOWN
Agent: claude-in-chat
Depends-on: C005
CEO_GATE: YES
FIZ: NO
Source: Deficit doc R-017
Status: QUEUED
Directive: BLOCKED on C005. Once plan defines JuryPulse™ structure (or pulls reference), return to this row and convert to BUILD-NEW or RETIRE.
```

```
CNZ-WORK-001-F099: WAVE F CLEANUP
Wave: F
Priority: P1
Scope: S
Agent: copilot
Depends-on: F001 through F009
CEO_GATE: NO
FIZ: NO
Source: Wave cadence (§3)
Status: QUEUED
Directive: Confirm Plan IP services have tests, integration with the L0 spine, OQMI_SYSTEM_STATE.md updates. Roll up Wave F REPORT_BACKs.
```

-----

### WAVE G — XL DECOMPOSITION OUTPUTS

These are placeholder slots. Actual rows authored by tasks B002 (Cyrano) and B003 (Black-Glass) once R-CLARIFY answers land.

```
CNZ-WORK-001-G001..GNNN: Cyrano per-layer tasks
Wave: G
Source: Decomposition by B002 from R-011
Status: PENDING-DECOMPOSITION
Directive: Per-layer Cyrano build tasks land here once B002 completes. Each layer = one M/L row.
```

```
CNZ-WORK-001-G101..G199: Black-Glass Interface per-feature tasks
Wave: G
Source: Decomposition by B003 from R-108
Status: PENDING-DECOMPOSITION
Directive: Per-feature Black-Glass build tasks land here once B003 completes. Compliance gates UI, RBAC enforcement, kill switch UI, consent workflow UI, age gate UI, wallet integrity UI per Corpus Ch.6 are minimum decomposition units.
```

```
CNZ-WORK-001-G099: WAVE G CLEANUP
Wave: G
Priority: P0
Scope: S
Agent: copilot
Depends-on: All G0NN and G1NN tasks
CEO_GATE: NO
FIZ: NO
Source: Wave cadence (§3)
Status: QUEUED
Directive: Confirm decomposed tasks all completed and integrated. UI/UX QA pass against Corpus Ch.6 visual identity. Roll up Wave G REPORT_BACKs.
```

-----

### WAVE H — HARDENING & PRE-LAUNCH CLEANUP

```
CNZ-WORK-001-H001: CI guard against hardcoded financial constants
Wave: H
Priority: P0
Scope: M
Agent: claude-code
Depends-on: D001
CEO_GATE: NO
FIZ: NO
Source: OQMI_GOVERNANCE.md §5.2
Status: QUEUED
Directive: Implement CI check that fails any PR introducing hardcoded balance values, fixture leak from tests/ into src/, or financial constants outside the declared config file. Per OQMI_GOVERNANCE §5.2.
```

```
CNZ-WORK-001-H002: CI guard against missing tenant_id scope
Wave: H
Priority: P0
Scope: M
Agent: claude-code
Depends-on: A001
CEO_GATE: NO
FIZ: NO
Source: OQMI_GOVERNANCE.md tenant isolation invariants
Status: QUEUED
Directive: Implement CI check that fails any PR introducing a query against a tenant-scoped model that doesn't include tenant_id in its filter.
```

```
CNZ-WORK-001-H003: LedgerService invariant tests
Wave: H
Priority: P0
Scope: M
Agent: claude-code
Depends-on: D001
CEO_GATE: NO
FIZ: YES
Source: OQMI_GOVERNANCE.md §5.1
Status: QUEUED
Directive: Implement test suite for LedgerService invariants: double-entry sum, sequence gap detection, idempotency-key replay protection, append-only enforcement (no UPDATE/DELETE on ledger tables). FIZ-scoped commits required.
```

```
CNZ-WORK-001-H004: Audit chain integration tests
Wave: H
Priority: P0
Scope: M
Agent: claude-code
Depends-on: D008
CEO_GATE: NO
FIZ: NO
Source: OQMI_GOVERNANCE.md §6.5; Corpus Ch.3 §10, Ch.7 §4
Status: QUEUED
Directive: Implement integration tests verifying audit-chain hash continuity, WORM export, and required field presence (event_id, event_type, actor_id, role, timestamp_utc, platform_time, rule_applied_id, hash_prev, hash_current, payload_reference) across all sensitive actions.
```

```
CNZ-WORK-001-H005: Step-up authentication wiring
Wave: H
Priority: P0
Scope: L
Agent: claude-code
Depends-on: D001, D008
CEO_GATE: NO
FIZ: NO
Source: OQMI_GOVERNANCE.md §6.4; Corpus Ch.2 §11, Ch.7 §8.2
Status: QUEUED
Directive: Implement step-up authentication on all sensitive operations per OQMI_GOVERNANCE §6.4: wallet/balance modification, payment detail changes, account suspension/freeze, content takedown/deletion, refund override, geo-block modification, break-glass actions. Accepted mechanisms: TOTP (RFC 6238), single-use hashed backup codes, device-based authentication. SMS NOT primary.
```

```
CNZ-WORK-001-H006: Read remaining Canonical Corpus chapters
Wave: H
Priority: P1
Scope: M
Agent: claude-in-chat
Depends-on: none
CEO_GATE: NO
FIZ: NO
Source: Thread 18 handoff §6.D
Status: QUEUED
Directive: Read Canonical Corpus v10 Chapters 8 §3 onward + Chapters 9–10 + appendices (Master Glossary, Escalation Matrix, Funds Flow Diagram, Audit Chain Diagram, RBAC Permission Ladder, Incident Lifecycle Flow, Data Retention Matrix, AI Advisory Boundary Diagram, Evidence Packet Schema, L0 Ship Gate Visual, Version Log). File any new requirements as additional CNZ-WORK-001 tasks. Master Glossary and RBAC Permission Ladder may pre-resolve open clarifies.
```

```
CNZ-WORK-001-H007: Pre-launch L0 ship-gate audit
Wave: H
Priority: P0
Scope: M
Agent: claude-in-chat (audits) → CEO (signs)
Depends-on: All Wave D, E, F, G, and prior Wave H tasks
CEO_GATE: YES
FIZ: NO
Source: Corpus L0 ship-gate doctrine; Deficit doc §5.4
Status: QUEUED
Directive: Audit launch-blocking set against Corpus L0 ship gate: Three-Bucket Wallet (D001), Risk Engine (D002), NATS Fabric (D003), OBS Broadcast Kernel (D004), FairPay + NOWPayouts (D006, E002), RedBook (E001), Compliance Stack (D008), GateGuard Sentinel (E003), Black-Glass Interface (G101+), banned-entity residual deletion (C001, §12). Produce sign-off REPORT_BACK. CEO signs before launch.
```

```
CNZ-WORK-001-H099: WAVE H CLEANUP / LAUNCH READY
Wave: H
Priority: P0
Scope: S
Agent: copilot
Depends-on: All H0NN tasks including H007
CEO_GATE: YES
FIZ: NO
Source: Wave cadence (§3)
Status: QUEUED
Directive: Final lint, dead-code, doc consistency pass. Confirm OQMI_SYSTEM_STATE.md reflects launch-ready state. Confirm all 36 deficit doc rows are accounted for (DONE, RETIRED, or explicitly deferred post-launch with CEO sign-off). Tag release. CEO signs launch-ready.
```

-----

## 7. CROSS-REFERENCE — DEFICIT DOC ROW → CHARTER TASK ID

Quick lookup. Every deficit doc row (Thread 18, 36 rows) maps to one or more tasks in this charter, OR is explicitly retired.

|Deficit row                         |Charter task(s)     |Notes                                     |
|------------------------------------|--------------------|------------------------------------------|
|R-P0-001                            |C002                |Plan amendment                            |
|R-P0-002                            |C003                |Plan amendment                            |
|R-P0-003                            |C001                |Plan amendment, P0                        |
|R-P0-004                            |C004                |Plan amendment, CFO sign                  |
|R-P0-005                            |C005                |Plan amendment, CEO decides               |
|R-P0-006                            |C006                |Plan amendment                            |
|R-P0-007                            |C007                |Plan amendment                            |
|R-P0-008                            |C008                |Plan amendment                            |
|R-001 RedBook                       |E001                |P0 launch-blocking                        |
|R-002 Risk Toolkit                  |D002                |merged with R-102                         |
|R-003 CreatorControl.Zone           |F001                |clarify-blocked                           |
|R-004 MyCrew.Zone                   |F002                |clarify-blocked                           |
|R-005 Flicker n'Flame Scoring (FFS)              |F003                |clarify-blocked                           |
|R-006 FairPay/FairPlay              |D006                |clarify-blocked, FIZ                      |
|R-007 Compliance Stack              |D008                |merged with R-107                         |
|R-008 DFSP                          |F004                |clarify-blocked                           |
|R-009 Human Contact Zone            |F005                |clarify-blocked                           |
|R-010 GateGuard Sentinel            |E003                |P0 launch-blocking                        |
|R-011 Cyrano                        |B002 → G001..GNNN   |XL decomposition                          |
|R-012 Diamond Concierge             |F006                |depends on C003                           |
|R-013 Welfare Guardian Score        |F007                |clarify-blocked                           |
|R-014 NOWPayouts                    |E002                |P0 launch-blocking, FIZ                   |
|R-015 RedRoomRewards                |F008                |clarify-blocked                           |
|R-016 RedRoomPleasures              |RETIRED             |Out of scope (separate WordPress property)|
|R-017 JuryPulse                     |F009                |depends on C005                           |
|R-101 Three-Bucket Wallet           |D001                |FIZ                                       |
|R-102 Risk Engine                   |D002                |merged with R-002                         |
|R-103 NATS Fabric                   |D003                |                                          |
|R-104 OBS Broadcast Kernel          |D004                |depends on D006                           |
|R-105 HeartZone IoT Loop            |D005                |clarify-blocked                           |
|R-106 Bijou.Zone Theatre            |D007                |clarify-blocked                           |
|R-107 Sovereign CaC                 |D008                |merged with R-007                         |
|R-108 UI / Black-Glass              |B003 → G101..G199   |XL decomposition                          |
|R-CLARIFY-001..012                  |B001                |consolidated decision pass                |
|Cleanup 4.1 (DIRECTIVES status)     |A001, A011          |                                          |
|Cleanup 4.2 (services inventory)    |A001                |                                          |
|Cleanup 4.3 (Sovereign Kernel)      |A005                |                                          |
|Cleanup 4.4 (apps/ absence)         |B001 (R-CLARIFY-012)|                                          |
|Cleanup 4.5 (Ghost Alpha definition)|A004                |                                          |
|Cleanup 4.6 (chore-update branch)   |A008                |                                          |
|Cleanup 4.7 (KIMI references)       |A001 (verify), A099 |                                          |
|Cleanup 4.8 (repo visibility)       |A014                |                                          |
|Cleanup 4.9 (RRR_CEO_DECISIONS)     |A010                |                                          |
|Cleanup 4.10 (stale branches)       |A009                |                                          |

-----

## 8. AMENDMENT PROCEDURE

This charter is amended, not replaced. To amend:

1. Open a PR modifying this file
1. Add new task(s) at the appropriate Wave with the next sequential ID
1. Or amend an existing task’s `Status:` line in-place
1. Update §7 cross-reference table if applicable
1. Update OQMI_SYSTEM_STATE.md §5 OUTSTANDING in the same PR

Auto-merge per OQMI_GOVERNANCE.md §2.1 unless the amendment touches a §2.2 Human-Review Category (rare for this charter).

To retire this charter: CEO authors a successor (e.g. CNZ-WORK-002), explicitly marks this one RETIRED, and moves it to `archive/charters/CNZ-WORK-001.md`.

-----

## 9. INVARIANT INHERITANCE

Every task in this charter inherits the invariants of OQMI_GOVERNANCE.md without restatement:

- §5.1 append-only, deterministic, idempotent
- §5.2 schema discipline (correlation_id, reason_code, no hardcoded constants)
- §5.3 Yarn-only package management
- §5.4 domain separation
- §5.5 no backdoors
- §6.1 secrets posture
- §6.2 network isolation
- §6.4 step-up authentication on sensitive actions
- §6.5 audit logging
- §7 advisory-AI boundary
- §8 commit discipline (FIZ four-line format on financial-integrity paths)
- §12 invariants quick-reference register

A task that would violate an invariant is invalid. An agent that detects a conflict HARD_STOPs and reports per OQMI_GOVERNANCE.md §3.

-----

## 10. REPORT_BACK PROTOCOL

Every task generates a REPORT_BACK at `PROGRAM_CONTROL/REPORT_BACK/CNZ-WORK-001-<task-id>-report.md` on completion or block. Format:

```
# CNZ-WORK-001-<task-id> — <name>

**Status on completion:** DONE | BLOCKED | PARTIAL
**Agent:** <copilot | claude-code | claude-in-chat>
**Date:** YYYY-MM-DD
**PR:** #NNN (or "n/a")
**Merge commit SHA:** <sha> (or "n/a")

## What was done
<bullet list of concrete actions taken>

## What was found / surfaced
<any discoveries, anomalies, dependencies revealed>

## What's left
<if PARTIAL or BLOCKED, what remains and why>

## Files touched
<list>

## Tests added / modified
<list>

## OQMI_SYSTEM_STATE.md updates landed in same PR
- §3 DONE: <yes/no, what>
- §5 OUTSTANDING: <yes/no, what>
- §6 BLOCKERS: <yes/no, what>
```

-----

## 11. DONE-RECORD TEMPLATE

When a task completes and merges, write `PROGRAM_CONTROL/DIRECTIVES/DONE/CNZ-WORK-001-<task-id>-DONE.md`:

```
# CNZ-WORK-001-<task-id> — DONE

**Task name:** <name>
**Wave:** <A–H>
**Completed:** YYYY-MM-DD
**Agent:** <copilot | claude-code | claude-in-chat>
**PR:** #NNN
**Merge commit SHA:** <sha>
**REPORT_BACK:** <link to report file>

## Summary
<one-paragraph description of what was delivered>

## Files merged
<list>

## Follow-ups (if any)
<new tasks generated, deferred items, etc.>
```

Then amend the task’s `Status:` line in §6 of this charter from `QUEUED` (or `CLAIMED` / `IN-REVIEW`) to `DONE — <PR> — <DONE-record-filename>`.

-----

## 12. END OF CHARTER

This is the active work charter for ChatNow.Zone. It is a list of tasks, not a governance document. Governance lives in OQMI_GOVERNANCE.md. State lives in OQMI_SYSTEM_STATE.md. Tasks live here.

**Authority:** Kevin B. Hartley, CEO — OmniQuest Media Inc.
**Charter ID:** CNZ-WORK-001
**Total tasks at open:** 14 (Wave A) + 3 (Wave B) + 8 (Wave C) + 8 (Wave D) + 3 (Wave E) + 9 (Wave F) + 2 (Wave G placeholders) + 7 (Wave H) + 8 cleanup = **62 tasks**, of which Wave G will expand significantly post-decomposition.