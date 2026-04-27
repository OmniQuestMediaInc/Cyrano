# CNZ Membership Lifecycle Policy

**Status:** v1.0 — CEO-approved working draft
**Authority:** Kevin B. Hartley, CEO — OmniQuest Media Inc.
**Adopted:** 2026-04-17
**Repo path:** `docs/MEMBERSHIP_LIFECYCLE_POLICY.md`
**Supersedes:** Any prior tier definitions in `docs/REQUIREMENTS_MASTER.md`, `docs/DOMAIN_GLOSSARY.md`, handoff docs, governance configuration, or service code. On conflict, **this document wins**; diverging code is the bug.

> This document is the source of truth for membership tier semantics, lifecycle, expiry, age-verification cadence, token interaction, card-on-file requirements, and the separation between tiers and products. Schema, service code, governance configuration, feature gates, and agent directives must derive from this policy. All future threads and coding agents (Claude Chat, Copilot, Claude Code) must treat this file as authoritative.
>
> **TBD markers** indicate open policy questions that block named downstream scopes. Do not implement anything marked TBD without CEO resolution.

---

## 1. Tier Enum (locked)

`MembershipTier` has exactly six values, in monotonic rank order:

| Rank | Enum | Paid? | Card on file required? | Age re-verification cadence |
|---|---|---|---|---|
| 0 | `GUEST` | No | No (ephemeral per purchase) | On reactivation from expiry/lock |
| 1 | `VIP` | No | Yes | Every 30 days |
| 2 | `VIP_SILVER` | Yes | Yes | On each new paid-tier purchase (≈ every 3 months) |
| 3 | `VIP_GOLD` | Yes | Yes | On each new paid-tier purchase (≈ every 3 months) |
| 4 | `VIP_PLATINUM` | Yes | Yes | On each new paid-tier purchase (≈ every 3 months) |
| 5 | `VIP_DIAMOND` | Yes | Yes | On each new paid-tier purchase (≈ every 3 months) |

### 1.1 Retired values — must not appear as `MembershipTier` in schema, code, or config

- `DAY_PASS` — concept fully retired
- `ANNUAL` — never a tier; may appear elsewhere only as a billing-interval label
- `OMNIPASS_PLUS` — is a **product**, not a tier (see §7)
- Standalone `DIAMOND` — canonical form is `VIP_DIAMOND`

### 1.2 "Guest" as terminology

"Guest" as a word in product copy may refer to a visitor or user colloquially. When used as a tier enum value, it always means `GUEST` as defined above.

---

## 2. Tier Gates (locked)

A user advances through three distinct unlock gates, each with its own prerequisite:

| Gate | Prerequisite | Unlocks |
|---|---|---|
| Gate 1 | Account creation + initial age verification | `GUEST` |
| Gate 2 | Complete card-on-file record (see §5) + **second** age verification | `VIP` |
| Gate 3 | Payment for a 90-day paid-tier block + age verification on the new purchase | `VIP_SILVER` / `VIP_GOLD` / `VIP_PLATINUM` / `VIP_DIAMOND` |

---

## 3. Tier Expiry & Lifecycle (locked)

### 3.1 `GUEST`

- **Expires every 31 days** (30 nominal + 1 grace) from account creation OR last reactivation
- At expiry: account **locks** — no purchases, no token spending, no access
- Locked account retained until **day 366 post-lock**, then fully **purged**
- Recovery window (days 1–366 post-lock): user reactivates by **completing fresh age verification and confirming the non-card profile data on file**, OR by upgrading to VIP (Gate 2) or a paid tier (Gate 3)
- On successful reactivation: any tokens still alive on their own expiry clocks become spendable again
- After day 366 with no reactivation: full account purge, including any remaining tokens (which have typically already expired on their own clocks by that point)

### 3.2 `VIP`

- **Does not expire.** VIP is permanent once earned.
- **Age re-verification required every 30 days.** This is a cadence, not an expiry.
- Failing to complete age re-verification at the 30-day checkpoint: account is **fully suspended** — no access until verification completes. Options for completing verification are sent by email to the account holder.
- Successful re-verification resumes full VIP access.

### 3.3 Paid Tiers (`VIP_SILVER` / `VIP_GOLD` / `VIP_PLATINUM` / `VIP_DIAMOND`)

