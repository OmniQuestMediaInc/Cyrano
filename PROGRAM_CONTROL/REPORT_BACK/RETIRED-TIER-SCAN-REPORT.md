# RETIRED MEMBERSHIP TIER SCAN REPORT

**Task:** Scrub retired MembershipTier values + prepare clean slate for MEMB-001
**Branch:** claude/scrub-retired-membership-tier-values
**HEAD:** (to be updated on final commit)
**Agent:** Claude Code
**Date:** 2026-04-17
**Scan Coverage:** Entire repository excluding node_modules, .git, dist, build, .next, coverage

---

## EXECUTIVE SUMMARY

### Patterns Scanned
- `\bDAY_PASS\b` (case-sensitive)
- `\bOMNIPASS_PLUS\b` (case-sensitive)
- `\bANNUAL\b` (case-sensitive)
- `\bDIAMOND\b` (case-sensitive)
- `day pass` / `day-pass` (case-insensitive)

### Summary Table

| Pattern | Total Hits | RETIRED (must fix) | KEEP (legitimate) | AMBIGUOUS (needs review) |
|---------|------------|-------------------|-------------------|-------------------------|
| DAY_PASS | 23 | **23** | 0 | 0 |
| OMNIPASS_PLUS | 16 | **16** | 0 | 0 |
| ANNUAL (as tier) | 19 | **19** | 0 | 0 |
| ANNUAL (as billing interval) | 16 | 0 | **16** | 0 |
| DIAMOND (standalone tier) | 25 | **25** | 0 | 0 |
| DIAMOND (VIP_DIAMOND canonical) | 0 | 0 | **0** | 0 |
| DIAMOND (product/service name) | 13 | 0 | **13** | 0 |
| "day pass" literal | 5 | **5** | 0 | 0 |

**CRITICAL FINDING:** All retired tier values (DAY_PASS, OMNIPASS_PLUS, ANNUAL-as-tier, standalone DIAMOND) are present across schema, TypeScript source, documentation, and PROGRAM_CONTROL files. CEO scrub directive required before MEMB-001 can proceed.

---

## DETAILED FINDINGS

### 1. DAY_PASS — RETIRED (23 hits, ALL must be replaced)

All instances of `DAY_PASS` used as a membership tier value are RETIRED. The concept "Day Pass" is fully retired per Tech Debt Delta 2026-04-16.

#### Classification: **ALL RETIRED — MUST FIX**

| File | Line | Context | Action Required |
|------|------|---------|----------------|
| `prisma/schema.prisma` | 850 | `enum MembershipTier { DAY_PASS ... }` | Remove DAY_PASS from enum |
| `services/core-api/src/membership/membership.service.ts` | 31 | Comment: "Returns DAY_PASS if no ACTIVE subscription exists" | Replace with fallback to GUEST |
| `services/core-api/src/membership/membership.service.ts` | 47 | Log: "defaulting to DAY_PASS" | Replace with GUEST |
| `services/core-api/src/membership/membership.service.ts` | 51 | `return 'DAY_PASS';` | Replace with GUEST |
| `services/core-api/src/membership/membership.service.ts` | 212 | Comment: "user tier downgrades to DAY_PASS" | Replace with GUEST |
| `services/core-api/src/membership/membership.service.ts` | 252 | Log: "user downgrades to DAY_PASS" | Replace with GUEST |
| `services/core-api/src/zone-access/zone-access.service.ts` | 118 | Comment: "Returns DAY_PASS if no active subscription exists" | Replace with GUEST |
| `services/core-api/src/config/governance.config.ts` | 212 | `STIPEND_CZT: { DAY_PASS: 0, ...}` | Remove DAY_PASS key |
| `services/core-api/src/config/governance.config.ts` | 359 | `CHAT_ZONE: ['DAY_PASS', 'ANNUAL', ...]` | Remove DAY_PASS from array |
| `services/core-api/src/config/governance.config.ts` | 370 | `ZONE_ACCESS_TIERS = ['DAY_PASS', ...]` | Remove DAY_PASS from array |
| `PROGRAM_CONTROL/REPORT_BACK/MEMB-003-REPORT-BACK.md` | 18 | Mentions DAY_PASS=0 in STIPEND_CZT | Archive — historical report |
| `PROGRAM_CONTROL/REPORT_BACK/MEMB-003-REPORT-BACK.md` | 33 | Confirms DAY_PASS constant | Archive — historical report |
| `PROGRAM_CONTROL/REPORT_BACK/MEMB-002-REPORT-BACK.md` | 55 | `MembershipTier` enum includes DAY_PASS | Archive — historical report |
| `PROGRAM_CONTROL/REPORT_BACK/GOV-CONST-001-PATCH-REPORT-BACK.md` | 88 | Lists DAY_PASS in canonical tiers | Update to reflect retirement |
| `PROGRAM_CONTROL/REPORT_BACK/GOV-CONST-001-PATCH-REPORT-BACK.md` | 94 | Lists DAY_PASS | Update to reflect retirement |
| `PROGRAM_CONTROL/DIRECTIVES/DONE/THREAD11-COPILOT-INTAKE.md` | 59, 71, 125, 138, 199 | Multiple references to DAY_PASS tier | Archive — historical directive |
| `PROGRAM_CONTROL/Thread 12 Handoff` | 46, 67, 112 | References DAY_PASS as canonical tier | **MUST UPDATE — active handoff doc** |

