# OQMI SYSTEM STATE

**Document:** OQMI_SYSTEM_STATE.md
**Repo:** OmniQuestMediaInc/ChatNowZone--BUILD
**Version:** v1.0
**Last Updated:** 2026-04-23
**Owner:** Kevin B. Hartley, CEO — OmniQuest Media Inc.
**Governing Document:** `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_GOVERNANCE.md`

---

## 0. PURPOSE

This document is the living tech-debt and accomplishment tracker for this repository. It answers, at any point in time, three questions:

1. **DONE** — What has been built and is in production or merged to `main`?
2. **WIP** — What is actively in progress, on which branch, by which agent?
3. **OUTSTANDING** — What remains to be built, in what priority order, with what blockers?

It is NOT a doctrine document. Doctrine lives in `OQMI_GOVERNANCE.md` (generic, repo-portable) and, where applicable, in this repo's product Canonical Corpus.

This document is rescoped from prior versions which carried doctrine inline. Doctrine has been moved to `OQMI_GOVERNANCE.md`. This file now tracks state only.

This document is repo-specific in content and repo-portable in shape. Drop the structure into any OmniQuest Media Inc. repo and populate.

---

## 1. REPO ORIENTATION

| Field | Value |
|---|---|
| Repo name | ChatNowZone--BUILD |
| Repo URL | https://github.com/OmniQuestMediaInc/ChatNowZone--BUILD |
| Default branch | `main` |
| Package manager | Yarn (per OQMI_GOVERNANCE §5.3) |
| Primary languages | [pending full repo language survey] |
| Active build epic | CNZ-WORK-001 (active charter; hard launch 2026-04-30) |
| Hard launch deadline | 2026-04-30 |
| Visibility | private (confirmed by CEO 2026-04-23; CNZ-WORK-001-A014) |

---

## 2. SERVICE INVENTORY

List every service, app, or top-level module in the repo with its current state. Update on add/remove/rename.

| Service / Module | Path | Status | Owner Agent | Notes |
|---|---|---|---|---|
| [e.g., three-bucket-wallet] | `services/wallet/` | DONE | claude-code | Idempotent, ledger-tested |
| [e.g., risk-engine] | `services/risk/` | WIP | copilot | Branch: `feature/vamp-hardening` |
| [e.g., heartzone-iot-loop] | `services/heartzone/` | OUTSTANDING | unassigned | Blocked on hardware spec |

Status values: `DONE`, `WIP`, `OUTSTANDING`, `STUB`, `RETIRED`, `BLOCKED`

---

## 3. DONE — Shipped to `main`

Reverse-chronological list of completed work. Each entry one row. Pruning policy: items older than 90 days may be archived to `OQMI_SYSTEM_STATE_ARCHIVE.md` to keep this file scannable.

