# Wireframe exemplar 02 — `/admin/diamond` (Diamond Concierge Command Center)

**Binding contract:** `DiamondCommandCenterView` in
`ui/types/admin-diamond-contracts.ts:135-146`.
**Page builder:** `ui/app/admin/diamond/page.ts`.
**Presenter:** `ui/view-models/diamond-concierge.presenter.ts`.
**SEO:** `noindex,nofollow` (authenticated route).
**Roles:** OQMI Operator (admin / CS / compliance / legal sub-roles via
RBAC); Diamond Concierge (operator role with zero earn).

This exemplar shows the most complex CNZ surface — eight live
sub-panels, NATS overlays, and step-up triggers wired in. It sets the
format Grok matches for all operator surfaces.

---

## Page layout (desktop-first; min breakpoint 1280)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ /admin/diamond — Diamond Concierge Command Center      [reconnect-pill] │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌────────────────────────────────────────────────┐  ┌───────────────┐  │
│  │ Liquidity                                      │  │ Welfare panel │  │
│  │                                                │  │ (live)        │  │
│  │ open_diamond_wallets   {n}                     │  │               │  │
│  │ total_remaining_tokens {n}                     │  │ active        │  │
│  │ total_remaining_usd_cents {n}                  │  │  cooldowns {n}│  │
│  │ expiring_within_48h    {n}                     │  │  hard_decl {n}│  │
│  │ high_balance_wallets   {n}                     │  │  escalations{n}│ │
│  │                                                │  │               │  │
│  │ [velocity_table — 5 rows by velocity_band]     │  │ [trending     │  │
│  │   DAYS_14 | open | tokens | usd | %_of_book    │  │  reason_codes]│  │
│  │   DAYS_30 | …                                  │  │               │  │
│  │   DAYS_90 | …                                  │  │               │  │
│  │   DAYS_180| …                                  │  └───────────────┘  │
│  │   DAYS_366| …                                  │                     │
│  │                                                │  ┌───────────────┐  │
│  │ [kpi_cards — repeating]                        │  │ Audit chain   │  │
│  │  [kpi.label] {value} [trend↑↓→]                │  │ (live)        │  │
│  │   reason_code chip                             │  │               │  │
│  └────────────────────────────────────────────────┘  │ [audit rows]  │  │
│                                                       │  seq | event│  │
│  ┌────────────────────────────────────────────────┐  │       | hash │  │
│  │ 48h Warning Queue   ({warning_queue.length})    │  │  …          │  │
│  │ wallet | user | expires_in | tokens | severity │  └───────────────┘  │
│  └────────────────────────────────────────────────┘                     │
│                                                                         │
│  ┌────────────────────────────────────────────────┐                     │
│  │ Personal-Touch Queue ({personal_touch_queue})   │                     │
│  │ wallet | user | usd | last_touch | escalation  │                     │
│  └────────────────────────────────────────────────┘                     │
│                                                                         │
│  ┌────────────────────────┐  ┌──────────────────────┐                   │
│  │ Token Bridge offers    │  │ Three-Fifths Exit    │                   │
│  │  ({open_token_bridge…})│  │  ({open_three_fifths…})│                 │
│  │ [card per case]        │  │ [card per case]      │                   │
│  └────────────────────────┘  └──────────────────────┘                   │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ GateGuard live feed (NATS)                                         │ │
│  │ event | actor | action | decision | fraud | welfare | reason_codes │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Field bindings

| Panel | Field | Notes |
|---|---|---|
| liquidity panel | `DiamondCommandCenterView.liquidity` | one-shot from request |
| velocity table rows | `DiamondLiquidityView.velocity_table[]` | five rows, one per `DiamondVelocityBand` |
| KPI cards | `DiamondLiquidityView.kpis[]` | each carries `label / value / trend / reason_code` |
| 48h warning queue | `DiamondCommandCenterView.warning_queue` | sorted by `hours_until_expiry` ascending; `severity` chip on each |
| personal-touch queue | `DiamondCommandCenterView.personal_touch_queue` | `escalation_tier` chip (GOLD / PLATINUM / BLACK) |
| Token Bridge offer cards | `DiamondCommandCenterView.open_token_bridge_cards[]` | one per case; CTA "Process bridge" |
| Three-Fifths Exit cards | `DiamondCommandCenterView.open_three_fifths_cards[]` | one per case; CTA "Approve refund" — triggers step-up |
| GateGuard live feed | `DiamondCommandCenterView.gateguard_feed` | live via NATS `GATEGUARD_DECISION_*`; first 50 rows; auto-scroll |
| Welfare panel | `DiamondCommandCenterView.welfare_panel` | counts + trending reason_codes; live via NATS `GATEGUARD_WELFARE_SIGNAL` |
| Audit chain viewer | `DiamondCommandCenterView.audit_chain_window` | live via NATS `AUDIT_IMMUTABLE_*`; chain integrity check on every render |
| header reconnect pill | NATS subscription health | shown when reconnecting |
| `rule_applied_id` footer | `DiamondCommandCenterView.rule_applied_id` | small print for audit traceability |

