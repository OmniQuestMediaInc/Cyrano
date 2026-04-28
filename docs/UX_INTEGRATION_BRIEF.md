# Cyrano UX Integration Brief — Alpha Frozen

**Version:** 2026-04-28
**Status:** Draft → Ready for review
**Authority:** Kevin B. Hartley, CEO — OmniQuest Media Inc.
**Repo:** OmniQuestMediaInc/Cyrano
**Cross-stack vocabulary:** see `docs/UX_CROSS_STACK_ALIGNMENT.md`

---

## 1. Frozen Presenter Contracts

All UI presenters bind to the following canonical type files. No UI component may define its own local
contract types — all shapes must be imported from these paths.

| Binding target | Path |
|---|---|
| AI Twin types | `services/ai-twin/src/ai-twin.types.ts` |
| Voice clone types | `services/voice-cloning/src/voice.types.ts` |
| Narrative / session types | `services/narrative-engine/src/narrative.types.ts` |
| Image generation types | `services/image-generation/src/image.types.ts` |
| Cyrano UI pages | `apps/cyrano-standalone/app/ai-twin/`, `apps/cyrano-standalone/app/chat/`, `apps/cyrano-standalone/app/voice-call/` |
| Shared components | `docs/ux/00-shared-components.md` |

Presenter contracts are **frozen** for Alpha. Any new field requires a CEO-approved amendment
committed as a `CYR:` prefix commit.

---

## 2. Endpoint / Presenter Inventory by Role

### 2.1 Guest → VIP (GUEST … VIP_DIAMOND)

| Role | Accessible surfaces | Notes |
|---|---|---|
| `GUEST` | Landing page, public persona gallery | No session creation |
| `VIP` | Session chat, persona browse, top-up | Read-only twin preview |
| `VIP_SILVER` | Session chat, persona library | Cyrano minutes: 60 min/day |
| `VIP_GOLD` | Session chat, voice call, persona custom | Cyrano minutes: 120 min/day |
| `VIP_PLATINUM` | All guest surfaces, advanced narrative branching | Cyrano minutes: 240 min/day |
| `VIP_DIAMOND` | All surfaces + Diamond Concierge handoff | Unlimited; zero-earn concierge |

Tier enum canonical values: `GUEST`, `VIP`, `VIP_SILVER`, `VIP_GOLD`, `VIP_PLATINUM`, `VIP_DIAMOND`
(see `docs/DOMAIN_GLOSSARY.md` §MEMBERSHIP AND ACCESS).

### 2.2 Creator (Pixel Legacy / Standard)

| Attribute | Pixel Legacy | Standard |
|---|---|---|
| AI Twin training | Enabled at launch | Enabled Day 91 parity |
| Image generation | Full photorealism | Full photorealism |
| Voice cloning | Enabled | Enabled |
| Persona scopes | Global + Template + Custom | Global + Template |
| Dashboard | `docs/ux/01-ai-twin-creator-dashboard.md` | Same surface |

### 2.3 OQMI Operator

- Full read access to all twin, session, and persona records.
- Can trigger manual GateGuard review or Welfare Guardian override.
- Surfaces: Admin portal — not Cyrano standalone UI.

### 2.4 Diamond Concierge (zero-earn)

- Presents as a `VIP_DIAMOND` session overlay.
- Zero-earn: no CZT accrual for the Concierge agent during handoff sessions.
- Handoff triggered by FFS high-heat threshold (see §5 State Machines).
- Surfaces: `ComplianceOverlay` + `DiamondConcierge` banner (see `docs/ux/00-shared-components.md`).

---

## 3. State Machines (Core)

### 3.1 AI Twin Training Lifecycle

```
PENDING_UPLOAD
    │  (photo upload complete)
    ▼
UPLOAD_COMPLETE
    │  (POST /cyrano/ai-twin/:id/train)
    ▼
TRAINING_QUEUED
    │  (Banana.dev job accepted)
    ▼
TRAINING_IN_PROGRESS
    │  (webhook callback received)
    ├──[success]──▶ TRAINING_COMPLETE
    └──[failure]──▶ TRAINING_FAILED
                        │  (creator retries)
                        ▼
                    TRAINING_QUEUED  (re-queue)
```

- `RETIRED` is a terminal state set by OQMI Operator only.
- `reason_code: TWIN_TRAINING_FAILED` is written on `TRAINING_FAILED` transition.
- `correlation_id` is carried on every state transition event published to NATS.