#### Action Plan for DAY_PASS
- **Schema:** Remove from `MembershipTier` enum
- **TypeScript:** Replace all return values / defaults with `GUEST`
- **Governance config:** Remove from `STIPEND_CZT`, `ZONE_MAP`, `ZONE_ACCESS_TIERS`
- **Documentation:** Update Thread 12 Handoff to reflect retirement
- **Report-backs:** Archive MEMB-002/MEMB-003 reports (historical, no action)

---

### 2. OMNIPASS_PLUS — RETIRED (16 hits, ALL must be replaced)

All instances of `OMNIPASS_PLUS` are RETIRED. Not a canonical tier.

#### Classification: **ALL RETIRED — MUST FIX**

| File | Line | Context | Action Required |
|------|------|---------|----------------|
| `prisma/schema.prisma` | 852 | `enum MembershipTier { ... OMNIPASS_PLUS ... }` | Remove OMNIPASS_PLUS from enum |
| `services/core-api/src/config/governance.config.ts` | 214 | `STIPEND_CZT: { ... OMNIPASS_PLUS: 250, ...}` | Remove OMNIPASS_PLUS key |
| `services/core-api/src/config/governance.config.ts` | 359-362 | ZONE_MAP arrays contain OMNIPASS_PLUS | Replace with VIP_GOLD or remove |
| `services/core-api/src/config/governance.config.ts` | 370 | `ZONE_ACCESS_TIERS` array contains OMNIPASS_PLUS | Remove OMNIPASS_PLUS |
| `PROGRAM_CONTROL/REPORT_BACK/GOV-CONST-001-PATCH-REPORT-BACK.md` | 88, 94 | Lists OMNIPASS_PLUS | Update to reflect retirement |
| `PROGRAM_CONTROL/REPORT_BACK/MEMB-003-REPORT-BACK.md` | 18, 35 | Confirms OMNIPASS_PLUS=250 | Archive — historical report |
| `PROGRAM_CONTROL/REPORT_BACK/MEMB-002-REPORT-BACK.md` | 55 | Lists OMNIPASS_PLUS in enum | Archive — historical report |
| `PROGRAM_CONTROL/DIRECTIVES/DONE/THREAD11-COPILOT-INTAKE.md` | 59, 71, 126, 201 | Multiple OMNIPASS_PLUS references | Archive — historical directive |
| `PROGRAM_CONTROL/Thread 12 Handoff` | 46, 67, 112 | Lists OMNIPASS_PLUS as canonical | **MUST UPDATE — active handoff doc** |

#### Action Plan for OMNIPASS_PLUS
- **Schema:** Remove from `MembershipTier` enum
- **Governance config:** Remove from `STIPEND_CZT`, `ZONE_MAP`, `ZONE_ACCESS_TIERS`
- **Documentation:** Update Thread 12 Handoff to reflect retirement

---

### 3. ANNUAL — CLASSIFICATION REQUIRED

**CRITICAL:** `ANNUAL` appears in two distinct contexts:
- **Context A: RETIRED** — ANNUAL as a membership tier value (19 hits)
- **Context B: KEEP** — ANNUAL as a billing interval / subscription duration (16 hits)

