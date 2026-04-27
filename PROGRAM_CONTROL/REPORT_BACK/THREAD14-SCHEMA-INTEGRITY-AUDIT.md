# Schema Integrity Audit — Post PR#254/#255
Date: 2026-04-19
Thread: 15
Auditor: Claude Code (Droid)
Directive ID: THREAD14-SCHEMA-INTEGRITY-AUDIT
Correlation ID: THREAD14-SCHEMA-INTEGRITY-AUDIT
Repo HEAD at audit: `95c5584` (origin/main — `CHORE: update REPO_MANIFEST [skip ci]`)
Note: supersedes the prior read-only audit in commit `c1a778b` (2026-04-18);
      same directive path per Thread 15 re-run.

---

## 1. Schema File Findings

File: `prisma/schema.prisma` — PRESENT (45,283 bytes, 1 file)

**Does the `MembershipTier` enum exist?** → **PRESENT** (canonical, not partial).

Declaration at `prisma/schema.prisma:865-872`:

```
865  enum MembershipTier {
866    GUEST
867    VIP
868    VIP_SILVER
869    VIP_GOLD
870    VIP_PLATINUM
871    VIP_DIAMOND
872  }
```

Exactly the six canonical values mandated by `docs/MEMBERSHIP_LIFECYCLE_POLICY.md v1.0` §1.1. Retired values (`DAY_PASS`, `ANNUAL`-as-tier, `OMNIPASS_PLUS`, standalone `DIAMOND`) are NOT present.

**Models with fields typed as `MembershipTier`:**

| Line | Model | Field | Type Declaration |
|-----:|-------|-------|------------------|
| 922 | `Membership` | `tier` | `MembershipTier` |
| 950 | `MembershipTierTransition` | `previous_tier` | `MembershipTier?` (nullable) |
| 951 | `MembershipTierTransition` | `new_tier` | `MembershipTier` |
| 1032 | `MembershipSubscription` | `tier` | `MembershipTier` |

**Models previously typed to `MembershipTier` that now reference a different enum or `String`:**
**NONE.** Grep across `prisma/schema.prisma` for `MembershipTier` returns exactly the one enum declaration and four field usages above. No `String // TODO: assign correct domain enum` artefacts from PR #254/#255 remain.

**`@@index` and `@@unique` constraints mentioning tier fields:**
- `@@index([tier])` on `Membership` at line 938 — 1 occurrence.
- No `@@unique` constraint mentions any tier field.
- `@@index([user_id, status])` on `MembershipSubscription` at 1047 — no tier reference.

Total: **1 `@@index` on a `MembershipTier`-typed field; 0 `@@unique`.**

---

## 2. PR History — merge state

| PR | Title | State | Merged At (UTC) | Merge Commit SHA | Head SHA | Files |
|---:|-------|-------|------------------|------------------|----------|------:|
| #254 | `[WIP] Remove MembershipTier enum and update field types` | closed / merged | 2026-04-17T09:34:15Z | `2d81e8cb349b9409c30a13720542d6f219f9d2ad` | `17864eb` | 1 commit |
| #255 | `[WIP] Remove MembershipTier enum and all its usage from Prisma schema` | closed / merged | 2026-04-17T09:42:59Z | `996dba0e67c500b88d450d68af014850bc18cea7` | `9ba7907` | 1 commit |
| #265 | `FIZ: MEMB-001 — Membership schema foundation` | closed / merged | 2026-04-17T15:50:15Z | `fc1dc38d10cd3e4359dcfb78046f8813be8b4d1f` | `c7c50cd` | 4 files (+375 / −7) |
| RRR-P1-006 | platform name canonicalization — **NOT FOUND** | — | — | — | — |

`mcp__github__search_pull_requests` query `RRR-P1-006 repo:OmniQuestMediaInc/ChatNowZone--BUILD` returned `total_count: 0`. No PR for RRR-P1-006 exists at audit time.

