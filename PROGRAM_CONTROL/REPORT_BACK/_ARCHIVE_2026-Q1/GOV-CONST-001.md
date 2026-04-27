# REPORT BACK — GOV-CONST-001

**Directive ID:** GOV-CONST-001
**Date:** 2026-04-13
**Agent:** Claude (Anthropic)
**Authority:** Kevin B. Hartley, CEO — CEO-DECISIONS-2026-04-12 + CEO-DECISIONS-2026-04-12-B

---

## Repo
OmniQuestMediaInc/ChatNowZone--BUILD

## Branch
`claude/execute-gov-const-001-and-cleanup`  
(Merged via PR #211)

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 of 2 | `19f9ac4a` | FIZ: GOV-CONST-001 Commit 1 of 2 — Append CEO April 12 governance constants |
| 2 of 2 | `099a617a` | CHORE: GOV-CONST-001 Commit 2 of 2 — Add directive-intake workflow + Issue template |

---

## Files Changed

### Commit 1 of 2 (`19f9ac4a`)
```
 services/core-api/src/config/governance.config.ts | 55 +++++++++++++++++++++++++++++++++++++++++++++++++++++++
 1 file changed, 55 insertions(+)
```

### Commit 2 of 2 (`099a617a`)
```
 .github/ISSUE_TEMPLATE/directive.yml   | 23 +++++++++++++++++++++++
 .github/workflows/directive-intake.yml | 62 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 2 files changed, 85 insertions(+)
```

**Confirmation:** Only the 3 files listed above were modified across both commits.
No services modified. No schema changes. No migrations. No existing constants altered.

---

## Constants Appended (Commit 1)

Six new `export const` blocks appended at the end of `services/core-api/src/config/governance.config.ts`, after `GZ_SCHEDULING`:

| Block | Key Fields |
|-------|-----------|
| `PLATFORM_GLOBAL` | `CURRENCY: 'USD'`, `MARKETPLACE_FEE_PCT: 0.18` |
| `MERCHANDISE_CONFIG` | `ACCEPTED_TOKEN_TYPE`, `CREATOR_PAYOUT_PER_TOKEN_USD: 0.075`, `DISPUTE_HOLD_TRIGGER`, `DISPUTE_CREATOR_WINDOW_HOURS: 72`, `DISPUTE_REMINDER_HOURS: [0, 24]`, `REFUND_ORIGINAL_CARD_ONLY: true` |
| `PERFORMANCE_RECORDING` | `POST_SHOW_PURCHASE_WINDOW_HOURS: 24`, `EMBARGO_DAYS: 10`, `CATALOG_RELEASE_DAY: 11`, `DM_ON_SHOW_START: true`, `DM_ON_SHOW_END: true` |
| `CONCIERGE_APPT` | `OPEN_HOUR: 11`, `CUTOFF_HOUR: 22`, `CUTOFF_MINUTE: 30` |
| `FAN_CLUB` | `ACCEPTED_TOKEN_TYPE: 'CHATTOKEN'`, `BILLING_CYCLES: ['MONTHLY', 'ANNUAL']` |
| `CREATOR_SAAS` | `TIERS_ACTIVE: false`, `FREE_TIER_ENABLED: true`, tier pricing (19.95 / 24.95 / 49.95), `BILLING_CYCLES: ['MONTHLY', 'ANNUAL']` |

> **Note:** `FAN_CLUB.ANNUAL_DISCOUNT_PCT` and `CREATOR_SAAS.ANNUAL_DISCOUNT_PCT` omitted per CEO decision (dropped as drift — TBD values excluded per commit message).

---

## Workflow Files Added (Commit 2)

### `.github/workflows/directive-intake.yml`
Watches `PROGRAM_CONTROL/DIRECTIVES/QUEUE/**.md` on push to `main`.
On any newly added `.md` file: opens a GitHub Issue tagged `copilot-task` with the directive file content as the body (via `--body-file`).

### `.github/ISSUE_TEMPLATE/directive.yml`
Basic Issue template with label `copilot-task` and a textarea for directive content.

---

## TypeCheck Result (`yarn typecheck` / `tsc --noEmit`)

```
yarn run v1.22.22
$ tsc --noEmit --project tsconfig.json
tsconfig.json(12,5): error TS5101: Option 'baseUrl' is deprecated and will stop
functioning in TypeScript 7.0. Specify compilerOption '"ignoreDeprecations": "6.0"'
to silence this error.
  Visit https://aka.ms/ts6 for migration information.
error Command failed with exit code 2.
```

**Assessment:** This single error is **pre-existing** — present on baseline before any changes.
Zero new errors introduced by this directive. The error originates in `tsconfig.json:12`
(`baseUrl` deprecation), unrelated to this change.

---

## Definition of Done Checklist

- [x] Six new constant blocks appended (`PLATFORM_GLOBAL`, `MERCHANDISE_CONFIG`, `PERFORMANCE_RECORDING`, `CONCIERGE_APPT`, `FAN_CLUB`, `CREATOR_SAAS`)
- [x] No existing constants modified — additive only
- [x] `directive-intake.yml` created and valid
- [x] `directive.yml` Issue template created
- [x] TSC — zero **new** errors (pre-existing error unchanged)
- [x] Report-back filed to `PROGRAM_CONTROL/REPORT_BACK/GOV-CONST-001.md`
- [x] Directive moved to `PROGRAM_CONTROL/DIRECTIVES/DONE/GOV-CONST-001.md`

---

## Result
**SUCCESS**