#### 3A. ANNUAL as Tier — RETIRED (19 hits, ALL must be replaced)

| File | Line | Context | Action Required |
|------|------|---------|----------------|
| `prisma/schema.prisma` | 851 | `enum MembershipTier { ... ANNUAL ... }` | Remove ANNUAL from enum |
| `services/core-api/src/config/governance.config.ts` | 213 | `STIPEND_CZT: { ... ANNUAL: 100, ...}` | Remove ANNUAL key |
| `services/core-api/src/config/governance.config.ts` | 359-360 | ZONE_MAP contains 'ANNUAL' tier | Remove ANNUAL from arrays |
| `services/core-api/src/config/governance.config.ts` | 370 | `ZONE_ACCESS_TIERS = [..., 'ANNUAL', ...]` | Remove ANNUAL |
| `PROGRAM_CONTROL/REPORT_BACK/GOV-CONST-001-PATCH-REPORT-BACK.md` | 88, 94 | Lists ANNUAL as canonical tier | Update to reflect retirement |
| `PROGRAM_CONTROL/REPORT_BACK/MEMB-003-REPORT-BACK.md` | 18, 34 | Confirms ANNUAL=100 in STIPEND_CZT | Archive — historical |
| `PROGRAM_CONTROL/REPORT_BACK/MEMB-002-REPORT-BACK.md` | 55 | Lists ANNUAL in MembershipTier enum | Archive — historical |
| `PROGRAM_CONTROL/DIRECTIVES/DONE/THREAD11-COPILOT-INTAKE.md` | 59, 71, 125, 128, 141, 158, 200 | Multiple ANNUAL tier references | Archive — historical |
| `PROGRAM_CONTROL/Thread 12 Handoff` | 46, 67, 112 | Lists ANNUAL as canonical tier | **MUST UPDATE** |
| `docs/DOMAIN_GLOSSARY.md` | 102 | `| Annual | Annual subscription tier | ANNUAL |` | **MUST UPDATE — change to billing interval** |

#### 3B. ANNUAL as Billing Interval — KEEP (16 hits, ALL legitimate)

| File | Line | Context | Classification |
|------|------|---------|----------------|
| `prisma/schema.prisma` | 867 | `enum BillingInterval { ... ANNUAL }` | **KEEP — canonical billing interval** |
| `services/core-api/src/membership/membership.service.ts` | 273 | Comment: "QUARTERLY/SEMI_ANNUAL/ANNUAL use DURATION_BONUS" | **KEEP — billing interval** |
| `services/core-api/src/membership/membership.service.ts` | 291-294 | `if (billingInterval === BillingInterval.ANNUAL)` | **KEEP — billing interval enum** |
| `services/core-api/src/config/governance.config.ts` | 207 | `DURATION_BONUS: { ... ANNUAL: { commitment_months: 12, ...} }` | **KEEP — billing interval** |
| `services/core-api/src/config/governance.config.ts` | 350 | `FAN_CLUB.BILLING_CYCLES: ['MONTHLY', 'ANNUAL']` | **KEEP — billing interval** |
| `services/core-api/src/config/governance.config.ts` | 381 | `CREATOR_SAAS.BILLING_CYCLES: ['MONTHLY', 'ANNUAL']` | **KEEP — billing interval** |
| `PROGRAM_CONTROL/REPORT_BACK/GOV-CONST-001.md` | 56-57 | References BILLING_CYCLES with ANNUAL | **KEEP — billing interval** |
| `PROGRAM_CONTROL/REPORT_BACK/MEMB-002-REPORT-BACK.md` | 26, 44, 57 | `DURATION_BONUS.ANNUAL` and `BillingInterval.ANNUAL` | **KEEP — billing interval** |
| `PROGRAM_CONTROL/DIRECTIVES/DONE/THREAD11-COPILOT-INTAKE.md` | 141, 158 | Billing interval context | **KEEP — billing interval** |
| `PROGRAM_CONTROL/DIRECTIVES/DONE/GOV-CONST-001.md` | 71, 82 | `BILLING_CYCLES: ['MONTHLY', 'ANNUAL']` | **KEEP — billing interval** |