| Date | Item | PR / Commit | Agent | Notes |
|---|---|---|---|---|
| 2026-04-22 | CNZ-WORK-001-A001 — Q-000-PRE-READ-AUDIT (foundational repo audit) | direct-land *(SHA not recovered — pre-charter, predates accessible git history; backfill-needed)* | claude-code | Agent-hint "copilot" overridden per charter §2; DONE record `CNZ-WORK-001-A001-DONE.md` |
| 2026-04-22 | CNZ-WORK-001-A004 — Ghost Alpha provenance landed in §8 | direct-land `71c526cec4c3d39cc6da2b5df9784d52956bee8e` | copilot | Prerequisite for A003 (root README.md deletion); DONE record `CNZ-WORK-001-A004-DONE.md` |
| 2026-04-23 | CNZ-WORK-001-A012 — Canonical commit prefix enum + resolve R-CLARIFY-006 prefix half | PR pending (branch `claude/continue-cnz-work-001-EJKhg`) | claude-code | Enum landed in `docs/DOMAIN_GLOSSARY.md`; cross-linked from `OQMI_GOVERNANCE.md §8.1`; HZ kept as HeartZone IoT, HCZ confirmed as Guest Services bureau; DONE record `CNZ-WORK-001-A012-DONE.md` |
| 2026-04-23 | CNZ-WORK-001-A014 — Repo visibility confirmed PRIVATE (paperwork) | PR pending (branch `claude/continue-cnz-work-001-EJKhg`) | claude-code | CEO-action task; CEO confirmed repo private 2026-04-23; agent landed §1 Visibility amendment and DONE record `CNZ-WORK-001-A014-DONE.md` |
| 2026-04-23 | CNZ-WORK-001-A002 — Verify CLAUDE.md absent from repo root | PR pending | claude-code | Already absent at task start; only `archive/governance/CLAUDE.md` exists (historical archive — left in place) |
| 2026-04-23 | CNZ-WORK-001-A003 — Delete README.md from repo root | PR pending | claude-code | Ghost Alpha provenance preserved by A004 prior |
| 2026-04-23 | CNZ-WORK-001-A005 — Archive Sovereign_Kernel.md.pdf | PR pending | claude-code | Moved to `archive/governance/Sovereign_Kernel.md.pdf`; inbound refs updated in `REPO_MANIFEST.md`, `.github/copilot-instructions.md`, `OQMI_SYSTEM_STATE.md §8` |
| 2026-04-23 | CNZ-WORK-001-A006 — Delete root OQMI_SYSTEM_STATE.md (v2.0 doctrine) | PR pending | claude-code | `.github/required-files.txt` updated to QUEUE-path so CI validate-structure stays green; `.github/copilot-instructions.md` header pointer fixed |
| 2026-04-23 | CNZ-WORK-001-A007 — Verify package-lock.json absence | PR pending | claude-code | Already absent at task start; yarn.lock authoritative; no CI workflow reference to package-lock.json |
| 2026-04-23 | CNZ-WORK-001-A008 — Audit copilot/chore-update-program-control branch | PR pending | claude-code | REPORT-ONLY; branch not present on origin; recommendation: no action |
| 2026-04-23 | CNZ-WORK-001-A009 — Stale branch report | PR pending | claude-code | REPORT-ONLY; 10 remote branches enumerated and classified; no deletions |
| 2026-04-23 | CNZ-WORK-001-A010 — Locate RRR_CEO_DECISIONS_FINAL_2026-04-17.md | PR pending | claude-code | FOUND at `docs/RRR_CEO_DECISIONS_FINAL_2026-04-17.md` (115 lines); cross-checked against current canonical decisions — no contradictions |
| 2026-04-23 | CNZ-WORK-001-A011 — Verify PROGRAM_CONTROL subdirectories | PR pending | claude-code | Both `DONE/` and `REPORT_BACK/` present with substantive content |
| 2026-04-23 | CNZ-WORK-001-A013 — OQMI_GOVERNANCE.md path-reference reconciliation | PR pending | claude-code | Directive premise partly incorrect; OQMI_SYSTEM_STATE.md §11 "(this repo, root)" reference fixed; all CNZ docs verified to reference correct PROGRAM_CONTROL/DIRECTIVES/QUEUE/ paths |
| 2026-04-23 | CNZ-WORK-001-A099 — WAVE A CLEANUP | PR pending | claude-code | Wave A complete (A001–A014 all DONE); SoT consistency verified; §7 RETIRED ITEMS updated; lint delegated to CI super-linter; Wave A rollup REPORT_BACK filed; Wave B opens once this PR merges |
| 2026-04-26 | FFS + SenSync™ + VelocityZone + Single CZT — Phase 1 (feature/ffs-sensync-cyrano-upgrade-v2) | PR pending | copilot | Created services/ffs/, services/sensync/, services/velocityzone/; updated NATS registry; added token_type to TokenBalance; Prisma migration 20260426000000_ffs_sensync_velocityzone; ShowZone RETIRED |

---

## 4. WIP — In Progress

Active work. Update when started, when blocked, and when completed (move to §3). One row per branch.

| Branch | Item | Started | Agent | Blocker | Next Action |
|---|---|---|---|---|---|

If a WIP item has been static for >7 days without a blocker, that itself is a flag — surface in §6.

---

## 5. OUTSTANDING — Backlog

Prioritized list of work not yet started. Top of the list is the next thing to work on. CEO sets priority order; agents do not reorder without instruction.

