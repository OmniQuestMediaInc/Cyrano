# PAYLOAD 10 — REDBOOK + Business Plan Final Alignment Sweep

**Branch:** `copilot/update-rebbook-business-plan`
**Authority:** OQMI_GOVERNANCE.md + DOMAIN_GLOSSARY.md (naming authority)
**Directive:** Ensure 100% fidelity across REDBOOK rate cards, recovery flows, Diamond pricing,
70/30 expiry, Token Bridge / 3/5ths logic, creator payout floors, Flicker n'Flame Scoring tiers, Cyrano
categories, and GateGuard pre-processor. Update every comment, constant, and test with
authoritative language.

---

## Files Changed

```
services/creator-control/src/ffs.engine.ts           MODIFIED — HeatTier rename + threshold alignment
services/creator-control/src/session-monitoring.copilot.ts MODIFIED — BLAZING → INFERNO
services/integration-hub/src/hub.service.ts                MODIFIED — BLAZING → INFERNO
services/cyrano/src/cyrano.service.ts                      MODIFIED — BLAZING → INFERNO (all 8 weight keys + logic)
services/core-api/src/config/governance.config.ts          MODIFIED — 3 constant/comment corrections
tests/integration/creator-control-service.spec.ts          MODIFIED — BLAZING → INFERNO + threshold-consistent input
tests/integration/cyrano-service.spec.ts                   MODIFIED — BLAZING → INFERNO (6 occurrences)
tests/integration/integration-hub.spec.ts                  MODIFIED — BLAZING → INFERNO
PROGRAM_CONTROL/REPORT_BACK/PAYLOAD-10-ALIGNMENT-SWEEP.md  NEW
```

---

## Changes Applied

### 1 — Flicker n'Flame Scoring Tier Naming: BLAZING → INFERNO

**File:** `services/creator-control/src/ffs.engine.ts`

- `HeatTier` type: `'COLD' | 'WARM' | 'HOT' | 'BLAZING'` → `'COLD' | 'WARM' | 'HOT' | 'INFERNO'`
- `TIER_THRESHOLDS` aligned to canonical GovernanceConfig bands (locked per DOMAIN_GLOSSARY.md
  `RATE_COLD/RATE_WARM/RATE_HOT/RATE_INFERNO`):

  | Tier    | Old threshold (min) | New threshold (min) |
  |---------|---------------------|---------------------|
  | INFERNO | 75 (was BLAZING)    | 86                  |
  | HOT     | 50                  | 61                  |
  | WARM    | 25                  | 34                  |
  | COLD    | 0                   | 0                   |

  Old thresholds (0/25/50/75) were inconsistent with GovernanceConfig canonical bands
  (HEAT_BAND_COLD_MAX=33, HEAT_BAND_WARM_MAX=60, HEAT_BAND_HOT_MAX=85, INFERNO=86+).

- `if (score.tier === 'BLAZING')` → `if (score.tier === 'INFERNO')` (NATS peak-emit gate).
- Comment updated: spec reference to "Business Plan B.4 §4.2" replaced with authoritative
  reference to GovernanceConfig canonical bands.

### 2 — Session Monitoring Copilot: BLAZING → INFERNO

**File:** `services/creator-control/src/session-monitoring.copilot.ts`

- `NUDGE_POLICY` key: `BLAZING` → `INFERNO`
- `reason_code`: `HEAT_BLAZING_PRICE_PUSH` → `HEAT_INFERNO_PRICE_PUSH`

### 3 — Integration Hub: BLAZING → INFERNO

**File:** `services/integration-hub/src/hub.service.ts`

- `PAYOUT_SCALING_PCT_BY_TIER` key: `BLAZING: 0.10` → `INFERNO: 0.10`
- `MONETIZATION_TRIGGER_TIERS`: `new Set(['HOT', 'BLAZING'])` → `new Set(['HOT', 'INFERNO'])`

### 4 — Cyrano Service: BLAZING → INFERNO

**File:** `services/cyrano/src/cyrano.service.ts`

- `CATEGORY_TIER_WEIGHTS` record type and all 8 category keys: `BLAZING` → `INFERNO`
- Recovery override logic: `frame.heat.tier !== 'BLAZING'` → `frame.heat.tier !== 'INFERNO'`
- Comment: `BLAZING→ MONETIZATION / ESCALATION / CLOSE` → `INFERNO→ MONETIZATION / ESCALATION / CLOSE`

### 5 — Governance Constants: Comment + Token Type Corrections

**File:** `services/core-api/src/config/governance.config.ts`

- `RECOVERY_ENGINE` comment: `CS: commit` → `REDBOOK: commit`
  (corrects commit prefix to canonical enum per DOMAIN_GLOSSARY.md)
- `MERCHANDISE_CONFIG.ACCEPTED_TOKEN_TYPE`: `'CHATTOKEN'` → `'CZT'`
  (aligns to DOMAIN_GLOSSARY canonical token: CZT / ChatZoneTokens is the only currency)
- `FAN_CLUB.ACCEPTED_TOKEN_TYPE`: `'CHATTOKEN'` → `'CZT'` (same reason)
- `DIAMOND_TIER.PAYOUT_RATE_PER_TOKEN` comment: "creator payout floor for Diamond" was
  misleading (0.075 is RATE_COLD, the standard cold-band rate; the actual Diamond 10K+ floor
  is GovernanceConfig.RATE_DIAMOND_FLOOR = 0.080). Comment updated to clarify.

### 6 — Tests Updated

