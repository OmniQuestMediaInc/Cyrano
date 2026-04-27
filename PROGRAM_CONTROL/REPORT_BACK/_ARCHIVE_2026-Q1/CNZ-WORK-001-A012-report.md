# CNZ-WORK-001-A012 — Reconcile commit prefix enums

**Status on completion:** DONE
**Agent:** claude-code
**Date:** 2026-04-23
**PR:** pending (branch `claude/continue-cnz-work-001-EJKhg`)
**Merge commit SHA:** pending

## What was done

- Surfaced the five CEO decisions required by A012 (enum philosophy, HZ split, net-new domain prefixes, source-enum disposition, FIZ scope) as a single consolidated question set per OQMI_GOVERNANCE §3.3.
- Captured CEO decisions 2026-04-23:
  1. Hybrid enum (FIZ/GOV/CHORE cross-cutting; domain prefixes preserved; layer prefixes retained for non-domain work; most-specific-wins selection rule).
  2. HCZ confirmed distinct from HZ: HCZ is the Guest Services / Customer Services bureau (organizational, human agents); HZ is HeartZone IoT Loop (biometric / Web Bluetooth technology). HZ keeps its existing prefix; HCZ gets its own.
  3. Net-new domains each get their own prefix rather than folding into layer prefixes.
  4. Existing prefixes (NATS, OBS, BIJOU, CRM, GGS, GGS-AV, CYR, SHOWZONE) preserved — not retired.
  5. FIZ scope confirmed to cover NOWPayouts webhooks, three-bucket wallet, and ledger; no additional domains folded in at this time.
- Authored the canonical commit prefix enum in `docs/DOMAIN_GLOSSARY.md` under a new section "COMMIT PREFIX ENUM — CANONICAL":
  - Cross-cutting: `FIZ:`, `GOV:`, `CHORE:`
  - Layer-scoped: `INFRA:`, `DB:`, `API:`, `UI:`, `TEST:`
  - Domain-scoped: `NATS:`, `OBS:`, `BIJOU:`, `CRM:`, `HZ:`, `HCZ:`, `GGS:`, `GGS-AV:`, `CYR:`, `SHOWZONE:`, `REDBOOK:`, `PAY:`, `COMP:`, `BG:`
  - Retired enums: old OQMI v2.0 (root OQMI_SYSTEM_STATE.md) + RRR-GOV-002 §3.5 (notably retires `SVC:`)
  - Dual-prefix patterns: `GGS: + FIZ:`, `PAY: + FIZ:`, and general pattern for any domain touching financial-integrity paths
- Cross-linked the enum from `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_GOVERNANCE.md` via new §8.1 "Commit prefix enum" section. The glossary is declared the naming authority; supersedes any prefix list elsewhere.
- Expanded the HCZ row in `docs/DOMAIN_GLOSSARY.md` VENUES AND ZONES to include the Guest Services / Customer Services bureau framing and the CEO-confirmed distinction from HZ. This resolves the prefix half of R-CLARIFY-006 and the "separateness" half (HCZ vs HZ = distinct systems).
- Updated `PROGRAM_CONTROL/DIRECTIVES/QUEUE/CNZ-WORK-001.md` §6 A012 status line to `DONE — 2026-04-23`.
- Updated `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_SYSTEM_STATE.md` §3 DONE, §8 PROVENANCE NOTES, §9 THIS DOCUMENT'S OWN STATE.
- Filed this REPORT_BACK and the DONE record.

## What was found / surfaced

