# CNZ-WORK-001-A099 — DONE (WAVE A CLOSURE)

**Task name:** WAVE A CLEANUP
**Wave:** A
**Completed:** 2026-04-23
**Agent:** claude-code (agent-hint "copilot" overridden per charter §2)
**PR:** #310 (initial A012+A014 paperwork) + subsequent commits on `claude/continue-cnz-work-001-EJKhg` closing the rest of Wave A
**Merge commit SHA:** pending
**REPORT_BACK:** `PROGRAM_CONTROL/REPORT_BACK/CNZ-WORK-001-A099-WAVE-A-CLEANUP-report.md`

## Summary

**Wave A is CLOSED.** All 14 tasks (A001 through A014) plus this cleanup task A099 are DONE. Three SoT files in `PROGRAM_CONTROL/DIRECTIVES/QUEUE/` are internally consistent and reflect Wave A outcomes. `OQMI_SYSTEM_STATE.md §3 DONE` carries all 14 rows; §7 RETIRED ITEMS records 5 deletions/archives. Lint coverage delegated to CI super-linter on PR. Dead-code sweep deferred to per-Wave cleanup tasks (Wave D/E/F services). Three follow-up tasks recommended (A015 governance restore, A016 branch cleanup, A017 copilot-instructions doctrine refresh) — none block Wave B opening.

## Files merged

- `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_SYSTEM_STATE.md` — §3, §7 updated
- `PROGRAM_CONTROL/DIRECTIVES/QUEUE/CNZ-WORK-001.md` — A099 status line
- `PROGRAM_CONTROL/REPORT_BACK/CNZ-WORK-001-A099-WAVE-A-CLEANUP-report.md` — NEW (Wave A rollup)
- `PROGRAM_CONTROL/DIRECTIVES/DONE/CNZ-WORK-001-A099-DONE.md` (this file)

## Follow-ups (recommended new tasks for CEO to append to charter)

1. **CNZ-WORK-001-A015** — Restore OQMI_GOVERNANCE.md §§9–§12. Scope: S. Agent: claude-code. CEO_GATE: NO if mechanical / YES if reconstruction required from authoritative source.
2. **CNZ-WORK-001-A016** — CEO-authorized branch deletion pass. Scope: S. Agent: copilot. CEO_GATE: YES.
3. **CNZ-WORK-001-A017** — Doctrine refresh of `.github/copilot-instructions.md` (remove superseded OQMI CODING DOCTRINE v2.0 content; align with OQMI_GOVERNANCE.md and DOMAIN_GLOSSARY.md). Scope: M. Agent: claude-code. CEO_GATE: NO.

## Wave B status

Wave B (CEO Decision Surfacing) is now open. First task: B001 (consolidated R-CLARIFY pass to CEO) — minus R-CLARIFY-006 which was fully resolved by A012.