### 3.2 Cyrano Session Lifecycle

```
GRANTED
    │  (session opened, timer starts)
    ▼
DECREMENTING
    │  (minutes consumed; NATS: cyrano.session.tick)
    ├──[minutes reach 0]──▶ EXPIRED
    │                           │  (guest triggers top-up)
    │                           ▼
    │                       TOP_UP_PENDING
    │                           │  (payment confirmed)
    │                           ▼
    │                       RESUMED ──▶ DECREMENTING
    │
    └──[guest ends session]──▶ CLOSED
```

- `reason_code: CYRANO_SESSION_EXPIRED` on `EXPIRED` transition.
- Top-up modal surface: `docs/ux/04-session-top-up-recovery.md`.
- All tick events published via NATS (topic: `cyrano.session.tick`). No REST polling.

### 3.3 Persona Scope

```
GLOBAL (house default, read-only for guests)
    │  (Creator publishes template)
    ▼
TEMPLATE (Creator-authored, selectable by VIP+)
    │  (VIP_GOLD+ customises)
    ▼
CUSTOM (per-guest personalisation, stored in MemoryBank)
```

Management surface: `docs/ux/03-persona-management.md`.

### 3.4 FFS Heat + Welfare Guardian Bands

| FFS heat range | Band label | WGS intervention |
|---|---|---|
| 0–33 | COLD | None |
| 34–60 | WARM | None |
| 61–85 | HOT | `SOFT_NUDGE` (non-blocking) |
| 86–94 | INFERNO | `COOL_DOWN` (5-min mandatory pause) |
| 95–100 | INFERNO_PEAK | `HARD_DECLINE_HCZ` + Diamond Concierge handoff offer |

FFS events published via NATS topic: `ffs.scored`.

### 3.5 Step-Up Auth + GateGuard AV

```
High-value action triggered
    │
    ▼
StepUpModal presented
    │
    ├──[MFA verified]──▶ STEP_UP_GRANTED  →  action proceeds
    │                       AuditRow written (reason_code: STEP_UP_GRANTED)
    │
    └──[MFA failed / dismissed]──▶ STEP_UP_DENIED  →  action blocked
                                     AuditRow written (reason_code: STEP_UP_DENIED)
```

GateGuard AV verification is required on:
- AI Twin photo upload (identity + age check)
- First session creation per device per 30 days
- Any CZT spend event > threshold defined in `GovernanceConfig`

---

## 4. Error + Reason Code Catalog

Cyrano reuses the canonical `reason_code` set from ChatNow.Zone and adds the following Cyrano-specific codes.

### 4.1 Cyrano-specific reason codes

| `reason_code` | Trigger | Surface |
|---|---|---|
| `CYRANO_SESSION_EXPIRED` | Session minutes hit 0 | Top-up modal (`docs/ux/04-session-top-up-recovery.md`) |
| `TWIN_TRAINING_FAILED` | Banana.dev returns error | Creator dashboard error state (`docs/ux/01-ai-twin-creator-dashboard.md`) |
| `VOICE_CLONE_FAILED` | ElevenLabs clone error | Voice call surface error banner |
| `IMAGE_GEN_BLOCKED` | GateGuard blocks image output | Inline error under image preview |
| `PERSONA_SCOPE_DENIED` | Guest tier insufficient for Custom scope | Upgrade CTA in persona management |
| `GATEGUARD_AV_REQUIRED` | Upload/session requires AV check | `ComplianceOverlay` (see §00-shared-components) |

### 4.2 Shared reason codes (reused from CNZ)

`STEP_UP_GRANTED`, `STEP_UP_DENIED`, `SOFT_NUDGE`, `COOL_DOWN`, `HARD_DECLINE_HCZ`,
`PIXEL_LEGACY_SIGNING_BONUS`, `WELCOME_CREDIT`.

All `reason_code` values must be present on every `AuditRow`. Rows without a `reason_code` must
not be rendered (see `docs/ux/00-shared-components.md` §AuditRow).

---

## 5. Tier + Entitlement Rules

