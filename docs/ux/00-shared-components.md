# Shared / Cross-Stack Components

**Role:** All  
**Purpose:** Reusable primitives for consistency across RRR, Cyrano, and ChatNow.Zone.  
**Status:** reviewed  
**Authority:** Kevin B. Hartley, CEO — OmniQuest Media Inc.  
**Applies to repos:** OmniQuestMediaInc/RRR · OmniQuestMediaInc/Cyrano · OmniQuestMediaInc/ChatNowZone--BUILD

---

## API / Presenter Binding

### TierBadge

| Prop | Type | Description |
|------|------|-------------|
| `tierName` | `string` | Guest tier label (e.g., `"Gold"`, `"Diamond"`) |
| `capPercent` | `number` | Redemption cap percentage for this tier |
| `isDiamondConcierge` | `boolean` | Renders Diamond Concierge accent when `true` |

---

### WalletBuckets / EscrowView

Three-bucket display (or RRR equivalent) surfacing the guest's token balance split by origin.

| Bucket | DB column | Origin tag |
|--------|-----------|------------|
| Purchased | `czt_balance` | `PURCHASED` |
| Gifted | `czt_balance` | `GIFTED` |
| Escrow / Held | `escrow_hold` | — |

> **Note:** RRR renders its equivalent balance panel in place of WalletBuckets wherever the ChatNow.Zone three-bucket layout is not applicable.

---

### ComplianceOverlay

Full-screen modal triggered by any compliance gate event. Covers:

- **Bill 149** — age-gating and consent capture
- **GateGuard Sentinel™** — welfare and transaction block decisions
- **Welfare Guardian** — band-based spend limits
- **Step-up challenge** — MFA / identity re-verification before high-value actions

Overlay must block all underlying UI interaction until the guest completes or dismisses the required step.

---

### AuditRow

Tabular row component for rendering a single audit log entry.

| Prop | Type | Description |
|------|------|-------------|
| `correlationId` | `string` | UUID linking to the originating transaction or event |
| `reasonCode` | `string` | Canonical `reason_code` value (see `DOMAIN_GLOSSARY.md`) |
| `timestamp` | `string` | ISO-8601 UTC timestamp |
| `actorId` | `string` | Guest, Creator, or Agent ID who triggered the event |
| `summary` | `string` | Human-readable one-line description |

Every `AuditRow` **must** include a `reason_code`. Rows without a `reason_code` must not be rendered.

---

## Layout Intent (Mobile-First)

```
┌─────────────────────────────────────────┐
│  Header: TierBadge + FFS/Inferno meter  │  ← visible only when FFS/Inferno is active
├─────────────────────────────────────────┤
│  WalletBuckets / Balance panel          │
├─────────────────────────────────────────┤
│  Main content                           │
├─────────────────────────────────────────┤
│  Compliance banner / overlay            │  ← full-screen modal when triggered
├─────────────────────────────────────────┤
│  Bottom nav or FAB (primary CTA)        │
└─────────────────────────────────────────┘
```

Stack renders top-to-bottom in this order on all three platforms. Full-screen compliance overlays render above the entire stack via a portal / z-index layer — they do not displace other layout regions.

---

## Interactions

### High-Value Actions → StepUpModal

Any action classified as high-value (large token spend, payout trigger, tier change) must route through the StepUpModal flow:

```
Challenge prompt → MFA verification → grant / deny → AuditRow written
```

- On **grant**: action proceeds; `AuditRow` written with `reason_code: STEP_UP_GRANTED`.
- On **deny**: action blocked; `AuditRow` written with `reason_code: STEP_UP_DENIED`.
- The `correlation_id` on the `AuditRow` must match the originating transaction's `correlation_id`.

---

### FFS High-Heat → Diamond Concierge Handoff

When the FFS (Fan Favourite Score) meter reaches the high-heat threshold, the platform surfaces a Diamond Concierge handoff offer to the guest.

- Applicable on **ChatNow.Zone** and **Cyrano**.
- Handoff offer renders as a non-blocking banner beneath the FFS/Inferno meter in the header region.
- Accepting the offer triggers a Diamond Concierge session; declining dismisses the banner for the current session.

---

## Copy Slots

Standard copy template used across all three platforms wherever tier/compliance status is surfaced:

```
{tier} • {cap}% redemption • Inferno ×{multiplier} • Welfare Guardian: {band}
```

| Slot | Source | Example |
|------|--------|---------|
| `{tier}` | `TierBadge.tierName` | `Gold` |
| `{cap}%` | `TierBadge.capPercent` | `80%` |
| `{multiplier}` | Active Inferno multiplier value | `1.5` |
| `{band}` | Welfare Guardian spend-band label | `Standard` |

Inferno and Welfare Guardian slots are omitted from the rendered string when their respective features are inactive for the guest.
