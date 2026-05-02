# 01 — AI Twin Creator Dashboard

**Role:** Creator / VIP (read-only twin preview for VIP+)
**Purpose:** Train and manage a photorealistic AI twin
**Status:** Alpha Frozen
**Authority:** Kevin B. Hartley, CEO — OmniQuest Media Inc.

---

## API / Presenter Binding

| Operation | Endpoint | Type file |
|---|---|---|
| Create twin record | `POST /cyrano/ai-twin` | `services/ai-twin/src/ai-twin.types.ts` → `CreateTwinRequest` |
| Upload photo | `POST /cyrano/ai-twin/:id/photos` | `PhotoUploadResult` |
| Start training | `POST /cyrano/ai-twin/:id/train` | `TrainingJobPayload` |
| Poll / receive status | NATS: `cyrano.twin.training.complete`, `cyrano.twin.training.failed` | `TrainingJobResult` |
| List twins | `GET /cyrano/ai-twin` | `TwinSummary[]` |

GateGuard AV check is required on every photo upload (`reason_code: GATEGUARD_AV_REQUIRED`).

---

## State Machine: Twin Training Lifecycle

```
PENDING_UPLOAD
    │  (1+ photos uploaded)
    ▼
UPLOAD_COMPLETE
    │  (Creator clicks "Start Training")
    ▼
TRAINING_QUEUED
    │  (Banana.dev job accepted)
    ▼
TRAINING_IN_PROGRESS
    │  (Banana.dev webhook fires)
    ├──[success]──▶ TRAINING_COMPLETE  →  Publish CTA
    └──[failure]──▶ TRAINING_FAILED   →  Error state + retry CTA
                        │  (Creator retries)
                        ▼
                    TRAINING_QUEUED
```

`reason_code: TWIN_TRAINING_FAILED` is written to the audit log on `TRAINING_FAILED`.
All state transitions emit NATS events (see `docs/UX_INTEGRATION_BRIEF.md` §9).

---

## Layout: Wizard Stepper

```
┌─────────────────────────────────────────────────────────┐
│  TierBadge + FFS meter (header)                         │
├─────────────────────────────────────────────────────────┤
│  Stepper: [Photos] → [Train] → [Test] → [Publish]       │
│           ●            ○         ○         ○            │
├─────────────────────────────────────────────────────────┤
│  Step 1 — Photos                                        │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Drop-zone: upload 10–20 photos                   │  │
│  │  GateGuard AV badge (verified / pending)          │  │
│  │  Thumbnail grid (photo count indicator)           │  │
│  │  [Upload More]   [Next →]                         │  │
│  └───────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│  Step 2 — Train                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Display name field                               │  │
│  │  Trigger word field                               │  │
│  │  Persona prompt textarea                          │  │
│  │  Base model selector (flux-1-dev / flux-1-schnell)│  │
│  │  Visibility selector (PRIVATE / PLATFORM_INTERNAL │  │
│  │                        / SUBSCRIBER)              │  │
│  │  [← Back]   [Start Training]                      │  │
│  └───────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│  Step 3 — Test (enabled when TRAINING_COMPLETE)         │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Prompt input → [Generate Preview]                │  │
│  │  Preview image grid (3-up)                        │  │
│  │  [← Back]   [Approve & Publish]                   │  │
│  └───────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│  Step 4 — Publish                                       │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Confirmation summary                             │  │
│  │  Bill 149 consent checkbox (required)             │  │
│  │  [Publish Twin]                                   │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Training In-Progress State

While `TRAINING_IN_PROGRESS`, the stepper is locked at Step 2 with a progress indicator and an
estimated completion time. No user action is required; the UI updates reactively on the
`cyrano.twin.training.complete` NATS event.

### Error State (TRAINING_FAILED)

Step 2 surface shows an inline error banner:

```
Training failed — reason: {error_message}
reason_code: TWIN_TRAINING_FAILED
[Retry Training]
```

`correlation_id` is surfaced in small text beneath for support reference.

---

## Interactions

### Photo Upload

1. Creator drags / taps to open file chooser.
2. GateGuard AV check fires on each upload batch.
   - If AV required: `ComplianceOverlay` blocks UI until check completes.
   - If AV passes: thumbnail added to grid; photo count increments.
   - If GateGuard blocks: `reason_code: IMAGE_GEN_BLOCKED`; photo rejected with inline error.
3. Minimum 10 photos required before "Next" is enabled.

### Publish

1. Creator clicks "Publish Twin".
2. Bill 149 consent checkbox must be checked; otherwise button stays disabled.
3. On confirm: `POST /cyrano/ai-twin` with `visibility` set to chosen value.
4. `AuditRow` written with `reason_code: TWIN_PUBLISHED`, `correlation_id` from the training job.

---

## Compliance

| Layer | Trigger | Action |
|---|---|---|
| GateGuard AV | Photo upload | `ComplianceOverlay` — AV flow; blocks upload until resolved |
| Bill 149 | Publish step | Consent checkbox required; blocks publish action |
| Welfare Guardian | FFS INFERNO band | `SOFT_NUDGE` banner; does not block training wizard |

---

## Copy Slots

```
Header:  {tier} • AI Twin Creator
Step 1:  Upload 10–20 clear, front-facing photos
Step 2:  Configure your twin's identity and training parameters
Step 3:  Test your twin — generate preview images before publishing
Step 4:  Publish your twin to {visibility_label}
Error:   Training failed — please retry or contact support (ref: {correlation_id})
```

---

*Binding: `services/ai-twin/src/ai-twin.types.ts` · `apps/cyrano-standalone/app/ai-twin/page.tsx` ·
`apps/cyrano-standalone/components/AITwinCreator/AITwinCreator.tsx`*