| Tier | Cyrano minutes/day | Voice call | Narrative branching | Notes |
|---|---|---|---|---|
| `GUEST` | 0 | No | No | Landing + gallery only |
| `VIP` | 30 | No | Basic | Single branch path |
| `VIP_SILVER` | 60 | No | Basic | |
| `VIP_GOLD` | 120 | Yes | Full | Custom persona scope |
| `VIP_PLATINUM` | 240 | Yes | Full | |
| `VIP_DIAMOND` | Unlimited | Yes | Full | Diamond Concierge eligible |

- Minutes are session-minutes (wall-clock, decremented in real time via NATS tick).
- Minutes reset at midnight UTC.
- Rollover is not permitted (Alpha scope).

---

## 6. Idempotency

Every mutation endpoint must accept:

| Field | Type | Rule |
|---|---|---|
| `correlation_id` | `string` (UUID v4) | Unique per originating user action; carried on all downstream events |
| `idempotency_key` | `string` (UUID v4) | Unique per API call; server returns cached response on duplicate within 24 hr |

If `idempotency_key` is absent, the server rejects with HTTP 400 and `reason_code: MISSING_IDEMPOTENCY_KEY`.

---

## 7. Cross-Stack Vocabulary

See `docs/UX_CROSS_STACK_ALIGNMENT.md` for the full alignment table between Cyrano, ChatNow.Zone,
and RedRoomRewards terminology.

Key mappings:

| Cyrano term | CNZ equivalent | Glossary ref |
|---|---|---|
| AI Twin | — (Cyrano-only concept) | `docs/DOMAIN_GLOSSARY.md` §CYRANO |
| Cyrano Session | ShowTheatre session | §VENUES AND ZONES |
| Narrative Branch | — (Cyrano-only) | §CYRANO |
| Persona | Creator persona | §USERS AND ROLES |
| FFS (Fan Fervor Score) | FFS (Fan Fervor Score) | §GUEST INTELLIGENCE |

---

## 8. Out-of-Scope for Alpha

The following are explicitly deferred from Alpha:

| Item | Deferral reason |
|---|---|
| Black-Glass admin UI | Post-Alpha; separate workstream |
| Cyrano L3 (HCZ Whisper Intelligence) | Alpha scope is L1 + L2 only |
| Cyrano L4 (Enterprise B2B Whisper API) | Year 3+ per roadmap |
| Live payments / real-money settlement in Cyrano UI | Handled via CNZ wallet bridge — no standalone payment UI in Alpha |
| Layer 3+ narrative memory persistence | Alpha uses session-scoped MemoryBank only |
| SenSync™ biometric integration | Deferred; no HeartZone in Cyrano standalone Alpha |

---

## 9. Real-Time: NATS

All session, haptic, and FFS events flow through NATS.io. No REST polling is permitted for any
real-time event in the Cyrano stack.

| NATS topic | Publisher | Consumer |
|---|---|---|
| `cyrano.session.tick` | Narrative engine (per-minute) | Session chat UI (countdown timer) |
| `cyrano.session.expired` | Narrative engine | Session chat UI (triggers top-up modal) |
| `cyrano.session.resumed` | Payment confirmation handler | Session chat UI |
| `cyrano.twin.training.complete` | AI Twin service (Banana.dev callback) | Creator dashboard |
| `cyrano.twin.training.failed` | AI Twin service | Creator dashboard |
| `ffs.scored` | FFS service | Session UI (heat meter), GateGuard |
| `cyrano.gateguard.av.required` | GateGuard AV module | `ComplianceOverlay` |

---

## 10. Compliance Overlays

| Compliance layer | Trigger | Surface |
|---|---|---|
| Bill 149 (Ontario age-gating) | First session, account creation, twin photo upload | `ComplianceOverlay` — age gate + consent |
| Welfare Guardian | FFS band transitions (INFERNO → HARD_DECLINE_HCZ) | `ComplianceOverlay` + `COOL_DOWN` timer |
| GateGuard Sentinel™ | Any flagged image upload, high-value spend, AV check | `ComplianceOverlay` |
| GateGuard AV (age verification) | Photo upload, first session per device/30 days | `ComplianceOverlay` — AV flow |

All compliance overlays must block underlying UI interaction until the guest completes or dismisses
the required step (see `docs/ux/00-shared-components.md` §ComplianceOverlay).

`zk_proof_hash` must be stored on every GateGuard AV response (see `docs/DOMAIN_GLOSSARY.md`
§GATEGUARD SENTINEL).

---

*End of Cyrano UX Integration Brief — Alpha Frozen*
