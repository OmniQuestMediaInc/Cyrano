# REPORT BACK: CHORE-PIPELINE-003

**Task:** CHORE-PIPELINE-003 — Add directive-dispatch.yml workflow + patch directive-intake.yml  
**Agent:** COPILOT  
**Branch:** copilot/choreimplement-directive-dispatch  

---

## HEAD

```
cf5a647cbc7b72e7b6d0c4ad65efaee877d8052a
```

---

## Files Changed

```
.github/workflows/directive-dispatch.yml  (created — 309 lines)
.github/workflows/directive-intake.yml    (patched — PR instruction block added)
PROGRAM_CONTROL/REPORT_BACK/CHORE-PIPELINE-003.md (this file)
PROGRAM_CONTROL/DIRECTIVES/DONE/CHORE-PIPELINE-003.md
```

---

## Confirmations

### ✅ directive-dispatch.yml created with all 4 jobs

File: `.github/workflows/directive-dispatch.yml` — 308 lines

| Job | Name | Trigger | Status |
|-----|------|---------|--------|
| 1 | assign-to-agent | issues: opened | ✅ Present |
| 2 | conflict-detection | push to main (QUEUE .md) | ✅ Present |
| 3 | lifecycle-pr-opened | pull_request: opened | ✅ Present |
| 4 | lifecycle-pr-merged | pull_request: closed + merged | ✅ Present |

### ✅ directive-intake.yml patched with PR instruction block

Patch replaces `--body-file "$FILE"` with a constructed body that appends
the PR instruction block via `printf`. The `---` separator is constructed
via a shell variable to avoid YAML document-separator interpretation.

### ✅ YAML syntax valid

Both files validated via `python3 -c "import yaml; yaml.safe_load(open(f))"`:
- `.github/workflows/directive-dispatch.yml` → VALID YAML
- `.github/workflows/directive-intake.yml` → VALID YAML

### ✅ permissions block present in directive-dispatch.yml

```yaml
permissions:
  contents: write
  issues: write
  pull-requests: write
```

---

## Job Details

### Job 1 — assign-to-agent
- Parses `**Agent:**` field from issue body via `grep -oP`
- `COPILOT` → assigns `app/copilot` via `gh issue edit --add-assignee`
- `CLAUDE_CODE` → adds label `claude-code-task` + posts comment with DROID MODE instruction
- Always adds `dispatched` label regardless of agent type
- All `gh` failures handled with `|| echo "WARNING:..."` (non-fatal)

### Job 2 — conflict-detection
- Inline Python script scans all `.md` files in QUEUE and IN_PROGRESS
- Extracts `**Touches:**` fields, splits on commas
- Builds filepath→[directive_ids] map
- For any filepath with 2+ directives: opens a GitHub Issue titled `CONFLICT: [ID-A] x [ID-B] — [filepath]`
- Labels: `conflict,needs-conflict-review`
- Push is never blocked — only issues surfaced

### Job 3 — lifecycle-pr-opened
- Extracts directive ID from PR title (second token after `": "`)
- Looks for `PROGRAM_CONTROL/DIRECTIVES/QUEUE/[ID].md`
- If found: moves to IN_PROGRESS, commits to PR branch
- If not found: `echo "CHECK: ... skipping"` — no error

### Job 4 — lifecycle-pr-merged
- Same extraction logic as Job 3
- Looks for `PROGRAM_CONTROL/DIRECTIVES/IN_PROGRESS/[ID].md`
- If found: moves to DONE, commits to main
- Searches for open issue titled `DIRECTIVE: [ID]` and closes it with comment
- If not found: `echo "CHECK: ... skipping"` — no error

---

## Error Handling

All jobs follow the rule: never fail on missing directive file.
- Missing files: `echo "CHECK: ... skipping"` + `exit 0`
- CLI failures: `|| echo "WARNING: ..."` pattern
- Log prefixes: `CHECK /` `WARNING:` / `FAIL:` used throughout

---

## Result

**SUCCESS** — All definition-of-done criteria met:
- [x] `.github/workflows/directive-dispatch.yml` created
- [x] `.github/workflows/directive-intake.yml` patched with PR instruction
- [x] Job 1 assign-to-agent present and correct
- [x] Job 2 conflict-detection present and correct
- [x] Job 3 lifecycle-pr-opened present and correct
- [x] Job 4 lifecycle-pr-merged present and correct
- [x] Error handling: no job fails on missing directive file
- [x] Report-back filed to PROGRAM_CONTROL/REPORT_BACK/CHORE-PIPELINE-003.md
- [x] Directive moved to PROGRAM_CONTROL/DIRECTIVES/DONE/CHORE-PIPELINE-003.md
