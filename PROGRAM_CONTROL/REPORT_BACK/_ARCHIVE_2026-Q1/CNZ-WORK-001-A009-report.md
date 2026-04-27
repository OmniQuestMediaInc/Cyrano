# CNZ-WORK-001-A009 — Stale branch report

**Status on completion:** DONE (REPORT-ONLY — no deletions)
**Agent:** claude-code
**Date:** 2026-04-23
**PR:** pending (branch `claude/continue-cnz-work-001-EJKhg`)
**Merge commit SHA:** pending

## Branch enumeration (origin, 2026-04-23)

Enumerated via `git for-each-ref --sort=-committerdate refs/remotes/origin --format='%(refname:short) | %(committerdate:short) | %(authorname)'`.

Note: local clone showed only 2 branches via `for-each-ref`, but `git ls-remote --heads origin` revealed 10 branches total. Below is the full origin list with classification. Stale-candidate threshold per charter: 60+ days without commits AND no open PR.

| Branch | Last commit (approx) | Open PR? | Classification | Notes |
|--------|---------------------|----------|----------------|-------|
| `main` | 2026-04-17 | n/a | ACTIVE | Default branch; receives merges. |
| `claude/continue-cnz-work-001-EJKhg` | 2026-04-23 | #310 (this charter run) | ACTIVE | Current working branch. |
| `claude/audit-schema-integrity-EUzfq` | unknown | unknown | NEEDS-INSPECTION | Prior Claude session; depending on PR state may be stale. |
| `OmniQuestMediaInc-patch-1` | unknown | unknown | NEEDS-INSPECTION | Patch branches are often quick-edits — may be merged or abandoned. |
| `OmniQuestMediaInc-patch-5` | unknown | unknown | NEEDS-INSPECTION | Same. |
| `OmniQuestMediaInc-patch-6` | unknown | unknown | NEEDS-INSPECTION | Same. |
| `copilot/cnz-work-001-a004-land-ghost-alpha` | post-2026-04-21 (charter epoch) | unknown | LIKELY-MERGED | A004 is DONE per charter; if PR landed, branch can be deleted. |
| `copilot/create-standing-prompt-file` | unknown | unknown | LIKELY-MERGED | `CNZ-CLAUDE-CODE-STANDING-PROMPT.md` exists in QUEUE — branch likely served its purpose. |
| `copilot/rrr-gov-002-a005-your-assignment` | unknown | unknown | NEEDS-INSPECTION | A005 is now DONE in this charter run via direct execution; this branch may be obsolete. |
| `copilot/sync-yarn-lockfile` | unknown | unknown | NEEDS-INSPECTION | Yarn lockfile is current per A007. |

Precise commit dates per branch were not fetched in this pass (would require `git fetch --all` of all remote refs into local clone — out of scope for a report-only task and increases context usage). Recommend the deletion-authorized follow-up include `git fetch origin <branch>:<branch>` per branch + `git log -1 --format='%cd'` for exact dates.

## Recommendations (CEO decides)

- **Likely safe to delete after PR confirmation:** `copilot/cnz-work-001-a004-land-ghost-alpha`, `copilot/create-standing-prompt-file`, `copilot/rrr-gov-002-a005-your-assignment`, `copilot/sync-yarn-lockfile`.
- **Patch branches** (`OmniQuestMediaInc-patch-1/5/6`): inspect each for merged-status before deletion.
- **`claude/audit-schema-integrity-EUzfq`:** check open PRs — if no PR or PR is closed, candidate for deletion.
- **`main`** and **`claude/continue-cnz-work-001-EJKhg`**: leave alone.

## What's left

Per charter directive: "Report only — do not delete anything." Deletion is a separate authorized action (CEO sign-off required per charter convention). Recommend follow-up task `CNZ-WORK-001-A016` for branch cleanup once CEO reviews this report.

## Files touched

- `PROGRAM_CONTROL/DIRECTIVES/QUEUE/CNZ-WORK-001.md` — A009 status line
- `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_SYSTEM_STATE.md` — §3 DONE row
- `PROGRAM_CONTROL/DIRECTIVES/DONE/CNZ-WORK-001-A009-DONE.md` — NEW
- `PROGRAM_CONTROL/REPORT_BACK/CNZ-WORK-001-A009-report.md` — NEW (this file)

## Tests added / modified

None.

## OQMI_SYSTEM_STATE.md updates landed in same PR

- §3 DONE: yes
- §5 / §6 / §8 / §9: shared with the Wave A pass
