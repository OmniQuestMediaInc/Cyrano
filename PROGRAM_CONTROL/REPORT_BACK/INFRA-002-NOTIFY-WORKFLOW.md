# INFRA-002 — Program Control Notify Workflow — Report Back

**Directive:** INFRA-002
**Status:** DONE
**Commit prefix:** INFRA:
**Risk class:** R2
**Date:** 2026-03-29

---

## What Was Built

### `.github/workflows/notify.yml` (CREATED)

GitHub Actions workflow that notifies Program Control when report-back files land on `main`:

- **Trigger:** `push` to `main` branch, filtered to `PROGRAM_CONTROL/REPORT_BACK/**` path changes only
- **Permissions:** `contents: read` (least privilege)
- **Steps:**
  1. **Checkout** with `fetch-depth: 2` to enable `HEAD~1` diff
  2. **Detect new report-back files** — diffs `HEAD~1..HEAD` for new `.md` files in `REPORT_BACK/`, outputs file list, short SHA, and commit message
  3. **Post to webhook** — sends structured JSON payload to `PROGRAM_CONTROL_WEBHOOK` secret (Slack-compatible format with attachments). Gracefully skips if secret is not configured.

---

## Setup Required After Merge

1. Navigate to `OmniQuestMediaInc/ChatNowZone--BUILD` → Settings → Secrets → Actions
2. Add secret `PROGRAM_CONTROL_WEBHOOK` with Slack incoming webhook URL (or Discord/Teams/email relay endpoint)
3. If no webhook is configured, the workflow runs but skips notification gracefully (no failure)

---

## Validation Checklist

| Check | Result |
|-------|--------|
| Workflow YAML is valid syntax | PASS |
| `paths` filter targets `PROGRAM_CONTROL/REPORT_BACK/**` | PASS |
| Webhook step skips gracefully when secret not set | PASS — `if [ -z "$NOTIFY_WEBHOOK" ]` guard with `exit 0` |
| `permissions: contents: read` (least privilege) | PASS |
| `fetch-depth: 2` enables HEAD~1 diff | PASS |

---

## What Was Left Incomplete

Nothing. Directive fully implemented as specified.

---

## HANDOFF

**Built:** GitHub Actions notification workflow for Program Control report-back file detection.
**Left incomplete:** Nothing.
**Next agent's first task:** Configure `PROGRAM_CONTROL_WEBHOOK` secret in repository settings after merge to `main`. No further code changes required for INFRA-002.
