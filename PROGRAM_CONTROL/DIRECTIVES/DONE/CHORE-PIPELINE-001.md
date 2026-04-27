# DIRECTIVE: CHORE-PIPELINE-001
# Directive Header Standard — Add Routing Fields

**Directive ID:** CHORE-PIPELINE-001
**Agent:** COPILOT
**Parallel-safe:** YES
**Touches:** PROGRAM_CONTROL/DIRECTIVES/QUEUE/DFSP-001.md, .github/ISSUE_TEMPLATE/directive.yml, docs/DIRECTIVE_TEMPLATE.md
**Mode:** DROID
**FIZ:** NO
**Commit prefix:** CHORE:
**Risk class:** R0
**Status:** DONE
**Gate:** NONE

---

## Objective

Add three routing fields (`Agent`, `Parallel-safe`, `Touches`) to every directive
file currently in QUEUE and to the directive template, enabling the automated
dispatch workflow (CHORE-PIPELINE-003) to route, detect conflicts, and assign
agents without human intervention.

---

## Definition of Done

- [x] Routing fields added to all directives currently in QUEUE (QUEUE was empty; DFSP-001 already in DONE — skipped per instruction)
- [x] `.github/ISSUE_TEMPLATE/directive.yml` updated
- [x] `docs/DIRECTIVE_TEMPLATE.md` created
- [x] Report-back filed at `PROGRAM_CONTROL/REPORT_BACK/CHORE-PIPELINE-001.md`
- [x] Directive moved to DONE