All BLAZING references updated to INFERNO in:
- `tests/integration/creator-control-service.spec.ts` — 3 occurrences + threshold-consistent
  input for "does NOT publish PRICE_NUDGE when HOLD" (tippers_online 25 → 40, ensuring score
  40 ≥ 34 to produce WARM under the new threshold; score 25 < 34 was COLD under new thresholds,
  which correctly published a LOWER nudge — test input updated, not the policy).
- `tests/integration/cyrano-service.spec.ts` — 6 occurrences
- `tests/integration/integration-hub.spec.ts` — 2 occurrences

---

## Validation Checks

| # | Check | Result |
|---|-------|--------|
| 1 | `yarn lint services/**/*.ts --max-warnings 0` | PASS |
| 2 | `yarn test` — all suites except pre-existing legacy | 293 passed / 0 failed |
| 3 | REDBOOK rate cards in governance.config.ts verified | PASS — unchanged; TEASE_REGULAR, TEASE_SHOWZONE, DIAMOND_TIER, VELOCITY_MULTIPLIERS all match REDBOOK |
| 4 | 70/30 expiry split verified | PASS — EXPIRED_CREATOR_POOL_PCT=0.70, EXPIRED_PLATFORM_PCT=0.30 |
| 5 | Token Bridge 20% verified | PASS — TOKEN_BRIDGE_BONUS_PCT=0.20 |
| 6 | 3/5ths Exit 60% refund + 24h lock verified | PASS — THREE_FIFTHS_REFUND_PCT=0.60, THREE_FIFTHS_LOCK_HOURS=24 |
| 7 | Diamond $49 extension, $79 recovery fees verified | PASS — EXTENSION_FEE_USD=49, RECOVERY_FEE_USD=79 |
| 8 | Creator payout floors: COLD $0.075, WARM $0.080, HOT $0.085, INFERNO $0.090 | PASS — GovernanceConfig constants unchanged and correct |
| 9 | Diamond 10K+ bulk floor = $0.080 (RATE_DIAMOND_FLOOR) | PASS — confirmed GovernanceConfig.RATE_DIAMOND_FLOOR = Decimal('0.080') |
| 10 | 8 Cyrano categories per Business Plan B.3.5 | PASS — CYRANO_CATEGORIES unchanged; all 8 present |
| 11 | GateGuard Welfare Guardian thresholds: APPROVE <40, COOLDOWN 40-69, HARD_DECLINE 70-89, HUMAN_ESCALATE 90+ | PASS — DECISION_THRESHOLDS unchanged and correct |
| 12 | HeatTier canonical naming: COLD/WARM/HOT/INFERNO matches DOMAIN_GLOSSARY | PASS — corrected in this payload |
| 13 | Pre-existing typecheck error (`admin-recovery.controller.ts`) | PRE-EXISTING — confirmed present before any changes; out of scope |
| 14 | Pre-existing test failure (`ledger-service.spec.ts` TokenType.REGULAR) | PRE-EXISTING — confirmed present before any changes; noted in PAYLOAD 1–3 |

---

## Flagged — CEO Decision Required Before Fix

The following RETIRED tier names remain in active code. They form a consistent internal system
(ZONE_MAP, membership.service.ts, zone-access.service.ts, recovery.types.ts, and
MEMBERSHIP.STIPEND_CZT all use the same RETIRED vocabulary), so changing any one without all
others breaks zone access enforcement at runtime. A coordinated mapping update requires a
CEO-approved transition table.

| Location | Retired names present |
|----------|-----------------------|
| `ZONE_MAP` (governance.config.ts) | `DAY_PASS`, `ANNUAL`, `OMNIPASS_PLUS`, `DIAMOND` |
| `ZONE_ACCESS_TIERS` (governance.config.ts) | `DAY_PASS`, `ANNUAL`, `OMNIPASS_PLUS`, `DIAMOND` |
| `MEMBERSHIP.TIERS` (governance.config.ts) | `SILVER`, `GOLD`, `PLATINUM`, `DIAMOND` (short-form, non-canonical) |
| `MEMBERSHIP.STIPEND_CZT` (governance.config.ts) | `DAY_PASS`, `ANNUAL`, `OMNIPASS_PLUS`, `DIAMOND` |
| `membership.service.ts` fallback | returns `'DAY_PASS'` on no-active-subscription |
| `zone-access.service.ts` comment | references `DAY_PASS` |
| `recovery.types.ts WalletSnapshot.tier` | `'DAY_PASS' | 'ANNUAL' | 'OMNIPASS_PLUS' | 'DIAMOND' | string` |
| `diamond-concierge-service.spec.ts` | `tier: 'OMNIPASS_PLUS'` test fixture |

Canonical canonical mapping per DOMAIN_GLOSSARY:
- `DAY_PASS` → `GUEST`
- `ANNUAL` → `VIP`
- `OMNIPASS_PLUS` → uncertain (product, not tier; closest is `VIP_SILVER`?)
- `DIAMOND` (standalone) → `VIP_DIAMOND`
- Short form `SILVER/GOLD/PLATINUM` → `VIP_SILVER/VIP_GOLD/VIP_PLATINUM`

**CEO action required:** Confirm the RETIRED→CANONICAL tier mapping for zone access and stipend
computation, then authorize a coordinated update across all six files above.

---

## Result: SUCCESS

PAYLOAD 10 alignment sweep complete. All REDBOOK rates, recovery flows, Diamond pricing,
70/30 expiry, Token Bridge, 3/5ths logic, Flicker n'Flame Scoring tiers, Cyrano categories, and GateGuard
pre-processor constants are fidelity-verified or corrected to canonical authoritative language.
293 tests pass. 0 new failures introduced.
