# M5-VOICE-SAMPLE-COLLECTION — Report Back

**Task ID:** M5-VOICE-SAMPLE-COLLECTION
**Repo:** OmniQuestMediaInc/ChatNowZone--BUILD
**Branch:** claude/m5-voice-sample-collection-EuweU
**HEAD (pre-report):** 3e1c6bebdc31dc6b8a5b3636000f1b506dc9724f
**Date:** 2026-04-13
**Result:** HARD_STOP — directive file not present in workspace

---

## Directive Location Requested

`PROGRAM_CONTROL/DIRECTIVES/QUEUE/M5-VOICE-SAMPLE-COLLECTION.md`

## Evidence of Absence

### `ls PROGRAM_CONTROL/DIRECTIVES/QUEUE/`
```
DFSP-001.md
NATS-DFSP001-TOPICS.md
```

### `ls PROGRAM_CONTROL/DIRECTIVES/IN_PROGRESS/`
```
(empty — only .gitkeep)
```

### `ls PROGRAM_CONTROL/DIRECTIVES/DONE/`
```
AUDIT-001.md
AUDIT-002.md
AUDIT-NOTE-2026-04-10.md
CHORE-TS.md
GEO-001.md
HOTFIX-AUTH-001.md
INFRA-004.md
KYC-001.md
LEGAL-HOLD-DB.md
MOD-001.md
PV-001.md
```

### `git log --all --full-history -- "PROGRAM_CONTROL/DIRECTIVES/QUEUE/M5-VOICE-SAMPLE-COLLECTION.md"`
```
(no output — file has never existed in git history on any branch)
```

### `find . -iname "*M5*" -not -path "./.git/*"`
```
(no matches)
```

### `find . -iname "*voice*" -not -path "./.git/*"`
```
(no matches)
```

---

## Why HARD_STOP

Per `.github/copilot-instructions.md` Non-Negotiable Rule 1 (NO SYNTHESIS):
> Never fabricate command output. Never write "based on GitHub API",
> "replicated", "from prior audits", or "assumed".

Per Rule 5 (PASS/FAIL Policy):
> If the task requires evidence and it's not present: FAIL.
> If a command cannot run: HARD_STOP.

The directive file referenced by the inbound task does not exist in the
workspace, in git history, or on any remote branch. Executing the
directive would require fabricating its scope, filenames, Prisma model
references, governance constants, NATS topics, and acceptance criteria —
a direct violation of the NO SYNTHESIS rule and the DROID MODE invariant.

Additionally, the inbound task instruction sentence "move the directive
file from QUEUE/ to" is truncated; the destination directory was not
specified. Both the source file and the move destination are missing.

## Actions NOT Taken (and why)

- **No service files created.** Scope unknown; would require fabrication.
- **No Prisma changes.** SCHEMA INTEGRITY invariant — cannot modify
  without a directive specifying columns, indexes, and correlation_id
  / reason_code placement.
- **No NATS topic registrations.** LATENCY INVARIANT — topic names
  unknown without directive.
- **No directive file moved.** Source file does not exist; destination
  unspecified in inbound task.
- **No `npx tsc --noEmit` run.** No code was changed, so there is no
  new-error delta to measure against. Running the command would produce
  the existing pre-task baseline, which is not evidence of directive
  completion.

## Resolution Path

Human operator action required to proceed:

1. Author and commit `PROGRAM_CONTROL/DIRECTIVES/QUEUE/M5-VOICE-SAMPLE-COLLECTION.md`
   with complete scope, Prisma model references, NATS topic constants,
   GovernanceConfig constants, invariant checklist, commit format, and
   Definition of Done (template pattern matches existing `DFSP-001.md`).
2. Specify destination directory for the post-execution directive move
   (prior precedent: `PROGRAM_CONTROL/DIRECTIVES/DONE/`).
3. Re-dispatch task to branch `claude/m5-voice-sample-collection-EuweU`.

## Files Changed This Commit

- `PROGRAM_CONTROL/REPORT_BACK/M5-VOICE-SAMPLE-COLLECTION.md` (NEW — this file)

No application code touched. No schema touched. No NATS registry touched.

## Result

**HARD_STOP** — Missing directive file. No fabrication performed.