**Temporal ordering note:** PR #265 (MEMB-001 canonical schema foundation) merged ~6 hours AFTER PR #254/#255. #265 supersedes and over-writes the `[WIP]` removal both prior PRs performed. The schema now on `main` reflects PR #265, not #254/#255.

---

## 3. Seed Files

| File | Present? | Refs `MembershipTier` enum values? | Breaks without enum? |
|------|:--------:|:----------------------------------:|:--------------------:|
| `prisma/seed.ts` | YES | YES (imports `MembershipTier` from `@prisma/client`, line 11; uses all 6 canonical tier literals in `TIER_FIXTURES` lines 19–54) | YES — would not compile if enum removed |
| `prisma/seed.test.ts` | YES | YES (negative-space guardrail — asserts enum-block contents match `CANONICAL_TIERS` exactly and that retired `DAY_PASS`/`ANNUAL`/`OMNIPASS_PLUS`/`DIAMOND` never reappear) | YES — explicit assertion that enum `MembershipTier` exists and has the six canonical values |

`seed.test.ts` exists (3087 bytes). Thread 14 CI-wiring concern is satisfied: the guardrail file is committed to main.

Tier string literals in `seed.ts` (`'GUEST'`, `'VIP'`, `'VIP_SILVER'`, `'VIP_GOLD'`, `'VIP_PLATINUM'`, `'VIP_DIAMOND'`) match the canonical enum exactly — no drift.

---

## 4. Directive Queue State

`PROGRAM_CONTROL/DIRECTIVES/QUEUE/` directory listing:

```
total 8
drwxr-xr-x 2 root root 4096 Apr 18 23:19 .
drwxr-xr-x 5 root root 4096 Apr 18 23:19 ..
-rw-r--r-- 1 root root    0 Apr 18 23:19 .gitkeep
```

- `.gitkeep` only. Queue is **EMPTY** (no active directives).
- `THREAD11-COPILOT-INTAKE.md` — **NOT FOUND** in `QUEUE/`.
- `THREAD11-DIRECTIVE-SERIES-001.md` — **NOT FOUND** in `QUEUE/`.

Last commit touching the queue directory:
`0b0b6038519ff881c993857fc1295caa3e53f0ad` on 2026-04-17T11:26:30+00:00 —
`CHORE: Remove duplicate directive file from QUEUE`.

Queue decontamination from Thread 12→13 is complete. No files beyond `.gitkeep` to report.

---

## 5. Requirements Master

File: `docs/REQUIREMENTS_MASTER.md` — **PRESENT** (23,246 bytes).

- **Last commit:** `06b11c2966a440041e372e4aa36a9fe2ce435cf6` on 2026-04-17T04:16:21-04:00 (`Merge pull request #251 from OmniQuestMediaInc/copilot/begin-task-from-thread11-directive`).
- **CCZ / FC / OPS / DISC series authorized?** → **NO.** Grep for `CCZ-|^FC-|^OPS-|^DISC-` returned zero matches. Also **no RRR-P1-006 row** present. Per directive expectation (CEO will authorize in Thread 15), this is correct.
- **MEMB series listed?** → **NO.** Grep for `MEMB-` returned zero matches in `REQUIREMENTS_MASTER.md`. MEMB-001 through MEMB-005 are NOT documented in the master index despite MEMB-001 having merged via PR #265. This is a documentation-drift flag, not a schema issue.

---

## 6. Governance Config

Per directive the audit path is `services/core-api/src/governance/governance.config.ts` (DFSP governance). This file does NOT contain the constants the directive lists. Those constants live at the platform path `services/core-api/src/config/governance.config.ts`. Both paths are reported for completeness.

### 6.a `services/core-api/src/governance/governance.config.ts` (DFSP — directive-specified path)

File present (5926 bytes).

| Constant | Present? | Notes |
|----------|:--------:|-------|
| `MEMBERSHIP.TIERS` | **NO** | file contains no `MEMBERSHIP` key |
| `SHOWTOKEN_EXCHANGE` block with VIP/SILVER/GOLD/PLATINUM/DIAMOND keys | **NO** | no `SHOWTOKEN_EXCHANGE` symbol |
| `TOKEN_EXTENSION` block | **NO** | no `TOKEN_EXTENSION` symbol |
| `DIAMOND_TIER.VOLUME_TIERS` | **NO** | no `DIAMOND_TIER` symbol |