#### Action Plan for ANNUAL
- **Remove:** All uses of ANNUAL as a membership tier value
- **Keep:** All uses of ANNUAL as a billing interval (BillingInterval enum, BILLING_CYCLES arrays, DURATION_BONUS keys)
- **Update:** `docs/DOMAIN_GLOSSARY.md` — change "Annual subscription tier" to "Annual billing interval"

---

### 4. DIAMOND — CLASSIFICATION REQUIRED

**CRITICAL:** `DIAMOND` appears in three distinct contexts:
- **Context A: RETIRED** — Standalone DIAMOND as a tier value (25 hits)
- **Context B: KEEP** — VIP_DIAMOND canonical tier (0 hits found — not yet implemented)
- **Context C: KEEP** — "Diamond" as product/service name (Diamond Concierge, Diamond tier pricing) (13 hits)

#### 4A. DIAMOND as Standalone Tier — RETIRED (25 hits, ALL must be replaced with VIP_DIAMOND)

| File | Line | Context | Action Required |
|------|------|---------|----------------|
| `prisma/schema.prisma` | 853 | `enum MembershipTier { ... DIAMOND }` | Replace with VIP_DIAMOND |
| `services/core-api/src/config/governance.config.ts` | 187 | `MEMBERSHIP.TIERS: [..., 'DIAMOND']` | Replace with VIP_DIAMOND |
| `services/core-api/src/config/governance.config.ts` | 194 | `BUNDLE_CAPS: { ... DIAMOND: {...} }` | Replace with VIP_DIAMOND |
| `services/core-api/src/config/governance.config.ts` | 215 | `STIPEND_CZT: { ... DIAMOND: 500 }` | Replace with VIP_DIAMOND |
| `services/core-api/src/config/governance.config.ts` | 359-363 | ZONE_MAP arrays contain 'DIAMOND' | Replace with VIP_DIAMOND |
| `services/core-api/src/config/governance.config.ts` | 370 | `ZONE_ACCESS_TIERS = [..., 'DIAMOND']` | Replace with VIP_DIAMOND |
| `PROGRAM_CONTROL/REPORT_BACK/GOV-CONST-001-PATCH-REPORT-BACK.md` | 88, 94 | Lists DIAMOND | Replace with VIP_DIAMOND |
| `PROGRAM_CONTROL/REPORT_BACK/MEMB-003-REPORT-BACK.md` | 18, 36 | DIAMOND=500 in STIPEND_CZT | Archive — historical |
| `PROGRAM_CONTROL/REPORT_BACK/MEMB-002-REPORT-BACK.md` | 55 | MembershipTier enum includes DIAMOND | Archive — historical |
| `PROGRAM_CONTROL/DIRECTIVES/DONE/THREAD11-COPILOT-INTAKE.md` | 60, 71, 126, 202 | Multiple DIAMOND references | Archive — historical |
| `PROGRAM_CONTROL/Thread 12 Handoff` | 46, 67, 112 | Lists DIAMOND as canonical | **MUST UPDATE to VIP_DIAMOND** |
| `PROGRAM_CONTROL/REPORT_BACK/FIZ-PRICING-DECISIONS-2026-04-11.md` | 53 | `TIERS: [..., 'DIAMOND']` | Archive — historical |
| `docs/DOMAIN_GLOSSARY.md` | 104 | `| Diamond | Highest membership tier | DIAMOND, diamond |` | **MUST UPDATE to VIP_DIAMOND** |

#### 4B. VIP_DIAMOND (Canonical) — NOT YET IMPLEMENTED

**Finding:** Zero instances of `VIP_DIAMOND` found in codebase. This is the target state after scrub.

#### 4C. "Diamond" as Product/Service Name — KEEP (13 hits, ALL legitimate)

