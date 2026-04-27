# CNZ-WORK-001-A006 — DONE

**Task name:** Delete superseded root-level OQMI_SYSTEM_STATE.md (v2.0 doctrine)
**Wave:** A
**Completed:** 2026-04-23
**Agent:** claude-code
**PR:** pending (branch `claude/continue-cnz-work-001-EJKhg`)
**Merge commit SHA:** pending
**REPORT_BACK:** `PROGRAM_CONTROL/REPORT_BACK/CNZ-WORK-001-A006-report.md`

## Summary

Deleted root-level `OQMI_SYSTEM_STATE.md` (OQMI CODING DOCTRINE v2.0, March 28, 2026, 124 lines). Critical pre-deletion mitigation: `.github/required-files.txt:5` had this file as a CI-validated required file — replaced with the QUEUE-path version (`PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_SYSTEM_STATE.md`) so the validate-structure CI job stays green. Bonus: added `OQMI_GOVERNANCE.md` and `CNZ-WORK-001.md` from the same QUEUE directory to required-files.txt so all three SoT files are CI-validated for presence going forward. `.github/copilot-instructions.md` Coding Doctrine header pointer also updated (shared edit with A005).

## Files merged

- `OQMI_SYSTEM_STATE.md` — DELETED (root)
- `.github/required-files.txt`
- `.github/copilot-instructions.md` (shared with A005)
- `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_SYSTEM_STATE.md`
- `PROGRAM_CONTROL/DIRECTIVES/QUEUE/CNZ-WORK-001.md`
- `PROGRAM_CONTROL/REPORT_BACK/CNZ-WORK-001-A006-report.md`
- `PROGRAM_CONTROL/DIRECTIVES/DONE/CNZ-WORK-001-A006-DONE.md` (this file)

## Follow-ups

`.github/copilot-instructions.md` doctrine refresh (shared follow-up with A005).
