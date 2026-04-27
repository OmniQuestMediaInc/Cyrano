# CNZ-WORK-001-A005 — Archive Sovereign_Kernel.md.pdf

**Status on completion:** DONE
**Agent:** claude-code
**Date:** 2026-04-23
**PR:** pending (branch `claude/continue-cnz-work-001-EJKhg`)
**Merge commit SHA:** pending

## What was done

- Verified `archive/governance/` directory exists.
- Moved `Sovereign_Kernel.md.pdf` (120730 bytes) from repo root to `archive/governance/Sovereign_Kernel.md.pdf` via `git mv` (preserves history).
- Updated inbound references found by grep:
  - `PROGRAM_CONTROL/REPO_MANIFEST.md` — replaced `- \`Sovereign_Kernel.md.pdf\`` with `- \`archive/governance/Sovereign_Kernel.md.pdf\`` and reordered alphabetically.
  - `.github/copilot-instructions.md` — header line `**Source of Truth:** Sovereign_Kernel.md.pdf (repo root)` replaced with current SoT pointers (OQMI_GOVERNANCE.md, OQMI_SYSTEM_STATE.md, CNZ-WORK-001.md, DOMAIN_GLOSSARY.md) plus a RETIRED note for Sovereign_Kernel.
  - `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_SYSTEM_STATE.md §8 PROVENANCE` — template "Pending archive" placeholder replaced with concrete archive provenance.
- References left in place (intentional):
  - `archive/governance/CLAUDE.md` mentions Sovereign_Kernel as historical context — archived doc, not edited.
  - REPORT_BACK history files — archival, not edited.
- Marked A005 DONE in charter §6 and added §3 row to OQMI_SYSTEM_STATE.md.

## What was found / surfaced

- `.github/copilot-instructions.md` carries large stretches of stale "OQMI CODING DOCTRINE v2.0" content duplicating what now lives in OQMI_GOVERNANCE.md and superseded prefix conventions (lines 72-89). This is a doctrine-overlap defect beyond A005 scope. Header pointer fixed in this task; broader refresh is a follow-up — see Wave A cleanup A099 / future task.

## What's left

Nothing for A005 itself. Follow-up flagged in §8 provenance for future doctrine refresh of `.github/copilot-instructions.md`.

## Files touched

- `Sovereign_Kernel.md.pdf` → `archive/governance/Sovereign_Kernel.md.pdf` (renamed)
- `PROGRAM_CONTROL/REPO_MANIFEST.md`
- `.github/copilot-instructions.md`
- `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_SYSTEM_STATE.md` — §3 DONE, §8 provenance
- `PROGRAM_CONTROL/DIRECTIVES/QUEUE/CNZ-WORK-001.md` — A005 status line
- `PROGRAM_CONTROL/DIRECTIVES/DONE/CNZ-WORK-001-A005-DONE.md` — NEW
- `PROGRAM_CONTROL/REPORT_BACK/CNZ-WORK-001-A005-report.md` — NEW (this file)

## Tests added / modified

None.

## OQMI_SYSTEM_STATE.md updates landed in same PR

- §3 DONE: yes
- §8 PROVENANCE: yes — Sovereign_Kernel archive provenance landed
- §5 / §6 / §9: shared with the Wave A pass