- **Reconciliation flag against initial proposal.** My original proposed enum introduced `GG` (GateGuard) and `CYRANO` as new prefixes, but the existing `docs/DOMAIN_GLOSSARY.md` already had `GGS:`, `GGS-AV:`, `CYR:`, and `SHOWZONE:` in an older "COMMIT PREFIXES" table. CEO Decision 4 (no retirement of existing domain prefixes) meant the right move was to preserve the existing names rather than rename. Final enum uses `GGS:`/`CYR:`/`SHOWZONE:` (preserved) plus `HCZ:`/`REDBOOK:`/`PAY:`/`COMP:`/`BG:` (net-new).
- **`OQMI_GOVERNANCE.md` is truncated at §8.** The file ends at line 284 inside an unclosed code fence that was meant to hold the FIZ four-line commit format. Sections §§9–§12 referenced elsewhere in the repo (e.g. `CNZ-WORK-001.md §9` cites `OQMI_GOVERNANCE.md §12` invariants quick-reference register) are missing. A012 scope did not permit reconstructing the missing content (would require authoritative source the agent does not have). Mitigation:
  - Closed the dangling code fence and authored a conservative FIZ four-line format (`FIZ:` subject / `REASON:` / `IMPACT:` / `CORRELATION_ID:`) consistent with the brief reference in the glossary's original COMMIT PREFIXES section ("FIZ: format (REASON/IMPACT/CORRELATION_ID) applies").
  - Added an explicit "NOTE — DOCUMENT TRUNCATION" block flagging the missing §§9–§12 for a future governance-scoped restore.
  - Filed a provenance note in `OQMI_SYSTEM_STATE.md §8`.
  - **Recommendation:** open a Wave A amendment task (e.g. A015) to restore §§9–§12 of `OQMI_GOVERNANCE.md` from the canonical source. Not blocking for A012 completion.
- **R-CLARIFY-006 disposition.** A012 was the prefix half; the CEO's "HCZ is Guest Services, HZ is technology" framing simultaneously answers the "separate systems" half. R-CLARIFY-006 can be marked fully resolved; B001 (consolidated R-CLARIFY pass) can drop R-CLARIFY-006 from its question set.

## What's left

Nothing for A012 itself. Follow-ups raised:

1. **Restore `OQMI_GOVERNANCE.md` §§9–§12** (new task — recommend adding as `CNZ-WORK-001-A015` in the charter, CEO_GATE: NO, Scope: S, Agent: claude-code).
2. **Update `docs/DOMAIN_GLOSSARY.md` Cyrano section** (line 171) — currently reads `CYR: (commit prefix)` which is consistent with the new enum, no action required, but noted for future glossary consistency passes.
3. **Future task**: when any new domain is added to the platform, require a glossary amendment with the new commit prefix as part of the change.

## Files touched

- `docs/DOMAIN_GLOSSARY.md` — header date, HCZ row expanded, COMMIT PREFIXES section replaced with canonical enum
- `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_GOVERNANCE.md` — §8 code fence closed, FIZ four-line format restored, new §8.1 cross-link to glossary, truncation note added
- `PROGRAM_CONTROL/DIRECTIVES/QUEUE/CNZ-WORK-001.md` — A012 status line amended to DONE
- `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_SYSTEM_STATE.md` — §3 DONE row, §8 provenance, §9 review date (shared with A014)
- `PROGRAM_CONTROL/DIRECTIVES/DONE/CNZ-WORK-001-A012-DONE.md` — NEW (DONE record)
- `PROGRAM_CONTROL/REPORT_BACK/CNZ-WORK-001-A012-report.md` — NEW (this file)

## Tests added / modified

None. A012 is a documentation / naming-authority task with no code surface.

## OQMI_SYSTEM_STATE.md updates landed in same PR

- §3 DONE: yes — added CNZ-WORK-001-A012 row
- §5 OUTSTANDING: n/a — A012 was not tracked as a separate OUTSTANDING row (backlog is tracked inside the charter)
- §6 BLOCKERS: n/a — no blocker was open for A012
- §1 REPO ORIENTATION: populated previously-template fields (Repo name, URL, Package manager, Active build epic, Hard launch deadline, Visibility) as part of the combined A012+A014 pass
- §8 PROVENANCE: added commit-prefix-enum provenance note and governance-truncation note
- §9: Last full review updated to 2026-04-23