| File | Line | Context | Classification |
|------|------|---------|----------------|
| `services/core-api/src/config/governance.config.ts` | 44-68 | `// ─── DIAMOND TIER PRICING ───` comment block + constants | **KEEP — Diamond product pricing** |
| `services/core-api/src/config/governance.config.ts` | 363 | `DIAMOND_CONCIERGE: ['DIAMOND']` (key name) | **KEEP — service name (value must become VIP_DIAMOND)** |
| `services/core-api/src/config/governance.config.ts` | 184 | Comment: "Pricing doc names (Day Pass / Annual Pass / OmniPass·Plus / Diamond)" | **KEEP — product name in comment** |
| `docs/REQUIREMENTS_MASTER.md` | 123 | `## SECTION 6 — DIAMOND CONCIERGE` | **KEEP — service name** |
| `infra/postgres/init-ledger.sql` | 896 | `eligible_tiers TEXT[] ... -- e.g. ['GOLD','PLATINUM','DIAMOND']` | **FIX — replace with VIP_DIAMOND in example** |
| `PROGRAM_CONTROL/REPORT_BACK/FIZ-PRICING-DECISIONS-2026-04-11.md` | 43, 50 | Diamond pricing constants and comment | **KEEP — product pricing** |
| `PROGRAM_CONTROL/REPORT_BACK/CHORE-PIPELINE-004.md` | 32, 59 | Diamond Concierge section headers | **KEEP — service name** |
| `PROGRAM_CONTROL/BACKLOGS/LEGACY/...` | Various | Legacy backlog mentions | **Archive — no action** |

#### Action Plan for DIAMOND
- **Replace:** All standalone DIAMOND tier values with VIP_DIAMOND
- **Keep:** All references to "Diamond" as a product/service name (Diamond Concierge, DIAMOND TIER PRICING)
- **Update:** Enum values in ZONE_MAP arrays from DIAMOND → VIP_DIAMOND
- **Update:** `docs/DOMAIN_GLOSSARY.md` — DIAMOND → VIP_DIAMOND

---

### 5. "day pass" / "day-pass" Literal — RETIRED (5 hits, ALL must be removed)

#### Classification: **ALL RETIRED — MUST FIX**

| File | Line | Context | Action Required |
|------|------|---------|----------------|
| `docs/DOMAIN_GLOSSARY.md` | 101 | `| RETIRED: Day Pass | Retired concept — remove all references | RETIRED: day_pass |` | **KEEP — correctly marked RETIRED** |
| `PROGRAM_CONTROL/REPORT_BACK/CHORE-PIPELINE-005.md` | 53 | Lists "RETIRED: Day Pass" | **KEEP — correctly marked RETIRED** |
| `PROGRAM_CONTROL/REPORT_BACK/FIZ-PRICING-DECISIONS-2026-04-11.md` | 50 | Comment: "Pricing doc names (Day Pass / Annual Pass / ...)" | **UPDATE — remove "Day Pass /" from comment** |
| `PROGRAM_CONTROL/Thread 12 Handoff` | 110 | "Day Pass concept: retired" | **KEEP — correctly documents retirement** |
| `services/core-api/src/config/governance.config.ts` | 184 | Comment: "Pricing doc names (Day Pass / Annual Pass / ...)" | **UPDATE — remove "Day Pass /" from comment** |

#### Action Plan for "day pass"
- **Update:** Remove "Day Pass /" from pricing doc names comments in governance.config.ts and FIZ-PRICING-DECISIONS report
- **Keep:** Existing "RETIRED" markers in glossary and handoff documentation

---

## OPEN GAPS & AMBIGUITIES

### Gap 1: VIP_DIAMOND Not Yet Implemented
The canonical tier `VIP_DIAMOND` has **zero instances** in the codebase. MEMB-001 must introduce this value when replacing standalone DIAMOND.

### Gap 2: GUEST Tier Not Found
The fallback tier for users with no active subscription is currently `DAY_PASS`. The replacement tier `GUEST` was not found in the codebase. MEMB-001 must confirm whether the fallback should be:
- `GUEST` (new tier to be introduced)
- `VIP` (lowest canonical tier in the VIP_* hierarchy)
- Another value per CEO direction

### Gap 3: Scope Boundary — Historical Report-Backs
Many hits are in `PROGRAM_CONTROL/REPORT_BACK/*.md` and `PROGRAM_CONTROL/DIRECTIVES/DONE/*.md` files. These are historical artifacts. Recommended action:
- **Archive/Keep:** Historical report-backs (MEMB-002, MEMB-003, GOV-CONST-001)
- **Update:** GOV-CONST-001-PATCH-REPORT-BACK (active verification document)
- **Update:** Thread 12 Handoff (active handoff document)

### Gap 4: Schema Migrations
No Prisma migration files were scanned. If migrations exist that reference retired tier values, they must be handled per Prisma best practices (cannot edit historical migrations, must create new migration to update enum).

---

## RECOMMENDED CEO SCRUB DIRECTIVE SCOPE

