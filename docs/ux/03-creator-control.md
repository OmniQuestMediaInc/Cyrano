# Wireframe exemplar 03 — `/creator/control` (CreatorControl.Zone Command Pane)

**Binding contract:** `CreatorCommandCenterView` in
`ui/types/creator-panel-contracts.ts:78-89`.
**Page builder:** `ui/app/creator/control/page.ts`.
**Presenter:** `ui/view-models/creator-control.presenter.ts`.
**SEO:** `noindex,nofollow` (authenticated route).
**Roles:** Creator (Pixel Legacy + Standard) — own surface; Operators
read-only via audit overlay.

This exemplar covers the **most NATS-heavy** surface in the
product — FFS meter, Cyrano whisper panel, and price nudge are all
live-driven. It sets the format Grok matches for all live creator
surfaces.

---

## Page layout (desktop-first; min breakpoint 1280)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ {display_name}             [obs:✓] [chat:✓]      [reconnect-pill?]      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────┐  ┌───────────────────────────┐   │
│  │ FFS meter (live)                 │  │ Payout rate (live)        │   │
│  │                                  │  │                           │   │
│  │  [gauge: tier color, score 0-100]│  │  ${current_rate}/CZT      │   │
│  │  Tier: {COLD|WARM|HOT|INFERNO}   │  │  Floor ${floor} ─ Ceiling │   │
│  │                                  │  │   ${ceiling}              │   │
│  │  Components:                     │  │                           │   │
│  │   tipper_pressure  {0-40}        │  │  Scaling +{0|5|10}%       │   │
│  │   velocity         {0-40}        │  │   [INFERNO badge if 10%]  │   │
│  │   vip_presence     {0-20}        │  │                           │   │
│  └──────────────────────────────────┘  └───────────────────────────┘   │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Session monitoring  (active_session_id: {id})                      │ │
│  │                                                                    │ │
│  │  latest_heat: {tier} {score}                                       │ │
│  │  latest_nudge: {direction} {magnitude_pct}%                        │ │
│  │   ↑/↓/→  copy: "{nudge.copy}"                                      │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌────────────────────────────────────┐ ┌──────────────────────────┐   │
│  │ Cyrano whisper panel (live, NATS)  │ │ Broadcast timing copilot │   │
│  │                                    │ │                          │   │
│  │  Persona: [switcher]               │ │ [windows table]          │   │
│  │   ▸ creator-global                 │ │  slot | confidence       │   │
│  │   ▸ cyrano-template                │ │  expected_tippers        │   │
│  │   ▸ per-VIP custom                 │ │  expected_tips_per_min   │   │
│  │                                    │ │  reason_code             │   │
│  │  Suggestions:                      │ │                          │   │
│  │   [card: weight 0-100, category,   │ │                          │   │
│  │    copy, reason_codes]             │ │                          │   │
│  │   …                                │ │                          │   │
│  │                                    │ │                          │   │
│  │  Latency SLO: {sla_ms}ms           │ │                          │   │
│  │  Last observed: {last_observed}ms  │ │                          │   │
│  └────────────────────────────────────┘ └──────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Field bindings

| Panel | Field | Notes |
|---|---|---|
| display name | `CreatorCommandCenterView.display_name` | header |
| OBS readiness chip | `CreatorCommandCenterView.obs_ready` | green/red |
| chat aggregator chip | `CreatorCommandCenterView.chat_aggregator_ready` | green/red |
| FFS meter score | `FfsMeter.score` | 0-100 |
| FFS meter tier | `FfsMeter.tier` | `COLD|WARM|HOT|INFERNO` — drives gauge color |
| FFS components | `FfsMeter.components` | three sub-bars |
| FFS tier bounds | `FfsMeter.tier_min`, `tier_max` | gauge band edges |
| Payout rate value | `PayoutRateIndicator.current_rate_per_token_usd` | live |
| Payout floor / ceiling | `PayoutRateIndicator.redbook_floor_per_token_usd` (0.075), `redbook_ceiling_per_token_usd` (0.090) | static reference |
| Payout scaling pct | `PayoutRateIndicator.scaling_pct_applied` | 0 / 5 / 10 |
| INFERNO badge | conditional on `scaling_pct_applied === 10` | visual cue |
| Active session id | `SessionMonitoringPanel.active_session_id` | header micro |
| Latest heat frame | `SessionMonitoringPanel.latest_heat` | small re-render of FFS meter |
| Latest nudge | `SessionMonitoringPanel.latest_nudge` | direction arrow + magnitude + copy |
| Cyrano persona switcher | `CyranoWhisperPanel.personas_available[]` | three-section dropdown (SM-06) |
| Cyrano active persona | `CyranoWhisperPanel.active_persona_id` | bold/highlighted in switcher |
| Cyrano suggestions | `CyranoWhisperPanel.suggestions[]` | live; sorted by weight desc |
| Suggestion category chip | `CyranoPanelSuggestion.category` | one of 8 categories |
| Suggestion reason_codes | `CyranoPanelSuggestion.reason_codes[]` | small chips |
| Cyrano latency SLO | `CyranoWhisperPanel.latency_sla_ms` | reference |
| Cyrano latency observed | `CyranoWhisperPanel.latency_last_observed_ms` | red if > sla |
| Broadcast windows | `BroadcastTimingDashboard.windows[]` | sorted by suggested_slot_utc |
| `rule_applied_id` footer | `CreatorCommandCenterView.rule_applied_id` | audit trace |
| reconnect pill | NATS health | reconnect-with-backoff visual |

