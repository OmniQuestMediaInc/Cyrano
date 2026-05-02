# Wireframe exemplar 01 — `/wallet` (three-bucket display)

**Binding contract:** `WalletThreeBucketView` in
`ui/types/public-wallet-contracts.ts:84-93`.
**Page builder:** `ui/app/wallet/page.ts`.
**Presenter:** `ui/view-models/public-wallet.presenter.ts`.
**SEO:** `noindex,nofollow` (authenticated route).
**Roles:** Guest / VIP / VIP_SILVER / VIP_GOLD / VIP_PLATINUM /
VIP_DIAMOND — own wallet only. Operators see read-only via
`/admin/recovery` case detail.

This exemplar is the **format** Grok matches across all
guest-facing surfaces. Every UI element ties to a named field on
the presenter contract.

---

## Page layout (mobile-first; breakpoints 375 / 768 / 1280 / 1680)

```
┌───────────────────────────────────────────────────────┐
│ [tier-badge: tier]              [reconnect-pill?]      │  header
├───────────────────────────────────────────────────────┤
│  Total balance                                         │
│  {total_tokens} CZT                                    │  hero
│                                                        │
├───────────────────────────────────────────────────────┤
│  ▸ purchased  ▮▮▮▮▮▮▮▮▮▮▮▮▮▯▯  {balance} CZT  [Drains first]
│  ▸ membership ▮▮▮▮▮▮▯▯▯▯▯▯▯▯▯  {balance} CZT  [Drains next]
│  ▸ bonus      ▮▯▯▯▯▯▯▯▯▯▯▯▯▯▯  {balance} CZT  [Last to drain]
│                                                        │  buckets
├───────────────────────────────────────────────────────┤
│  [safety-net offer card — only if safety_net != null]  │
│  Tokens expire in {hours}h                             │
│  [Extend +{n}d  $X]  [Token Bridge +{pct}%]  [3/5ths]  │  recovery
├───────────────────────────────────────────────────────┤
│  [Buy tokens]    [View history]                        │  footer CTAs
└───────────────────────────────────────────────────────┘
```

---

## Field bindings

Every UI element below points to a named contract field. Wireframes
must not introduce fields the contract does not expose.

| UI element | Field | Notes |
|---|---|---|
| tier badge | `WalletThreeBucketView.tier` | uses `GuestTier` (presenter shorthand: `GUEST` \| `MEMBER` \| `DIAMOND`); shared `tier-badge` component |
| total balance | `WalletThreeBucketView.total_tokens` | `bigint` arrives as string; format with thousands separator |
| bucket row label | `WalletBucketRow.label` | localized; do not derive from bucket key |
| bucket row description | `WalletBucketRow.description` | tooltip text |
| bucket row balance | `WalletBucketRow.balance_tokens` | `bigint` as string |
| bucket row priority chip | `WalletBucketRow.spend_priority` | 1 / 2 / 3 |
| "Drains next" indicator | `WalletBucketRow.will_drain_next` | true on the top non-empty bucket |
| safety-net card | `WalletThreeBucketView.safety_net` | render only when non-null |
| safety-net hours | `SafetyNetOfferCard.hours_until_expiry` | from contract |
| Extend CTA fee | `SafetyNetOfferCard.extension_fee_usd` | + grant days |
| Token Bridge CTA bonus | `SafetyNetOfferCard.token_bridge_bonus_pct` | enabled only when `has_token_bridge_eligible: true` |
| 3/5ths CTA refund pct | `SafetyNetOfferCard.three_fifths_refund_pct` | + lock_hours |
| reconnect pill | NATS subscription health | shown when NATS is reconnecting; never silent-fail |
| Buy tokens CTA | navigates to `/tokens` | guest tier shows guest rates; member tier shows member rates (per `TokenBundleRateCard.tier`) |

---

## States

| State | Trigger | Visual |
|---|---|---|
| empty (no balance, no expiry) | total_tokens = "0", safety_net = null | encouraging empty state with Buy CTA |
| loaded | normal | layout above |
| safety-net active | `safety_net != null` | recovery section visible |
| safety-net expired | `hours_until_expiry <= 0` | restricted-experience-overlay |
| WGS intervention active | overlay from §10 | welfare-intervention-overlay covers page |
| legal hold | `LEGAL_HOLD_ACTIVE` | full-account-lockout |
| reconnecting | NATS subscription drop | reconnect pill + dimmed live values |

---

## CTAs and step-up

| CTA | Triggers step-up? | Step-up action |
|---|---|---|
| Buy tokens | no | — |
| Extend (safety-net) | no | — |
| Token Bridge | no | — |
| 3/5ths Exit (member-initiated) | yes — operator-side | `refund:override` if it crosses policy gate |
| View history | no | — |

---

## Reason codes surfaced

`LEDGER_INSUFFICIENT_BUCKETS`, `WALLET_BUCKET_EMPTY` (passive),
`MEMBERSHIP_EXPIRING_SOON`, `LEGAL_HOLD_ACTIVE`. See
`ERROR_REASON_CODES.md` for copy slots.

---

## Real-time topology

`/wallet` is **request/response** — re-fetch the view on focus. The
underlying ledger writes do emit NATS events
(`AUDIT_IMMUTABLE_PURCHASE`, `AUDIT_IMMUTABLE_SPEND`); the wallet
page does not subscribe to them in Alpha. Refresh-on-focus is the
contract.

---

## Accessibility

- Every interactive node has `test_id` + ARIA label.
- Bucket rows: explicit `role="listitem"` inside `role="list"`.
- Tier badge: `aria-label="{tier} member"`.
- Safety-net card: `role="region"` with `aria-labelledby="safety-net-heading"`.
- Step-up modal (when triggered): focus trap; ESC closes; first focusable
  element is the MFA input.
- Color is never the only signal: drain-priority chips include text.
- Breakpoints documented in `ui/config/accessibility.ts`.