- **Sold in 90+1 day blocks** (90 nominal + 1 grace day) per purchase
- At block expiry with no renewal: tier **drops to `VIP`** (provided card-on-file and VIP age-verification cadence are current); the free VIP floor then persists indefinitely per §3.2
- Age re-verification required **on each new paid-tier purchase** (tied to purchase cadence, approximately every 3 months — not calendar-tied)
- Failing age re-verification at the paid-tier purchase checkpoint: account is **fully suspended**, same treatment as §3.2. Options sent by email.

### 3.4 Downgrade / State-Change Ladder

| From state | Trigger | To state |
|---|---|---|
| `GUEST` active | 31 days elapsed, no upgrade | `GUEST` locked (account status flag; not a new tier value) |
| `GUEST` locked | 366 days elapsed post-lock, no reactivation | Purged |
| `VIP` | Age re-verification failure at 30-day checkpoint | Fully suspended (tier unchanged) |
| Paid tier | 90+1 days elapsed, no renewal | `VIP` |
| Paid tier | Age re-verification failure at purchase checkpoint | Fully suspended (tier unchanged) |
| `VIP` or any paid tier | Card-on-file becomes incomplete | Frozen (see §5; tier unchanged) |

Tier changes, locks, suspensions, and freezes all write immutable rows to `MembershipTierTransition` (append-only, per ledger invariants) with: user ID, previous state, new state, trigger type, actor ID, timestamp (America/Toronto), `rule_applied_id`, `organization_id`, `tenant_id`.

---

## 4. Age Verification (locked)

Age verification must be **freshly captured** at each of the following events:

1. New account creation (unlocks `GUEST`)
2. Transition from `GUEST` to `VIP` (second verification required)
3. Every 30 days while at `VIP` tier (cadence)
4. On each new paid-tier purchase (≈ every 3 months)
5. Reactivation of a locked `GUEST` account
6. Reactivation after any suspension caused by age-verification failure

Each verification event writes an immutable row to `AgeVerification` (append-only) with: user ID, verification method, result, timestamp (America/Toronto), `rule_applied_id`, triggering event type, `organization_id`, `tenant_id`.

Failed verification at any cadence checkpoint fully suspends the account. Suspension is orthogonal to tier — the `MembershipTier` value does not change during suspension; only the account status flag changes. Options for re-completing verification are sent by email.

---

## 5. Card-on-File Requirements (locked)

"Card-on-file" for VIP and above requires **all** of the following fields to be complete and valid:

- Full cardholder name
- Billing address
- Phone number
- Email address
- Card expiration date
- Card CVV / security code (back of card)

If **any** of these fields is missing, incomplete, or becomes invalid, the account is **frozen**:

- No new purchases (tokens, tier renewal, tier upgrade, product purchases)
- No token spending from existing balance
- Tokens remain alive on their own expiry clocks
- Account persists; freeze lifts immediately once the complete card-on-file record is restored and verified

This freeze applies equally to `VIP` and all paid tiers. The `MembershipTier` enum value **does not change** during a card freeze; only the account status flag changes.

`GUEST` is exempt from card-on-file because Guests never have stored card data (see §6).

---

## 6. Guest Purchase Flow (locked)

Guests **can** purchase tokens from the rack token menu, with these constraints:

- Card data is entered **fresh per transaction**
- Card data is **never stored** by the platform
- Transactions run through hosted fields / Payment Element; platform never sees raw PAN (PCI scope minimized)
- No recurring billing, no one-click repurchase, no saved payment method

### 6.1 Pre-Payment Confirmation Sequence

Every Guest purchase requires **three affirmative confirmations before the transaction reaches the payment processor gate**:

1. Confirmation of the purchase itself
2. Re-confirmation of age
3. Re-confirmation of understanding of the no-refunds policy

### 6.2 Confirmation Code Mechanic

