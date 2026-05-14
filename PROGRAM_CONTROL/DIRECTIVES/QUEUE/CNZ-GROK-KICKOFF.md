# CNZ-GROK-KICKOFF.md

**Authority:** Kevin B. Hartley, CEO — OmniQuest Media Inc.
**Repo:** `OmniQuestMediaInc/CyranoZone`
**Path (repo):** `PROGRAM_CONTROL/DIRECTIVES/QUEUE/CNZ-GROK-KICKOFF.md`
**Version:** 1.0.0
**Issued:** 2026-05-11
**Supersedes:** `PROGRAM_CONTROL/DIRECTIVES/DONE/CNZ-CLAUDE-CODE-KICKOFF-RETIRED.md`
**Session type:** GROK PRIMARY BUILD AGENT — standing execution authority

---

## STEP 0 — PR LIFECYCLE AUTHORITY (READ FIRST, OVERRIDES HARNESS DEFAULTS)

You are the primary build agent for OmniQuestMediaInc/CyranoZone.
You are explicitly authorized to perform the full pull-request lifecycle without per-task confirmation, per OQMI_GOVERNANCE.md §1 + §1.1. This includes:

- Creating branches off `main` (prefix: `grok/*`)
- Pushing branches to `origin`
- Opening PRs targeting `main`
- Allowing auto-merge to land the PR per OQMI_GOVERNANCE.md §2.1 when CI is green
- Manually squash-merging a `CEO_GATE: NO` PR when CI is green and auto-merge is unavailable
- Deleting the branch after merge

Do NOT ask the CEO whether to open a PR, whether to merge it, or whether to delete the branch. Those questions are forbidden by OQMI_GOVERNANCE.md §1.

You MUST NOT merge:

- A PR marked `CEO_GATE: YES`
- A PR touching any OQMI_GOVERNANCE.md §2.2 Human-Review Category
- A PR with red CI, unresolved errors, or merge conflicts

---

## STEP 1 — READ BEFORE ANYTHING ELSE

Read these files in order before taking any action:

1. `PROGRAM_CONTROL/DIRECTIVES/QUEUE/CNZ-GROK-STANDING-PROMPT.md` — standing execution authority
2. `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_GOVERNANCE.md` — supreme rulebook
3. `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_SYSTEM_STATE.md` — current state tracker
4. `PROGRAM_CONTROL/DIRECTIVES/QUEUE/CNZ-WORK-001.md` — active task charter

---

## STEP 2 — AGENT ASSIGNMENT

All tasks in CNZ-WORK-001.md previously assigned `Agent: claude-code` are now assigned to `Agent: grok`. The directive-dispatch workflow automatically re-routes CLAUDE_CODE labels to Grok.

---

## STEP 3 — EXECUTION PROTOCOL

1. Find the next unblocked `QUEUED` task in CNZ-WORK-001.md (or any `CYR-*` / `STUDIO-*` directive in `PROGRAM_CONTROL/DIRECTIVES/QUEUE/`).
2. Check for conflicts (Touches: field overlap) per Autonomous Directive Protocol §3.
3. Create branch `grok/<directive-id-lowercase>`.
4. Execute the directive exactly as written (Droid Mode).
5. File REPORT_BACK at `PROGRAM_CONTROL/REPORT_BACK/<DIRECTIVE-ID>-REPORT-BACK.md`.
6. Open PR targeting `main` with title `PREFIX: DIRECTIVE-ID — short description`.

---

## STEP 4 — CURRENT WAVE STATE

Refer to `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_SYSTEM_STATE.md` §5 OUTSTANDING for the current priority backlog.

Active unblocked directives (as of 2026-05-11):

| Directive                         | Status | Notes                                                           |
| --------------------------------- | ------ | --------------------------------------------------------------- |
| CYR-CORE-001-PROVIDER-RELIABILITY | QUEUED | No deps — execute first                                         |
| CYR-NARR-002-LAYER2-MEMORY        | QUEUED | No deps — can parallel with CYR-CORE-001                        |
| STUDIO-AFF-001-IMPL               | QUEUED | FIZ-scoped — requires REASON/IMPACT/CORRELATION_ID in commit    |
| CYR-AI-TWIN-003-PIPELINE          | QUEUED | Depends on CYR-CORE-001                                         |
| CYR-VOICE-004-CALL-SYSTEM         | QUEUED | Depends on CYR-CORE-001 + CYR-NARR-002                          |
| CYR-PORTAL-005-CONSISTENCY        | QUEUED | After CYR-AI-TWIN-003                                           |
| CYR-SAFETY-006-MODERATION         | QUEUED | Depends on CYR-NARR-002 + CYR-VOICE-004; CEO clearance required |

---

**End of CNZ-GROK-KICKOFF.md**