DFSP governance currently holds only: integrity-hold parameters, purchase-window hours, risk scoring, diamond-token threshold, OTP settings, account-recovery hold, contract-offer expiry, voice-sample limits, PROC-001 webhook constants, Flicker n'Flame Scoring payout rates (PAY-001..PAY-005), heat-band boundaries, DFSP_CONCIERGE block, BIJOU block. **Nothing tier-related.**

### 6.b `services/core-api/src/config/governance.config.ts` (platform)

File present (21,438 bytes).

| Constant | Present? | Current Value / Location |
|----------|:--------:|--------------------------|
| `MEMBERSHIP` export (module-level `const`) | **YES** | line 182 |
| `MEMBERSHIP.TIERS` | **YES** | line 187: `['VIP', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'] as const` |
| `SHOWTOKEN_EXCHANGE` with VIP/SILVER/GOLD/PLATINUM/DIAMOND keys | **NO** — no `SHOWTOKEN_EXCHANGE` symbol in the file |
| `TOKEN_EXTENSION` block | **YES** | line 220 (Options A/B/C schema, not per-tier keys) |
| `DIAMOND_TIER.VOLUME_TIERS` | **YES** | line 56 — 3-tier array `[10000–27499 @ 0.095, 30000–57499 @ 0.088, 60000–∞ @ 0.082]` |
| `MEMBERSHIP.STIPEND_CZT` | **YES** | line 211: keys are `DAY_PASS / ANNUAL / OMNIPASS_PLUS / DIAMOND` — **retired-terminology drift** |
| `MEMBERSHIP.DURATION_BONUS` | **YES** | line 204 — `QUARTERLY / SEMI_ANNUAL / ANNUAL` |

**Drift flags (do not block MEMB-series schema-layer work):**
1. `MEMBERSHIP.TIERS` array uses legacy labels `['VIP','SILVER','GOLD','PLATINUM','DIAMOND']` — missing `GUEST` and not in `VIP_SILVER`/`VIP_GOLD`/`VIP_PLATINUM`/`VIP_DIAMOND` canonical form.
2. `MEMBERSHIP.STIPEND_CZT` map keys are the retired tier names `DAY_PASS`, `ANNUAL`, `OMNIPASS_PLUS`, `DIAMOND` — this map no longer maps onto the `MembershipTier` Prisma enum and breaks the invariant documented in `seed.test.ts`.

---

## 7. Typecheck Sanity

Command: `npx tsc --noEmit` (repo root, single run, no baseline stash).

- **Exit code:** `1`
- **Total error count:** `1`
- **Full output (verbatim, 2 lines):**

```
tsconfig.json(12,5): error TS5101: Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0. Specify compilerOption '"ignoreDeprecations": "6.0"' to silence this error.
  Visit https://aka.ms/ts6 for migration information.
```

- **Errors mentioning `MembershipTier` / `tier` / `membership_tier`:** **NONE.** Grep against the full tsc output matched zero lines.
- The sole error is a pre-existing `tsconfig.json` deprecation notice unrelated to schema state or PR #254/#255/#265. Per CLAUDE.md `## Step 7 — TypeScript check`, pre-existing errors on the baseline are acceptable.

---

## 8. VERDICT

### **CLEAN — MEMB-series safe to resume.**

PR #265 (MEMB-001) merged ~6 hours after PR #254/#255 and fully restored the canonical `MembershipTier` enum plus all dependent models (`Membership`, `MembershipTierTransition`, `AgeVerification`, `CardOnFile`, `MembershipSubscription`). The `[WIP] Remove MembershipTier enum` work in #254/#255 is not observable on `main` — it has been overwritten by the canonical foundation. `prisma/seed.ts` and `prisma/seed.test.ts` both align with the canonical six-value enum and guardrail against the retired values returning. Queue is empty; no conflicting directives in flight. Zero MembershipTier-related typecheck errors.

