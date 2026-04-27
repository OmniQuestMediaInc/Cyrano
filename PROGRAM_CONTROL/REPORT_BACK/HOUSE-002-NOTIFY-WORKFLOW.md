# HOUSE-002 — Program Control Notify Workflow — Report Back

**Directive:** HOUSE-002
**Status:** DONE
**Commit prefix:** INFRA:
**Risk class:** R2
**Date:** 2026-03-29

---

## What Was Built

### `.github/workflows/notify.yml` (VERIFIED)

The notify workflow already existed at `.github/workflows/notify.yml`, matching the HOUSE-002 specification exactly. This was originally committed under INFRA-002 (`1516b37`) and is present on the current branch.

Workflow details:

- **Trigger:** `push` to `main` branch, filtered to `PROGRAM_CONTROL/REPORT_BACK/**`
- **Permissions:** `contents: read` (least privilege)
- **Steps:**
  1. **Checkout** with `fetch-depth: 2` for `HEAD~1` diff
  2. **Detect new report-back files** — diffs `HEAD~1..HEAD` for `.md` files, outputs file list, short SHA, and commit message
  3. **Post to webhook** — sends JSON payload to `PROGRAM_CONTROL_WEBHOOK` secret; gracefully exits `0` when secret is absent

---

## Validation Checklist

| Check | Result |
|-------|--------|
| File exists at `.github/workflows/notify.yml` | PASS |
| `paths:` filter targets `PROGRAM_CONTROL/REPORT_BACK/**` | PASS |
| Webhook step exits `0` gracefully when secret is absent | PASS |
| Content matches HOUSE-002 specification verbatim | PASS |

---

## What Was Left Incomplete

Nothing. Directive fully satisfied.

---

## HANDOFF

**Built:** Verified `.github/workflows/notify.yml` matches HOUSE-002 spec. Created HOUSE-002 report-back.
**Left incomplete:** Nothing.
**Next agent's first task:** Ensure `PROGRAM_CONTROL_WEBHOOK` secret is configured in repository settings after merge to `main`.
