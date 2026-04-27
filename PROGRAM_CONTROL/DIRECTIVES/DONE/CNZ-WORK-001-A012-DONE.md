# CNZ-WORK-001-A012 — DONE

**Task name:** Reconcile commit prefix enums
**Wave:** A
**Completed:** 2026-04-23
**Agent:** claude-code
**PR:** pending (branch `claude/continue-cnz-work-001-EJKhg`)
**Merge commit SHA:** pending
**REPORT_BACK:** `PROGRAM_CONTROL/REPORT_BACK/CNZ-WORK-001-A012-report.md`

## Summary

Authored the canonical commit prefix enum for `OmniQuestMediaInc/ChatNowZone--BUILD` and landed it as the new "COMMIT PREFIX ENUM — CANONICAL" section of `docs/DOMAIN_GLOSSARY.md`. The glossary is declared the naming authority; `OQMI_GOVERNANCE.md §8.1` now cross-links to it and supersedes any prefix list found elsewhere. The enum follows a hybrid model per CEO decision 2026-04-23: `FIZ:`, `GOV:`, and `CHORE:` are cross-cutting; layer prefixes (`INFRA:`, `DB:`, `API:`, `UI:`, `TEST:`) cover non-domain work; domain prefixes (existing — `NATS:`, `OBS:`, `BIJOU:`, `CRM:`, `HZ:`, `GGS:`, `GGS-AV:`, `CYR:`, `SHOWZONE:`; new — `HCZ:`, `REDBOOK:`, `PAY:`, `COMP:`, `BG:`) apply under a most-specific-wins selection rule. The old OQMI v2.0 enum and the RRR-GOV-002 §3.5 enum are retired. The HZ/HCZ split simultaneously resolved the prefix half and the separateness half of R-CLARIFY-006 — HZ stays as HeartZone IoT Loop (biometric technology), HCZ is now canonical for the Human Contact Zone Guest Services / Customer Services bureau.

## Files merged

- `docs/DOMAIN_GLOSSARY.md`
- `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_GOVERNANCE.md`
- `PROGRAM_CONTROL/DIRECTIVES/QUEUE/CNZ-WORK-001.md` (A012 status line)
- `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_SYSTEM_STATE.md` (shared with A014)
- `PROGRAM_CONTROL/REPORT_BACK/CNZ-WORK-001-A012-report.md` (new)
- `PROGRAM_CONTROL/DIRECTIVES/DONE/CNZ-WORK-001-A012-DONE.md` (this file)

## Follow-ups (if any)

1. **Recommend new task `CNZ-WORK-001-A015`** — restore `OQMI_GOVERNANCE.md` §§9–§12 (found truncated at §8 during A012 execution; referenced by charter §9 but not present in the file). Scope: S, Agent: claude-code, CEO_GATE: NO (treating as mechanical restore from authoritative source; if source is unavailable, upgrade to CEO_GATE: YES).
2. **R-CLARIFY-006 can be marked fully resolved** and dropped from the B001 consolidated clarify pass.
3. **F005 (R-009 Human Contact Zone) unblocked on the prefix half** — HCZ prefix is now canonical and available for F005 commits when that task opens.
