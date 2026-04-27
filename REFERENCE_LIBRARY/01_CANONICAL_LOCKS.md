# OQMInc Canonical Locks
Authority: Kevin B. Hartley, CEO — OmniQuest Media Inc.
Last updated: 2026-04-26
Status: IMMUTABLE — changes require explicit CEO authorization

---

## MEMBERSHIP TIER ENUM

**Exactly 6 values. Locked. Never add or remove without CEO authorization.**

GUEST
VIP
VIP_SILVER
VIP_GOLD
VIP_PLATINUM
VIP_DIAMOND

---

## RETIRED TIER VALUES (NEVER USE)

The following values were REMOVED from the MembershipTier enum and must
NEVER be used as enum values in any code, schema, or directive:

- DAY_PASS (removed — use product OmniPass instead)
- ANNUAL (removed — use product OmniPass+ instead)
- OMNIPASS_PLUS (removed — never was a tier, always a product)
- DIAMOND (removed — use VIP_DIAMOND instead)

---

## PRODUCTS (NOT TIERS)

These are add-on products, not membership tiers:

| Product | Type | Purpose |
|---------|------|---------|
| OmniPass | Day-pass product | 24-hour all-access pass |
| OmniPass+ | Annual product | 365-day all-access pass |
| ShowZonePass | Event product | Single-show access |
| SilverBullet | Rescue product | Token-expiry rescue, tier nudge |

---

## PLATFORM NAME

**Canonical:** ChatNow.Zone
**Domain:** chatnow.zone
**Banned:** ChatNowZone (no dots), CNZ-only usage acceptable in internal docs

---

## CURRENCY

**Canonical:** ChatZoneTokens (CZT)
**Never:** credits, coins, points, gems

---

## PAYOUT ENGINE

**Canonical:** Flicker n'Flame Scoring (FFS)
**Rate states (4 levels):**
- RATE_COLD
- RATE_WARM
- RATE_HOT
- RATE_INFERNO

### RETIRED RATE STATES (NEVER USE)

The following rate state was REMOVED and must NEVER be used as a rate
state value in any code, schema, or directive:

- RATE_BLAZING (retired 2026-04-26 — collapsed into RATE_INFERNO per
  PAYLOAD-10 alignment to GovernanceConfig.HEAT_BAND_* canonical bands;
  see `PROGRAM_CONTROL/REPORT_BACK/PAYLOAD-10-ALIGNMENT-SWEEP.md`)

---

## VIDEO INFRASTRUCTURE

**Canonical:** LiveKit OSS (self-hosted)
**SFU cluster name:** Bijou
**Never:** Agora, Twilio, AWS IVS, proprietary vendor SDKs

---

## GOVERNANCE GATES

All GOV-prefixed work requires clearance artifacts in:
`PROGRAM_CONTROL/CLEARANCES/{GATE-ID}-CLEARANCE.md`

| Gate | Status | Scope |
|------|--------|-------|
| GOV-FINTRAC | CEO-AUTHORIZED-STAGED 2026-04-11 | DFSP-002–008 |
| GOV-AGCO | CEO-AUTHORIZED-STAGED 2026-04-11 | DFSP-002–008 |
| GOV-AV | BRANCH-AND-HOLD | AV-001 only |

---

## DIAMOND CONCIERGE

**Binding:** VIP_DIAMOND tier only
**Hours:** 11:00 AM – 11:00 PM (guest billing-address timezone)
**Last call:** 10:30 PM
**Never:** available to lower tiers, 24/7, automated fallback to AI

---

## EXPIRY POLICY

**Token expiry:** 90 days from credit (GovernanceConfig constant)
**Rescue mechanism:** SilverBullet product offer before expiry
**No automatic extensions:** All expiry dates are hard deadlines

---

## NATS TOPICS

All NATS topic identifiers MUST use constants from:
`services/nats/topics.registry.ts`

**Never:** string literals for topic names in event publish/subscribe calls

---

## FINANCIAL INTEGRITY ZONE (FIZ)

All changes to the following require REASON/IMPACT/CORRELATION_ID in commits:

- Balance columns (any table)
- Payout rate logic
- Token credit/debit flows
- Escrow state transitions
- Welcome credit issuance
- GateGuard Sentinel welfare decisions
- Cyrano premium feature gating

---

## MULTI-TENANT MANDATE

Every Prisma write operation MUST include:
- organization_id
- tenant_id

**No exceptions.** All entities are scoped to org + tenant.

---

## SCHEMA INTEGRITY

Every financial or audit table MUST include:
- correlation_id (UUID or structured ID)
- reason_code (GovernanceConfig constant or enum value)

---

## PACKAGE MANAGER

**Canonical:** Yarn
**Never:** npm, pnpm

All install/update commands use `yarn` exclusively.

---

*END CANONICAL LOCKS*
