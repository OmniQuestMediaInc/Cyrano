# 03 — Persona Management

**Role:** Creator (authoring) / VIP Member (selection + customisation)
**Purpose:** Create, manage, and personalise AI twin personas across global, template, and custom scopes
**Status:** Alpha Frozen
**Authority:** Kevin B. Hartley, CEO — OmniQuest Media Inc.

---

## API / Presenter Binding

| Operation | Endpoint | Notes |
|---|---|---|
| List personas | `GET /cyrano/ai-twin` | Returns `TwinSummary[]` filtered by scope |
| Create persona | `POST /cyrano/ai-twin` | Creator only; sets `persona_prompt` + `visibility` |
| Update persona prompt | `PATCH /cyrano/ai-twin/:id` | Creator only; triggers re-training if base model unchanged |
| Set global default | `PATCH /cyrano/ai-twin/:id/global` | OQMI Operator only |
| Guest custom save | `POST /cyrano/narrative/memory` | VIP_GOLD+ only; stored in `MemoryBank` as `PREFERENCE` type |

All mutations require `correlation_id` and `idempotency_key` (see `docs/UX_INTEGRATION_BRIEF.md` §6).

---

## State Machine: Persona Scope

```
GLOBAL
│  (OmniQuest house default — read-only for all guests)
│  (Creator publishes a persona with PLATFORM_INTERNAL visibility)
▼
TEMPLATE
│  (Creator-authored; selectable by VIP+)
│  (VIP_GOLD+ guest customises via MemoryBank preferences)
▼
CUSTOM
   (per-guest personalisation; stored in MemoryBank as PREFERENCE memories)
   (scoped to guest_id + twin_id; not shared across guests)
```

Scope transitions are one-directional in scope level. A guest cannot elevate a GLOBAL persona
to TEMPLATE scope — only a Creator or Operator can publish at TEMPLATE level.

---

## Layout: Tabbed Card Grid + New Persona FAB

```
┌─────────────────────────────────────────────────────────┐
│  TierBadge + header                                     │
├─────────────────────────────────────────────────────────┤
│  Tab bar                                                │
│  [Global]  [Templates]  [My Personas]                   │
│            ────────────                                 │
├─────────────────────────────────────────────────────────┤
│  Search bar  [🔍 Search personas…]                      │
├─────────────────────────────────────────────────────────┤
│  Card grid (2-column mobile / 3-column desktop)         │
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │  Twin avatar    │  │  Twin avatar    │              │
│  │  Display name   │  │  Display name   │              │
│  │  Persona tag    │  │  Persona tag    │              │
│  │  Scope badge    │  │  Scope badge    │              │
│  │  [Select]       │  │  [Select]       │              │
│  └─────────────────┘  └─────────────────┘              │
│  …                                                      │
├─────────────────────────────────────────────────────────┤
│                                         [+ New Persona] │  ← FAB, Creator only
└─────────────────────────────────────────────────────────┘
```

### Tabs

| Tab | Visible to | Content |
|---|---|---|
| Global | All roles | House default personas (`GLOBAL` scope, `is_house_model: true`) |
| Templates | VIP+ | Creator-authored templates (`TEMPLATE` scope, `visibility: PLATFORM_INTERNAL`) |
| My Personas | VIP_GOLD+ | Guest's `CUSTOM` scope personas + Creator's own published personas |

### Scope Badges

| Scope | Badge label | Colour |
|---|---|---|
| `GLOBAL` | House | Neutral/grey |
| `TEMPLATE` | Creator | Brand accent |
| `CUSTOM` | Yours | Guest accent |

---

## Interactions

### Select Persona

1. Guest taps a card → detail sheet slides up.
2. Detail sheet shows: twin avatar, display name, persona prompt preview (truncated),
   training status, voice clone availability.
3. Guest taps "Use This Persona" → selected persona stored in session context.
4. If guest is VIP_GOLD+: "Customise" button is enabled → opens customisation panel.

### Customise Persona (VIP_GOLD+)

```
┌─────────────────────────────────────────────────────────┐
│  Customise: {display_name}                              │
├─────────────────────────────────────────────────────────┤
│  Nickname for this persona  [text field]                │
│  Preferred tone             [combobox: Warm/Playful/…]  │
│  Memory preferences         [toggles: remember topics] │
├─────────────────────────────────────────────────────────┤
│  [Cancel]                          [Save Customisation] │
└─────────────────────────────────────────────────────────┘
```

- On save: preferences stored via `POST /cyrano/narrative/memory` with `memory_type: PREFERENCE`.
- `correlation_id` carried from the original session context.

### New Persona FAB (Creator only)

Tapping "+ New Persona" navigates to the AI Twin Creator wizard
(`docs/ux/01-ai-twin-creator-dashboard.md`) with scope pre-set to `TEMPLATE`.

### Tier Gate

If a guest with `VIP` or `VIP_SILVER` tier attempts to access the "My Personas" tab or the
"Customise" button:

```
┌─────────────────────────────────────────────────────────┐
│  Custom personas are available on VIP Gold and above.   │
│  [Upgrade to VIP Gold →]                                │
└─────────────────────────────────────────────────────────┘
```

---

## Compliance

| Layer | Trigger | Action |
|---|---|---|
| `PERSONA_SCOPE_DENIED` | Guest tier below required scope | Upgrade CTA (non-blocking) |
| GateGuard AV | Selecting a SUBSCRIBER-visibility persona | `ComplianceOverlay` — AV check |
| Bill 149 | First custom persona save | Consent prompt (if not already captured this session) |

---

## Copy Slots

```
Tab — Global:      House Personas
Tab — Templates:   Creator Personas
Tab — My Personas: My Personas
FAB:               + New Persona
Card CTA:          Select
Detail CTA:        Use This Persona
Customise CTA:     Customise
Tier gate:         Custom personas available on VIP Gold and above.
Scope — GLOBAL:    House
Scope — TEMPLATE:  Creator
Scope — CUSTOM:    Yours
```

---

*Binding: `services/ai-twin/src/ai-twin.types.ts` → `TwinSummary` ·
`services/narrative-engine/src/narrative.types.ts` → `MemoryType` ·
`apps/cyrano-standalone/app/ai-twin/page.tsx`*