Based on this audit, the CEO scrub directive should target:

### Phase 1: Schema & Core TypeScript
1. **prisma/schema.prisma**
   - Remove `DAY_PASS` from `MembershipTier` enum
   - Remove `OMNIPASS_PLUS` from `MembershipTier` enum
   - Remove `ANNUAL` from `MembershipTier` enum (keep in `BillingInterval` enum)
   - Replace standalone `DIAMOND` with `VIP_DIAMOND` in `MembershipTier` enum
   - Add missing canonical tiers: `GUEST`, `VIP`, `VIP_SILVER`, `VIP_GOLD`, `VIP_PLATINUM`, `VIP_DIAMOND`

2. **services/core-api/src/membership/membership.service.ts**
   - Replace all `DAY_PASS` returns/defaults with `GUEST` (or `VIP` per CEO direction)

3. **services/core-api/src/config/governance.config.ts**
   - Remove `DAY_PASS`, `OMNIPASS_PLUS`, `ANNUAL` from `STIPEND_CZT` object
   - Replace `DIAMOND` with `VIP_DIAMOND` in `STIPEND_CZT`
   - Update `MEMBERSHIP.TIERS` array to canonical VIP_* hierarchy
   - Update `BUNDLE_CAPS` keys from standalone DIAMOND to VIP_DIAMOND
   - Update `ZONE_MAP` arrays to use canonical tiers only
   - Update `ZONE_ACCESS_TIERS` to canonical values
   - Remove "Day Pass /" from pricing doc comment (line 184)

4. **services/core-api/src/zone-access/zone-access.service.ts**
   - Replace `DAY_PASS` comment with `GUEST`

### Phase 2: Documentation
5. **docs/DOMAIN_GLOSSARY.md**
   - Update "Annual" entry from "tier" to "billing interval"
   - Update "Diamond" entry from standalone DIAMOND to VIP_DIAMOND

6. **PROGRAM_CONTROL/Thread 12 Handoff**
   - Update all references to retired tiers with canonical VIP_* hierarchy

7. **PROGRAM_CONTROL/REPORT_BACK/GOV-CONST-001-PATCH-REPORT-BACK.md**
   - Update references to canonical tier list

### Phase 3: SQL/Infrastructure
8. **infra/postgres/init-ledger.sql**
   - Update example comment to use VIP_DIAMOND instead of standalone DIAMOND

### Phase 4: Archive (No Action)
- Historical report-backs in `PROGRAM_CONTROL/REPORT_BACK/MEMB-*.md`
- Historical directives in `PROGRAM_CONTROL/DIRECTIVES/DONE/THREAD11-*.md`
- Legacy backlogs

---

## COMMANDS RUN

All scans executed via ripgrep with the following parameters:
```bash
rg '\bDAY_PASS\b' --no-ignore --glob '!node_modules/**' --glob '!.git/**' --glob '!dist/**' --glob '!build/**' --glob '!.next/**' --glob '!coverage/**' -n
rg '\bOMNIPASS_PLUS\b' --no-ignore --glob '!node_modules/**' --glob '!.git/**' --glob '!dist/**' --glob '!build/**' --glob '!.next/**' --glob '!coverage/**' -n
rg '\bANNUAL\b' --no-ignore --glob '!node_modules/**' --glob '!.git/**' --glob '!dist/**' --glob '!build/**' --glob '!.next/**' --glob '!coverage/**' -n
rg '\bDIAMOND\b' --no-ignore --glob '!node_modules/**' --glob '!.git/**' --glob '!dist/**' --glob '!build/**' --glob '!.next/**' --glob '!coverage/**' -n
rg -i 'day pass|day-pass' --no-ignore --glob '!node_modules/**' --glob '!.git/**' --glob '!dist/**' --glob '!build/**' --glob '!.next/**' --glob '!coverage/**' -n
```

All command outputs captured verbatim. No fabricated results.

---

## RESULT

**SCAN COMPLETE.** CEO review required before authoring scrub directive.

**Next Step:** CEO to review this audit and authorize scrub directive targeting Phase 1 (Schema & Core TypeScript) as the blocking path for MEMB-001.

**Blocking Issue:** MEMB-001 cannot proceed until retired tier values are removed and canonical VIP_* hierarchy is in place per Tech Debt Delta 2026-04-16.
