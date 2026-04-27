# CNZ-WORK-001-A006 — Delete superseded root-level OQMI_SYSTEM_STATE.md (v2.0 doctrine)

**Status on completion:** DONE
**Agent:** claude-code
**Date:** 2026-04-23
**PR:** pending (branch `claude/continue-cnz-work-001-EJKhg`)
**Merge commit SHA:** pending

## What was done

- Confirmed root `OQMI_SYSTEM_STATE.md` is the OLD v2.0 doctrine (line 1: `# OQMI CODING DOCTRINE v2.0`, March 28, 2026, 124 lines).
- Confirmed the QUEUE-path `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_SYSTEM_STATE.md` is the live SoT (declared by CEO 2026-04-21, populated by A004/A012/A014).
- Critical pre-deletion check: `.github/required-files.txt:5` lists `OQMI_SYSTEM_STATE.md` as a CI-validated required file. Deleting the file without updating the manifest would FAIL the validate-structure CI job.
- Mitigation in same PR: replaced the line in `.github/required-files.txt` with the QUEUE-path version of the file, and proactively added `OQMI_GOVERNANCE.md` and `CNZ-WORK-001.md` from the same QUEUE directory so all three SoT files are CI-validated for presence going forward.
- `.github/copilot-instructions.md` header line `**Coding Doctrine:** OQMI_SYSTEM_STATE.md (repo root) — OQMI CODING DOCTRINE v2.0` replaced with current doctrine pointer (OQMI_GOVERNANCE.md). Note added that the rest of the file's "OQMI CODING DOCTRINE v2.0" references are superseded.
- Deleted root `OQMI_SYSTEM_STATE.md` via `git rm`.
- Marked A006 DONE in charter §6 and added §3 row + §8 provenance entry to OQMI_SYSTEM_STATE.md.

## What was found / surfaced

- `.github/required-files.txt` was the single CI-blocking dependency. With it updated, no other CI workflow references the root file by literal path (verified via grep across `.github/workflows/`).
- `archive/governance/CLAUDE.md` references "Coding Doctrine: OQMI_SYSTEM_STATE.md (OQMI CODING DOCTRINE v2.0)" in its archived content — left in place (archival, not authoritative).
- Bonus content in `.github/required-files.txt`: added `OQMI_GOVERNANCE.md` and `CNZ-WORK-001.md` so structure-validate guards all three SoT files. Modest scope expansion within A006's directive intent (keeping CI green during a SoT relocation).

## What's left

Nothing for A006 itself.

## Files touched

- `OQMI_SYSTEM_STATE.md` — DELETED (root)
- `.github/required-files.txt` — line 5 replaced; +2 lines for OQMI_GOVERNANCE and CNZ-WORK-001
- `.github/copilot-instructions.md` — header pointer updated (shared edit with A005)
- `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_SYSTEM_STATE.md` — §3 DONE row, §8 provenance
- `PROGRAM_CONTROL/DIRECTIVES/QUEUE/CNZ-WORK-001.md` — A006 status line
- `PROGRAM_CONTROL/DIRECTIVES/DONE/CNZ-WORK-001-A006-DONE.md` — NEW
- `PROGRAM_CONTROL/REPORT_BACK/CNZ-WORK-001-A006-report.md` — NEW (this file)

## Tests added / modified

None.

## OQMI_SYSTEM_STATE.md updates landed in same PR

- §3 DONE: yes
- §8 PROVENANCE: yes — root OQMI_SYSTEM_STATE.md deletion noted
- §5 / §6 / §9: shared with the Wave A pass
