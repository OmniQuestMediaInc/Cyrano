# 02 — Cyrano Session Chat

**Role:** VIP Member (VIP and above)
**Purpose:** Persistent narrative/voice session with an AI twin persona
**Status:** Alpha Frozen
**Authority:** Kevin B. Hartley, CEO — OmniQuest Media Inc.

---

## API / Presenter Binding

| Operation | Endpoint / NATS topic | Type file |
|---|---|---|
| Start session | `POST /cyrano/narrative/session` | `services/narrative-engine/src/narrative.types.ts` |
| Send message | `POST /cyrano/narrative/message` | `NarrativeContext` |
| Recall memory | `GET /cyrano/narrative/memory` | `MemoryBank` |
| Create branch | `POST /cyrano/narrative/branch` | `BranchDecision` |
| Resolve branch | `PATCH /cyrano/narrative/branch/:id` | `BranchDecision` |
| Session tick | NATS: `cyrano.session.tick` | — |
| Session expired | NATS: `cyrano.session.expired` | — |
| Session resumed | NATS: `cyrano.session.resumed` | — |
| FFS update | NATS: `ffs.scored` | `FanFervorScore` |

---

## State Machine: Cyrano Session Lifecycle

```
GRANTED
    │  (timer starts, NATS tick begins)
    ▼
DECREMENTING
    │  (minutes consumed in real time)
    ├──[guest ends session]──────────────────────▶ CLOSED
    │
    └──[minutes reach 0]────────────────────────▶ EXPIRED
                                                      │  reason_code: CYRANO_SESSION_EXPIRED
                                                      │  (top-up modal triggered)
                                                      ▼
                                                  TOP_UP_PENDING
                                                      │  (payment confirmed)
                                                      ▼
                                                  RESUMED
                                                      │
                                                      ▼
                                                  DECREMENTING  (loop)
```

- All state transitions are driven by NATS events. No REST polling.
- `reason_code: CYRANO_SESSION_EXPIRED` is written to the audit log on `EXPIRED`.
- Top-up recovery surface: `docs/ux/04-session-top-up-recovery.md`.

---

## Layout

```
┌─────────────────────────────────────────────────────────┐
│  Character header                                       │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Twin avatar  │  Display name  │  FFS heat meter  │  │
│  │  TierBadge    │  Persona tag   │  Session timer   │  │
│  └───────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│  Chat area (scrollable)                                 │
│  ┌───────────────────────────────────────────────────┐  │
│  │  [Twin message bubble]                            │  │
│  │  [Guest message bubble]                           │  │
│  │  [Branch choice cards — when branch active]       │  │
│  │  …                                                │  │
│  └───────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│  Memory sidebar (collapsible, VIP_GOLD+)                │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Memory type badges (EPISODIC / SEMANTIC /        │  │
│  │                       PREFERENCE / RELATIONSHIP)  │  │
│  │  Memory entries list (most recent first)          │  │
│  └───────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│  Input bar                                              │
│  ┌───────────────────────────────────────────────────┐  │
│  │  [Text input field]          [Send]  [🎤 Voice]   │  │
│  └───────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│  Top-up CTA (sticky, visible when ≤ 5 min remaining)   │
│  ┌───────────────────────────────────────────────────┐  │
│  │  ⏱ {minutes} min remaining  [Top Up Session]      │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Session Timer

- Countdown rendered in character header (MM:SS format).
- NATS `cyrano.session.tick` event fires every 60 seconds with remaining minutes.
- When ≤ 5 minutes remain: sticky top-up CTA banner becomes visible.
- When 0 minutes remain: `EXPIRED` modal overlays the entire chat surface.

---

## Interactions

### Branching Choices

When the narrative engine creates a `BranchDecision`, the chat area renders choice cards below
the last twin message:

```
┌───────────────────────────────────────────┐
│  Choose your path:                        │
│  ┌─────────────────────────────────────┐  │
│  │  Option A: {branch_text_a}          │  │
│  └─────────────────────────────────────┘  │
│  ┌─────────────────────────────────────┐  │
│  │  Option B: {branch_text_b}          │  │
│  └─────────────────────────────────────┘  │
└───────────────────────────────────────────┘
```

- Guest selects a branch → `PATCH /cyrano/narrative/branch/:id` with `resolution`.
- Input bar is disabled while a branch is unresolved.
- Tier gates: basic branching for VIP / VIP_SILVER; full branching for VIP_GOLD+.

### Session Expiry → Top-Up Modal

When `cyrano.session.expired` NATS event is received:

1. Chat input bar is immediately disabled.
2. Full-screen top-up modal renders (see `docs/ux/04-session-top-up-recovery.md`).
3. On successful top-up: `cyrano.session.resumed` event received; modal dismisses; session resumes.
4. On dismiss without top-up: session transitions to `CLOSED`; guest routed to home.

### Voice Call

Tapping the 🎤 button navigates to `apps/cyrano-standalone/app/voice-call/page.tsx`.
Voice call requires VIP_GOLD+. If tier is insufficient: upgrade CTA in place of voice button.

### Diamond Concierge Handoff

When FFS reaches `INFERNO_PEAK` (95–100):

1. Non-blocking banner renders beneath the FFS meter in the character header.
2. Banner: "You've unlocked Diamond Concierge — accept for premium attention?"
3. Accept → Diamond Concierge session; `AuditRow` with `reason_code: DIAMOND_CONCIERGE_HANDOFF`.
4. Decline → banner dismissed for current session.

---

## Real-Time Events (NATS)

| Event | Direction | UI reaction |
|---|---|---|
| `cyrano.session.tick` | Server → UI | Update countdown timer |
| `cyrano.session.expired` | Server → UI | Disable input; show top-up modal |
| `cyrano.session.resumed` | Server → UI | Dismiss modal; re-enable input |
| `ffs.scored` | Server → UI | Update FFS heat meter in character header |
| `cyrano.gateguard.av.required` | Server → UI | Show `ComplianceOverlay` |

---

## Compliance

| Layer | Trigger | Action |
|---|---|---|
| Welfare Guardian `SOFT_NUDGE` | FFS HOT band (61–85) | Non-blocking nudge banner |
| Welfare Guardian `COOL_DOWN` | FFS INFERNO band (86–94) | 5-minute mandatory pause overlay |
| Welfare Guardian `HARD_DECLINE_HCZ` | FFS INFERNO_PEAK (95–100) | Blocks session; HCZ escalation |
| Bill 149 | Session start (first per account) | `ComplianceOverlay` — age consent |
| GateGuard AV | First session per device / 30 days | `ComplianceOverlay` — AV check |

---

## Copy Slots

```
Character header:  {twin_display_name} • {persona_tag}
Timer:             {MM}:{SS} remaining
Top-up CTA:        ⏱ {minutes} min left — [Top Up Session]
Expiry modal:      Your session has ended. Add more time to continue.
Branch prompt:     Choose your path:
Nudge banner:      Take a moment — you've been on a roll.
Cool-down:         Pausing for 5 minutes. We'll be right here.
```

---

*Binding: `services/narrative-engine/src/narrative.types.ts` ·
`apps/cyrano-standalone/app/chat/page.tsx` ·
`apps/cyrano-standalone/components/CharacterChat/CharacterChat.tsx`*