---

## States

| State | Trigger | Visual |
|---|---|---|
| no active session | `active_session_id === null` | "Start a session" empty state on session monitoring + Cyrano panels; FFS meter dim |
| live | normal | layout above |
| OBS not ready | `obs_ready === false` | yellow chip + creator-readiness-banner with `OBS_NOT_READY` |
| chat aggregator not ready | `chat_aggregator_ready === false` | yellow chip + banner with `CHAT_AGGREGATOR_NOT_READY` |
| FFS gauge idle | `FfsMeter === null` | placeholder gauge |
| Cyrano latency exceeded | `latency_last_observed_ms > latency_sla_ms` | red latency badge |
| NATS reconnecting | subscription drop | reconnect pill + live panels dimmed |
| Welfare distress detected | NATS `GATEGUARD_WELFARE_DISTRESS_DETECTED` for own session | overlay (welfare-intervention-overlay) |
| Bill 149 prefix required | every CREATOR_AUTO output | compliance-prefix-banner above outgoing message |

---

## Real-time topology

This is the **most NATS-bound** surface. Every live panel subscribes:

| Sub-surface | NATS topics |
|---|---|
| FFS meter | `FFS_SCORE_UPDATE`, `FFS_TIER_CHANGED`, `FFS_PEAK` |
| Payout rate indicator | `HUB_PAYOUT_SCALING_APPLIED` |
| Session monitoring (latest_heat) | `FFS_SCORE_UPDATE` filtered by session_id |
| Session monitoring (latest_nudge) | `CREATOR_CONTROL_PRICE_NUDGE` filtered by creator_id |
| Cyrano whisper panel | `CYRANO_SUGGESTION_EMITTED`, `CYRANO_SUGGESTION_DROPPED`, `CYRANO_FFS_FRAME_CONSUMED` |
| Cyrano persona switcher | `CYRANO_MEMORY_UPDATED` (when persona swap is acknowledged) |
| Broadcast timing | `CREATOR_CONTROL_BROADCAST_SUGGESTION` |
| Welfare distress overlay | `GATEGUARD_WELFARE_DISTRESS_DETECTED` |

REST polling is **forbidden** for chat/haptic/FFS — surface must be
push-driven. Subscription drop → reconnect pill + last-known frame
retained.

---

## CTAs and step-up

| CTA | Triggers step-up? | Notes |
|---|---|---|
| Persona switch | no | emits `CYRANO_MEMORY_UPDATED` on confirm |
| Apply broadcast suggestion | no | informational; creator schedules manually |
| Configure rate card | yes — `rate_card:configure` → `PAYOUT_CHANGE` | navigates to `/creator/gamification` (or rate card config) |
| Open audit overlay (operators only) | no — read-only |  |

---

## Reason codes surfaced

`PAYOUT_SCALING_APPLIED`, `BROADCAST_TIMING_COPILOT`, every category in
the 8-element `CyranoCategory` enum, `WELFARE_GUARDIAN_v1`,
`OBS_NOT_READY`, `CHAT_AGGREGATOR_NOT_READY`,
`BILL_149_DISCLOSURE_REQUIRED` (on every CREATOR_AUTO output).

---

## Accessibility

- FFS meter uses both color and numeric value (color is never the only
  signal).
- Live regions: `aria-live="polite"` on suggestion list,
  `aria-live="assertive"` on welfare distress overlay.
- Persona switcher is fully keyboard-navigable; section headers are
  not focusable (matching dropdown convention).
- Latency badge has `aria-label="Cyrano latency: {n}ms, SLO {sla}ms"`.
- Compliance prefix banner is read by screen readers before each
  CREATOR_AUTO message body.
- Breakpoints in `ui/config/accessibility.ts`; this surface is
  optimized for 1280+ but degrades gracefully to 1024.
