# RedRoomRewards — CEO Decisions Final Record
**Date:** 2026-04-17
**Authority:** Kevin B. Hartley, CEO — OmniQuest Media Inc.
**Status:** ALL DECISIONS LOCKED — full engineering ground truth

---

## D1 — Slot Machine: RETIRED
Slot machine and chance-based game logic is retired. Archive or remove from repo.
- SLOT_MACHINE_BRIEFING.md: archive or delete
- docs/specs/SLOT_MACHINE_SPEC_v1.0.md: archive or delete
- All slot machine code paths in src/: remove
- archive/xxxchatnow-seed/: remove

## D2 — Primary Tenant: ChatNow.Zone
XXXChatNow.com was the prior platform name. All references must be updated to ChatNow.Zone.
ChatNow.Zone is merchant tenant 1. RedRoomPleasures and Cyrano onboard first (Phase 1).
ChatNow.Zone is Phase 2 with full CNZ/RRR integration.

## D3 — Diamond Concierge Earn: Zero Points
Diamond Concierge purchases earn 0 RRR points.
The discount is built into Diamond pricing.
RRR points CAN be burned (applied) against a Diamond purchase.
No earn event fires on Diamond Concierge transactions.
RRR-P3-003 is REMOVED from build scope.

## D4 — Flicker n'Flame Scoring Inferno Bonus Multiplier: Configurable + Guardrails
Inferno bonus earn multiplier is active when ALL THREE conditions are met:
1. Guest has tipped during the session
2. Guest remains in the room
3. Tip activity not idle for more than 30 minutes
Multiplier value: merchant-configurable via inferno_multiplier field on EarnRateConfig.
Merchants must set this value explicitly — cannot be null at activation.

## D5 — GGS Integration: Deferred
GGS (GateGuard Sentinel) is CNZ's pre-payment welfare and fraud scoring layer.
RRR should build webhook-ready integration points to receive GGS signals.
Hold logic (blocking earn on COOL_DOWN/HARD_DECLINE): deferred until directed.

---

## B1 — Inferno Multiplier Value
DECISION: Merchant-configurable. No platform default.
Each merchant sets inferno_multiplier on EarnRateConfig during onboarding.
Value required before program activation — RRR rep validates.

## B2 — Tier Structure: Dual Layer
Layer 1 — Merchant tier (launch): merchant defines customer tiers.
  Earn rates, redemption caps, promo eligibility configurable per merchant tier.
Layer 2 — RRR member tier (future): cross-merchant platform tier.
  Architecture must support it from Day 1. Do not build for launch.
  IdentityLink carries merchant_tier (required).
  LoyaltyAccount carries rrr_member_tier (nullable at launch).

## B3 — Launch Sequence
Phase 1: RedRoomPleasures + Cyrano (first merchants — operational learning)
Phase 2: ChatNow.Zone (full CNZ/RRR integration after Phase 1 learning)

## B4 — Cross-Merchant Exchange Rate: 1:1 Default, Configurable Architecture
Launch value: 1:1 (1 RRR point at Merchant A = 1 RRR point at Merchant B).
Architecture must support configurable per-merchant-pair rates in future.
Implementation: cross_merchant_exchange_rate field on MerchantPairConfig model, default 1.0.
Ledger records the rate at time of redemption (append-only — historical records unaffected).
Future research required: standard coalition loyalty reconciliation patterns (Air Miles,
Amex Membership Rewards, etc.) — inter-merchant liability, float, and reconciliation design.

## B5 — Tier-Based Redemption Caps: Merchant-Configurable
No platform defaults. Each merchant sets max_discount_percent per tier in TierCapConfig.
Configurable placeholders for testing (replace with real numbers before testing begins):
  PLATINUM: max_discount_percent = 50.0
  GOLD:     max_discount_percent = 35.0
  SILVER:   max_discount_percent = 20.0
  MEMBER:   max_discount_percent = 10.0
  GUEST:    max_discount_percent = 5.0

---

## EXPANDED VISION (CEO Note — All Locked as Requirements)

RRR operates as a standalone SaaS loyalty engine offered via API to merchant partners.
Not embedded in any single product.

Merchant requirements:
- Merchant login and reporting surface (web-based)
- Merchant account managed by an RRR account representative
- All custom earn/burn programs require RRR account rep authorization before activation

Consumer member requirements:
- Consumer login surface (web-based)
- Cross-merchant balance visibility
- Cross-merchant redemption — zero friction at checkout

Template types required:
- Standard earn/burn templates (pre-built, merchant selects)
- Customizable earn/burn templates (merchant configures within guardrails, rep authorizes)
- Couponing (discount codes triggering point bonuses or redemption unlocks)
- Points with purchase (standard earn)
- Added bonus on specific products (product-level earn multiplier)
- Redemption windows (time-limited periods where burn ratios improve)
- Customer segmentation (attach any promotion to a defined member segment)
- General communications (segment-targeted email/in-app messages)

Pre-checkout requirements (RRR API called before payment processor):
- Consumer sees how many points are available to apply to this purchase
- Consumer sees how many points they will earn from this purchase
- Consumer can choose a custom amount to apply (not forced to use system recommendation)
- Resulting price shown after redemption applied
- Coordinated with GateGuard Sentinel pre-payment processing (single coherent view)

Governance: all RRR build must adhere to OmniQuest Media Inc. Canonical Corpus
as minimum standard for governance, safety, and security.

---

*Authority: Kevin B. Hartley, CEO — OmniQuest Media Inc. — 2026-04-17*