---

## CTAs and step-up

| CTA | Triggers step-up? | Step-up action | Audit emission |
|---|---|---|---|
| Process Token Bridge | no | — | `AUDIT_IMMUTABLE_RECOVERY` |
| Approve Three-Fifths refund | yes if `policy_gated: true` | `refund:override` → `REFUND_OVERRIDE` | `AUDIT_IMMUTABLE_RECOVERY` + `AUDIT_IMMUTABLE_STEP_UP` |
| Personal-touch contact | no | — | `HUB_DIAMOND_CONCIERGE_HANDOFF` |
| WORM export trigger | yes | `worm:export` → `WALLET_MODIFICATION` | `WORM_EXPORT_TRIGGERED` + `AUDIT_IMMUTABLE_STEP_UP` |
| Open recovery case detail | no | — | navigates to `/admin/recovery#case={id}` |

---

## States

| State | Trigger | Visual |
|---|---|---|
| loaded | normal | layout above |
| empty queue | warning_queue.length = 0 | "No wallets expiring in 48h" placeholder |
| step-up pending | operator triggered gated CTA | step-up-modal overlay |
| step-up failed | MFA failed | inline error on the originating CTA |
| NATS reconnecting | subscription drop | reconnect pill; live panels dimmed; last-known frame retained |
| audit chain integrity failure | `AUDIT_CHAIN_INTEGRITY_FAILURE` | full-screen lockout with case_id; manual override required |
| reconciliation drift detected | `RECONCILIATION_DRIFT_DETECTED` | banner across header; CTA to drift detail |

---

## Real-time topology

| Sub-surface | Transport | Topics |
|---|---|---|
| GateGuard live feed | NATS | `GATEGUARD_DECISION_APPROVED|COOLDOWN|HARD_DECLINE|HUMAN_ESCALATE`, `GATEGUARD_WELFARE_SIGNAL` |
| Welfare panel counters | NATS | `GATEGUARD_WELFARE_SIGNAL` |
| Audit chain window | NATS | `AUDIT_IMMUTABLE_*` family |
| Reconciliation drift banner | NATS | `RECONCILIATION_DRIFT_DETECTED` |
| Token Bridge / 3/5ths cards | request/response | re-fetched on case state change |
| Liquidity / KPIs | request/response | refresh-on-focus + manual refresh button |

REST polling is not used for any live sub-surface here. NATS drop →
reconnect-with-backoff and the dimmed-frame behavior described in
SM-12.

---

## Reason codes surfaced

Heavy on the audit side: `GATEGUARD_*`, `WELFARE_GUARDIAN_v1`,
`RECONCILIATION_DRIFT_DETECTED`, `STEP_UP_*`,
`AUDIT_CHAIN_INTEGRITY_FAILURE`, `WORM_EXPORT_*`, recovery family
(`TOKEN_BRIDGE_BONUS`, `THREE_FIFTHS_REFUND`,
`FIZ-002-REVISION-2026-04-11`).

---

## Accessibility

- Operators rely on keyboard nav heavily; tab order is explicit and
  predictable across the 8 panels (liquidity → KPIs → warning queue
  → personal-touch → Token Bridge cards → 3/5ths cards → welfare →
  audit chain → GateGuard feed).
- Live panels announce critical changes via `aria-live="polite"`;
  `HARD_DECLINE` and `HUMAN_ESCALATE` use `aria-live="assertive"`.
- Step-up modal: focus trap, ESC closes only after dismiss
  confirmation (operators must not lose context accidentally).
- Audit chain hashes are monospaced with explicit copy buttons.
- Breakpoints in `ui/config/accessibility.ts`; `/admin/diamond`
  optimized for 1280+; degrades gracefully to 1024 with horizontal
  scroll on the velocity table.
