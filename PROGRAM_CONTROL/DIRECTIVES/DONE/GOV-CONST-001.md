# DIRECTIVE: GOV-CONST-001 -- CEO April 12 Governance Constants + GitHub Actions Workflow
# Status: QUEUED
# Agent: GitHub Copilot
# Mode: DROID
# FIZ: YES -- four-line commit format required
# Risk class: R0
# Date: 2026-04-12
# Authority: Kevin B. Hartley, CEO -- CEO-DECISIONS-2026-04-12 + CEO-DECISIONS-2026-04-12-B

---

## Objective

Two atomic commits:

COMMIT 1 -- Add all CEO April 12 governance constants to governance.config.ts
COMMIT 2 -- Add GitHub Actions workflow + Issue template for automated Copilot directive intake

---

## Pre-flight Checklist

- [ ] Read `.github/copilot-instructions.md`
- [ ] Read `OQMI_SYSTEM_STATE.md`
- [ ] Confirm none of the constants below already exist in
      services/core-api/src/config/governance.config.ts
      (search for PLATFORM_GLOBAL, MERCHANDISE_CONFIG, PERFORMANCE_RECORDING,
      CONCIERGE_APPT, FAN_CLUB, CREATOR_SAAS)
- [ ] Additive only -- no existing constants modified

---

## COMMIT 1 of 2 -- GovernanceConfig Constants

File to Modify: services/core-api/src/config/governance.config.ts

Append these six constant blocks at the END of the file, after GZ_SCHEDULING.
Do not insert between existing blocks. Do not modify any existing constant.

BLOCK 1: PLATFORM_GLOBAL
-- CURRENCY: 'USD'             // ISO 4217 -- current trading currency
-- MARKETPLACE_FEE_PCT: 0.18   // 18% -- locked CEO 2026-04-12 (revised from 12.5%)
// Applied to: digital merchandise, physical merchandise, digital content vault downloads,
// post-embargo PPV/catalog recording sales.
// NOT applied to: performance recordings purchased pre/during/post-show (within 24hr).

BLOCK 2: MERCHANDISE_CONFIG
-- ACCEPTED_TOKEN_TYPE: 'CHATTOKEN'       // ShowTokens rejected at checkout -- no exceptions
-- CREATOR_PAYOUT_PER_TOKEN_USD: 0.075    // $0.075 USD per ChatToken -- locked 2026-04-12
-- DISPUTE_HOLD_TRIGGER: 'IMMEDIATE'      // Hold applied on ticket creation
-- DISPUTE_CREATOR_WINDOW_HOURS: 72       // 72h (3 business days) to resolve
-- DISPUTE_REMINDER_HOURS: [0, 24]        // Reminders at ticket creation and 24h
-- REFUND_ORIGINAL_CARD_ONLY: true        // No alternate card -- no exceptions

BLOCK 3: PERFORMANCE_RECORDING
-- POST_SHOW_PURCHASE_WINDOW_HOURS: 24    // Last-call window after show ends
-- EMBARGO_DAYS: 10                        // Suppression period after post-show window
-- CATALOG_RELEASE_DAY: 11                 // Day 11 -- available in creator PPV/merch catalog
-- DM_ON_SHOW_START: true                  // DM sent to all attendees at show start
-- DM_ON_SHOW_END: true                    // DM sent to non-purchasers at show end

BLOCK 4: CONCIERGE_APPT
-- OPEN_HOUR: 11        // 11:00 AM billing-address TZ
-- CUTOFF_HOUR: 22      // 10:00 PM -- no new appointments after this hour
-- CUTOFF_MINUTE: 30    // Combined: 10:30 PM hard cutoff for new appointments
// Guests with existing appointments booked before cutoff may still execute
// purchase up to DFSP_PURCHASE_WINDOW_CLOSE_HOUR (23:00).

BLOCK 5: FAN_CLUB
-- ACCEPTED_TOKEN_TYPE: 'CHATTOKEN'       // ShowTokens not accepted
-- BILLING_CYCLES: ['MONTHLY', 'ANNUAL']  as const
-- ANNUAL_DISCOUNT_PCT: null               // TBD -- CEO to confirm before activation
// Fan club fee applies PLATFORM_GLOBAL.MARKETPLACE_FEE_PCT (18%) -- no separate constant.

BLOCK 6: CREATOR_SAAS
-- TIERS_ACTIVE: false            // Master kill switch -- admin toggles on
-- FREE_TIER_ENABLED: true
-- TIER_1_MONTHLY_USD: 19.95
-- TIER_2_MONTHLY_USD: 24.95
-- TIER_3_MONTHLY_USD: 49.95
-- ANNUAL_DISCOUNT_PCT: null      // TBD -- CEO to confirm % before activation
-- BILLING_CYCLES: ['MONTHLY', 'ANNUAL'] as const
// Build and ship. INACTIVE at launch. Admin-side activation only.

---

## COMMIT 2 of 2 -- GitHub Actions Directive Intake Workflow

FILE A: .github/workflows/directive-intake.yml

Watches PROGRAM_CONTROL/DIRECTIVES/QUEUE on push to main.
On any new .md file detected: opens a GitHub Issue tagged
'copilot-task' with the directive content as the body.

YAML structure:
name: Directive Intake -- Auto-Issue on Queue Push
on:
  push:
    branches: [main]
    paths:
      - 'PROGRAM_CONTROL/DIRECTIVES/QUEUE/**.md'
jobs:
  open-directive-issue:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      issues: write
    steps:
      - uses: actions/checkout@v4 with fetch-depth: 2
      - name: Detect new directive files
        run: git diff --name-only --diff-filter=A HEAD~1 HEAD \
             -- 'PROGRAM_CONTROL/DIRECTIVES/QUEUE/*.md' | grep -v '.gitkeep'
      - name: Open Issue per new directive
        env: GH_TOKEN: secrets.GITHUB_TOKEN
        run: for each file: gh issue create --title "DIRECTIVE: {ID}" \
             --body "$(CAT FILE)" --label "copilot-task"

FILE B: .github/ISSUE_TEMPLATE/directive.yml
Basic Issue template with label copilot-task and a textarea
for directive content.

---

## Commit Format (FIZ -- four-line mandatory)

Commit 1:
REASON: GOV-CONST-001 -- Add CEO April 12 governance constants to governance.config.ts;
PLATFORM_GLOBAL, MERCHANDISE_CONFIG, PERFORMANCE_RECORDING, CONCIERGE_APPT, FAN_CLUB, CREATOR_SAAS
IMPACT: Six new export const blocks appended -- additive only; no existing constants modified;
no schema changes; no service logic; no migrations
CORRELATION_ID: GOV-CONST-001-2026-04-12
GATE: CEO-DECISIONS-2026-04-12 | CEO-DECISIONS-2026-04-12-B

Commit 2:
REASON: GOV-CONST-001 -- Add GitHub Actions directive-intake workflow + Issue template
IMPACT: Two new files -- no source code modified; no tests affected
CORRELATION_ID: GOV-CONST-001-2026-04-12
GATE: CEO-DECISIONS-2026-04-12

---

## Definition of Done

- [ ] Six new constant blocks appended
- [ ] No existing constants modified
- [ ] directive-intake.yml created and valid
- [ ] directive.yml Issue template created
- [ ] TSC clean
- [ ] Report-back filed to PROGRAM_CONTROL/REPORT_BACK/GOV-CONST-001.md
- [ ] Directive moved to DONE