Confirmation is delivered via a **6-digit-plus-1-letter code** generated by the platform and sent to the user via SMS or email (per the user's stored preference). The purchase screen displays the confirmation prompts and awaits code input. Only after correct code entry does the purchase proceed to the payment processor.

### 6.3 Ledger Treatment

Guest purchases are credited to the user's CZT balance with 365+1 day life, identical to VIP+ purchase ledger entries. The `payment_method_id` field on the ledger row is **null** for Guest purchases (no saved method exists).

---

## 7. Products vs Tiers — Separate Domain (locked)

Products (membership privileges / add-ons) are **orthogonal** to the tier enum. They live in their own domain (working name: `Pass` / `Entitlement` / `ProductPurchase` — final naming TBD in PASS-001).

A user's full state is `(tier, [active_products])`. Feature gates must check the correct axis:

- Tier gate: "is user `VIP_GOLD` or above?" → query `Membership`
- Product gate: "does user hold active `OmniPass+`?" → query `Pass` / `Entitlement`

### 7.1 OmniPass

- Purchasable on top of **any** membership tier
- Provides a token multiplier in the VIPShowZone theater
- **Multiplier value: TBD §9.1**

### 7.2 OmniPass+

- Purchasable on top of **any** membership tier
- Provides a token multiplier in **both** VIPShowZone theater **and** Bijou
- **Multiplier value: TBD §9.1**

### 7.3 SilverBullet (not a product — tier variant)

- **Not in the product domain.** SilverBullet is a 30-day on-ramp **variant of `VIP_SILVER`**, modeled as a `product_variant` column on the subscription, not as a pass
- Tier enum value for SilverBullet holders is `VIP_SILVER`
- Currently only Silver has a bullet variant — no GoldBullet / PlatinumBullet / DiamondBullet exist
- Designed upgrade funnel: SilverBullet → standard Silver at end of 30 days

### 7.4 Product Lifecycle Out of Scope

Product purchase, pricing, expiry, and renewal cadence are **out of scope for this document**. They will be defined in PASS-001 (or similarly named) directive under the product domain.

---

## 8. Token Lifecycle × Tier Interactions (locked)

Tokens are governed primarily by their own expiry clocks, **not** by membership state. This section captures only the tier-relevant interactions. Full token lifecycle (Upgrade Escalator, Quarterly Silver Surge, expiry rescue offers, etc.) is referenced here and specified in full under §9.6.

### 8.1 Token Types & Lifespans

| Token type | Lifespan from credit date | Burn priority when user spends |
|---|---|---|
| Dripped tokens (from paid-tier membership drip schedule) | 45 + 1 days | **Burn first** |
| Purchased tokens (rack menu, Upgrade Escalator) | 365 + 1 days | Burn after dripped |

### 8.2 Tier × Token Matrix

| Tier | Receives dripped tokens? | Can purchase tokens? | Can spend tokens? |
|---|---|---|---|
| `GUEST` | **No** (purchased only) | Yes (with per-purchase card entry + confirmation flow §6) | Yes, while account is active and not locked |
| `VIP` | No | Yes | Yes |
| `VIP_SILVER` / `GOLD` / `PLATINUM` / `DIAMOND` | Yes, per paid-tier drip schedule | Yes | Yes |

### 8.3 Tokens Survive Membership State Changes

- Tokens are **not** forfeited on tier demotion, paid-tier expiry, VIP age-verification failure, or card freeze
- Tokens **are** inaccessible during card freeze or account suspension, but their expiry clocks continue to run
- If tokens are still alive when an account is reactivated, they become spendable again with remaining lifespan intact
- **Only the token's own expiry clock forfeits tokens** (to the house, via an append-only ledger entry tagged with the appropriate reason code)
- On `GUEST` account purge at day 366 post-lock, any tokens still alive (rare given 365+1 day purchased-token clock) are forfeited as part of the purge event

### 8.4 Upgrade Escalator (live mechanic — summary reference)

Any fiat top-up of **2,500 or 5,000 tokens** at any point during a renewal / retention / support conversation:

- Resets the **entire** token balance to 365+1 days
- Waives extension fees
- Can be applied mid-call by ZoneCrew.HumanContact
- Must be supported as an explicit API path, not a manual CSR workaround

Alternative path: pay the expressed extension fee and extend **expired** tokens by **45 days only** (no balance reset).

Full token-expiry rescue sequence (pre-expiry notifications, Silent Grace, Last Call pricing): TBD §9.6.

---

## 9. Open Policy Questions — TBD

The following items are **not** settled and must be resolved before their named downstream scopes can be implemented.

### 9.1 OmniPass & OmniPass+ token multiplier values

- **Blocks:** PASS-001 scope, dynamic-pricing rules in `governance.config.ts`
- **Question:** Exact multiplier value for OmniPass in VIPShowZone? Same for OmniPass+ in both VIPShowZone and Bijou? Fixed multiplier or variable by room/event/tier?
- **Current state:** CEO noted value is TBD in the 2026-04-17 thread

### 9.2 OmniPass & OmniPass+ pricing, expiry cadence, renewal behavior

- **Blocks:** PASS-001
- **Question:** Pricing per pass? Duration per purchase? Auto-renew, lapse-to-nothing, or lapse-with-grace? Interaction with tier changes (does a pass carry across a tier drop)?

### 9.3 Additional products in the pass domain

- **Blocks:** PASS-001 scoping completeness
- **Question:** Besides OmniPass and OmniPass+, are there other pass-style products currently in scope? (ShowZonePass was referenced in legacy spec — status unclear.)

### 9.4 Paid-tier drip schedule specifics

- **Blocks:** Paid-tier MEMB-002 / MEMB-003
- **Question:** Exact drip cadence and token amounts per tier (Silver / Gold / Platinum / Diamond) within a 90-day cycle? Legacy spec referenced Day-1 / Day-31 / Day-61 drips for 3-month commitments — confirm against current plan.

### 9.5 SilverBullet pricing and nudge cadence

- **Blocks:** MEMB-003 (if SilverBullet in scope), MEMB-005 (nudge engine)
- **Question:** SilverBullet price ($14.99 per legacy spec — confirm)? Compressed nudge cadence (T-5d / T-48h / T-24h per legacy spec — confirm)?

### 9.6 Full token-expiry rescue sequence

- **Blocks:** TOK-00X directive series (expiry + rescue offers), ZoneCrew.HumanContact escalator tooling
- **Question:** Full specification of the T-10d / T-72h / T-24h pre-expiry notification sequence, Silent Grace Day +1 offer ($9.99 extension vs bundle Upgrade Escalator), Last Call at +72h ($14.99 variant), breakage conversion rules. Legacy spec exists — needs explicit adoption as canonical.

### 9.7 Quarterly Silver Surge mechanics

- **Blocks:** MEMB-SURGE directive (seasonal promo engine)
- **Question:** Confirm 4-for-3 at 15% margin, Silver-tier only, once per quarter. Start/end date determination (fiscal calendar, marketing calendar, manual)?

### 9.8 Diamond Concierge binding

- **Reference only — already established:** 11 AM – 11 PM service window in guest billing-address time zone, last call 10:30 PM, 10:30–11:00 PM for documentation. Binds to `VIP_DIAMOND` tier. Does not require policy action here; documented for cross-reference.

---

## 10. Authority & Change Control

- This document is authored and owned by Kevin B. Hartley, CEO — OmniQuest Media Inc.
- Changes require CEO approval and a commit to `docs/MEMBERSHIP_LIFECYCLE_POLICY.md` on the main branch
- Any directive (Claude Chat / Copilot / Claude Code) that touches tier, membership, age-verification, card-on-file, or token-expiry semantics **must cite the specific section of this document it implements or derives from**
- When a directive resolves a TBD from §9, the policy doc is updated in the same PR that delivers the implementation — doc and code change together, not separately
- Downstream canonical documents (`REQUIREMENTS_MASTER.md`, `DOMAIN_GLOSSARY.md`, governance configuration) must be brought into alignment with this document on next touch

---

## 11. Cross-Thread Working Agreement (meta)

This section is operational rather than policy-substantive, but it is binding:

- Thread handoffs authored by Claude Chat for CEO review **must be committed to the repo** at `PROGRAM_CONTROL/HANDOFFS/THREAD-NN-HANDOFF.md`, not stored in Google Drive
- Policy documents authored for CEO review **must be delivered as single copyable code blocks** (this document is the reference format) so the CEO can paste-and-commit without splitting content across messages
- Any coding-agent directive (Copilot task, Claude Code droid directive) authored by Claude Chat **must also be delivered as a single copyable code block** with no prose interleaved inside the block
- Claude Chat must not extrapolate policy details beyond what the CEO has explicitly stated. When uncertain, Claude Chat asks rather than guesses, and flags uncertainty explicitly rather than silently filling gaps
