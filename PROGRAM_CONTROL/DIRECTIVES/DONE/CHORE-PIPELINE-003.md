# DIRECTIVE: CHORE-PIPELINE-003
# Directive Dispatch Workflow — Auto-Routing, Lifecycle, Conflict Detection

**Directive ID:** CHORE-PIPELINE-003
**Agent:** COPILOT
**Parallel-safe:** NO
**Touches:** .github/workflows/directive-dispatch.yml, .github/workflows/directive-intake.yml
**Mode:** DROID
**FIZ:** NO
**Commit prefix:** CHORE:
**Risk class:** R0
**Status:** DONE
**Gate:** CHORE-PIPELINE-001 on main

---

## Definition of Done

- [x] `.github/workflows/directive-dispatch.yml` created
- [x] `.github/workflows/directive-intake.yml` patched with PR instruction
- [x] Job 1 assign-to-agent present and correct
- [x] Job 2 conflict-detection present and correct
- [x] Job 3 lifecycle-pr-opened present and correct
- [x] Job 4 lifecycle-pr-merged present and correct
- [x] Error handling: no job fails on missing directive file
- [x] Report-back filed to PROGRAM_CONTROL/REPORT_BACK/CHORE-PIPELINE-003.md
- [x] Directive moved to PROGRAM_CONTROL/DIRECTIVES/DONE/CHORE-PIPELINE-003.md