| Priority | Item | Source | Estimated Scope | Blocker | Notes |
|---|---|---|---|---|---|
| 1 | [Highest priority outstanding work] | [e.g., Deficit doc row R-12] | [S/M/L/XL] | [none / what's needed first] | |
| 2 | [Next item] | [Source] | | | |
| 3 | [...] | | | | |

Source values:
- `Deficit doc row [ID]` — derived from technical deficit document
- `Canonical Corpus §[N]` — derived from product Canonical Corpus requirement
- `Business plan §[N]` — derived from business plan technical requirement
- `Bug` — defect found in shipped code
- `CEO directive YYYY-MM-DD` — direct CEO instruction
- `Tech debt` — internal cleanup not driven by external requirement

Scope values: `S` (<1 day), `M` (1–3 days), `L` (3–10 days), `XL` (>10 days, should be decomposed)

---

## 6. BLOCKERS & FLAGS

Active blockers, stalled work, and items requiring CEO attention. Each entry should resolve to either a CEO decision, an external action, or a re-assignment.

| Date Flagged | Item | Type | Owner | What's Needed |
|---|---|---|---|---|
| YYYY-MM-DD | [e.g., HeartZone scope unclear vs HeartPleasureExperiences] | CEO clarification | claude-in-chat | Naming and scope decision |
| YYYY-MM-DD | [e.g., Vendor X integration broken] | External dependency | copilot | Vendor support response |

Type values: `CEO clarification`, `External dependency`, `Tooling`, `Credential`, `Architecture decision`, `Other`

---

## 7. RETIRED ITEMS

Things that were in this repo, have been removed, and should not be reintroduced. Recorded so future agents do not accidentally rebuild retired work.

| Date Retired | Item | Reason |
|---|---|---|
| YYYY-MM-DD | [e.g., Work Order (WO-XXXX) protocol] | Friction without auditability gain; replaced by scoped commit discipline |
| YYYY-MM-DD | [e.g., KIMI peer agent integration] | Agent retired from workflow |
| 2026-04-13 | Root `package-lock.json` | Yarn is canonical per OQMI_GOVERNANCE §5.3; npm-generated noise. Removed by CLEAN-SWEEP-2026-04-13; verified absent by CNZ-WORK-001-A007 (2026-04-23). |
| 2026-04-23 | Root `CLAUDE.md` | Verified absent (likely deleted in Thread 16 directive workflow bootstrap). Authoritative agent instructions live in `.github/copilot-instructions.md` and `PROGRAM_CONTROL/DIRECTIVES/QUEUE/CNZ-CLAUDE-CODE-STANDING-PROMPT.md`. CNZ-WORK-001-A002. |
| 2026-04-23 | Root `README.md` | Single authoritative fact (Ghost Alpha provenance) preserved in §8 by CNZ-WORK-001-A004. Doctrine references in OQMI_GOVERNANCE.md §5.3/§8 to "repo root README.md" are now stale but non-blocking. CNZ-WORK-001-A003. |
| 2026-04-23 | Root `OQMI_SYSTEM_STATE.md` (OQMI CODING DOCTRINE v2.0) | Old v2.0 doctrine version (March 28, 2026, 124 lines). Superseded by `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_SYSTEM_STATE.md` (state) and `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_GOVERNANCE.md` (doctrine). `.github/required-files.txt` updated to point at the QUEUE-path SoT. CNZ-WORK-001-A006. |
| 2026-04-23 | Root `Sovereign_Kernel.md.pdf` (as authoritative source-of-truth) | RETIRED as authoritative; physical file moved to `archive/governance/Sovereign_Kernel.md.pdf` for historical reference. Old OQMI v2.0 enum and RRR-GOV-002 §3.5 commit-prefix enums also retired here for completeness. CNZ-WORK-001-A005 + CNZ-WORK-001-A012. |
| 2026-04-26 | `services/showzone/` — ShowToken logic | Single CZT economy spec §2. ShowToken creation, conversion, allotments removed. NATS topics tombstoned. RETIRED.md added to service folder. feature/ffs-sensync-cyrano-upgrade-v2. |
| 2026-04-26 | `services/heartsync/` — as primary biometric service | Superseded by `services/sensync/` (SenSync™). heartsync/ retained as historical reference; no new code should be added. NATS topics (heartsync.*) tombstoned. feature/ffs-sensync-cyrano-upgrade-v2. |
| 2026-04-26 | `services/room-heat/` — Room-Heat Engine as primary FFS service | Superseded by `services/ffs/` (Flicker n'Flame Scoring). room-heat/ retained as historical reference; no new code should be added. NATS topics (room.heat.*) tombstoned. feature/ffs-sensync-cyrano-upgrade-v2. |
| 2026-04-26 | NATS topics `heartsync.*`, `room.heat.*`, ShowZone topics | Replaced by `sensync.*`, `ffs.score.*`. Tombstones preserved in topics.registry.ts. feature/ffs-sensync-cyrano-upgrade-v2. |

---

## 8. PROVENANCE NOTES

Anything an incoming agent needs to know that doesn't fit elsewhere: terminology that has shifted, files that look authoritative but aren't, branches that look active but are dead, peculiarities of this repo's history.

- `/tests/seed_data/` is the authoritative source for Ghost Alpha simulations. (Preserved from root `README.md` prior to A003 deletion; landed by CNZ-WORK-001-A004 on 2026-04-22.)
- `Sovereign_Kernel.md.pdf` is RETIRED — moved to `archive/governance/Sovereign_Kernel.md.pdf` on 2026-04-23 (CNZ-WORK-001-A005). Do not treat as authoritative.
- Root-level `OQMI_SYSTEM_STATE.md` (OQMI CODING DOCTRINE v2.0, March 28, 2026) is RETIRED — deleted on 2026-04-23 (CNZ-WORK-001-A006). Superseded by this file (PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_SYSTEM_STATE.md) and by OQMI_GOVERNANCE.md.
- Root-level `README.md` deleted on 2026-04-23 (CNZ-WORK-001-A003); its only fact (Ghost Alpha provenance) was preserved by A004 above.
- Commit prefix enum: the canonical list lives in `docs/DOMAIN_GLOSSARY.md` under "COMMIT PREFIX ENUM — CANONICAL" (landed 2026-04-23 by CNZ-WORK-001-A012). The old OQMI v2.0 enum and the RRR-GOV-002 §3.5 enum are retired — consult only the glossary.
- `OQMI_GOVERNANCE.md` was found truncated at §8 on 2026-04-23 (§§9–§12 missing though referenced elsewhere). Flagged in A012 REPORT_BACK for a future governance-scoped restore.
- `.github/copilot-instructions.md` carries large stretches of "OQMI CODING DOCTRINE v2.0" text duplicating content now in OQMI_GOVERNANCE.md and superseded prefix conventions. Header pointer fixed 2026-04-23 (A005/A006); broader doctrine refresh of that file is a follow-up.

---

## 9. THIS DOCUMENT'S OWN STATE

| Field | Value |
|---|---|
| Last full review | 2026-04-23 |
| Reviewed by | claude-code (CNZ-WORK-001-A012 + A014 pass) |
| Stale-flag threshold | 30 days since last update triggers automatic flag |

If this document has not been updated in 30 days but the repo has commits in that window, the document is out of date and the next agent to touch the repo should reconcile it before doing other work.

---

## 10. UPDATE PROTOCOL

Any agent that completes, starts, blocks, retires, or reprioritizes work in this repo MUST update this document in the same PR as the work itself. Updating this file is not Human-Review Category — it auto-merges with the work it documents.

Format discipline:

- Add new rows; do not delete historical ones except via §3 archive policy or §7 retirement
- Use ISO dates (YYYY-MM-DD)
- Use the status enums declared in §2 and source enums declared in §5
- One item per row; if an item has multiple sub-items, decompose into multiple rows or link out to an issue tracker

Failure to update this document on relevant PRs is a §4.4 violation under `OQMI_GOVERNANCE.md`.

---

## 11. END OF DOCUMENT

This document tracks the state of `OmniQuestMediaInc/ChatNowZone--BUILD`. It does not declare doctrine. For doctrine, see `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_GOVERNANCE.md`. For product-specific operational and compliance doctrine, see this repo's program charter `PROGRAM_CONTROL/DIRECTIVES/QUEUE/CNZ-WORK-001.md` and the project doctrine document `PROGRAM_CONTROL/DIRECTIVES/QUEUE/RRR-GOV-002`.

**Authority:** Kevin B. Hartley, CEO — OmniQuest Media Inc.