### Non-blocking advisories (documentation / governance drift — NOT schema integrity)

These do not block MEMB-002 and do not require halting MEMB-series schema or service work, but should be scheduled as separate remediation directives at CEO discretion.

1. **`MEMBERSHIP.TIERS` platform governance drift.**
   `services/core-api/src/config/governance.config.ts:187` holds `['VIP','SILVER','GOLD','PLATINUM','DIAMOND']`. Canonical Prisma enum is `GUEST | VIP | VIP_SILVER | VIP_GOLD | VIP_PLATINUM | VIP_DIAMOND`. Recommended remediation: **CHORE-GOV-MEMBERSHIP-TIERS-CANONICAL** — realign platform `MEMBERSHIP.TIERS` to the enum, add a compile-time type guard importing the Prisma enum.
2. **`MEMBERSHIP.STIPEND_CZT` retired-tier keys.**
   `services/core-api/src/config/governance.config.ts:211-216` keys are `DAY_PASS / ANNUAL / OMNIPASS_PLUS / DIAMOND` — all retired per policy §1.1. Recommended remediation: **FIZ: STIPEND-CZT-TIER-REALIGN** — re-key stipend map onto canonical `MembershipTier` values; MEMB-003 consumer (`stipend-distribution.job.ts:140`) currently reads `STIPEND_CZT[tier]` where `tier` is a `MembershipTier` enum value, so the map currently fails lookup at runtime for canonical tiers.
3. **`REQUIREMENTS_MASTER.md` missing MEMB-series rows.**
   MEMB-001 is DONE (PR #265) but not indexed in the master. MEMB-002..005 queued in upcoming thread work have no entries. Recommended remediation: **CHORE-REQ-MASTER-MEMB-ROWS** — append a Section 13 (Membership Lifecycle) to `docs/REQUIREMENTS_MASTER.md` with the five MEMB-series IDs.
4. **No RRR-P1-006 PR on record.**
   Directive RRR-P1-006 (platform name canonicalization) has no PR in `OmniQuestMediaInc/ChatNowZone--BUILD`. If CEO expected this merged, investigate whether it landed under a different branch-naming convention before authorizing downstream Thread-15 work that depends on it.

### Go / No-Go for Thread 15 MEMB-series

- MEMB-002, MEMB-003, MEMB-004, MEMB-005 **schema layer → GO.** The Prisma enum, models, indexes, seeds, and guardrail are intact and match the canonical spec.
- MEMB-003 **service-code layer → conditional on advisory (2) above.** `stipend-distribution.job.ts` will null-out stipends for every canonical tier at runtime until `STIPEND_CZT` keys are re-aligned. Recommend remediating advisory (2) before MEMB-003 service work lands.

---

## Reference — Audit Artefacts

- `prisma/schema.prisma` enum block: lines 865–872
- `prisma/schema.prisma` MembershipTier field usages: lines 922, 950, 951, 1032
- `prisma/schema.prisma` tier index: line 938 (`@@index([tier])` on `Membership`)
- `prisma/seed.ts`: 119 lines, imports `MembershipTier` line 11
- `prisma/seed.test.ts`: 95 lines, canonical-set assertion lines 63–67; retired-set assertion lines 70–79
- Platform governance `MEMBERSHIP` block: lines 181–217
- Platform governance `TOKEN_EXTENSION` block: lines 220–234
- Platform governance `DIAMOND_TIER.VOLUME_TIERS`: lines 56–60
- DFSP governance (`services/core-api/src/governance/governance.config.ts`): 110 lines, no MEMBERSHIP/SHOWTOKEN/TOKEN_EXTENSION/DIAMOND_TIER symbols
- `docs/REQUIREMENTS_MASTER.md` last mutation: `06b11c2` on 2026-04-17

---

**End of audit. No code changes. No migration run. No seed run. No PR opened.**
