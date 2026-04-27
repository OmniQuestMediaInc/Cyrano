# Cyrano™ Standalone

> **AI Character Companions — photorealistic, persistent-memory, voice-cloned.**
> Powered by Flux LoRA fine-tuning, ElevenLabs voice cloning, and a cinematic narrative engine.
> Governed by OmniQuest Media Inc. (OQMInc™) — OQMI Coding Doctrine v2.0.

**Package manager:** Yarn (canonical for all OQMInc repos — do not use npm or pnpm).

---

## What is Cyrano™?

Cyrano™ is a standalone AI companion product built on top of the OmniQuestMediaInc
governance, ledger, and user system. It allows creators to:

1. **Train an AI Twin** — Upload photos → fine-tune a Flux LoRA model → generate photorealistic
   character images with natural skin, pores, lighting depth, and cinematic quality.
2. **Persistent Character Chat** — Conversations backed by a long-term Memory Bank
   (facts, preferences, story beats, secrets) so every interaction deepens the relationship.
3. **Voice Call** — ElevenLabs voice cloning gives each character a unique, cloned voice for
   real-time spoken interactions.
4. **Narrative Branching** — Cinematic branching choice points let users shape their story arc,
   with consequences written into memory.
5. **House Models** — Platform-owned characters that keep 100% revenue for testing and direct
   platform monetization.

---

## Repository Structure

```
Cyrano/
├── apps/
│   ├── cyrano-standalone/       # Next.js 14 frontend (port 3100)
│   │   ├── app/                 # App Router pages
│   │   │   ├── page.tsx         # Home dashboard
│   │   │   ├── ai-twin/         # AI Twin Creator wizard
│   │   │   ├── chat/            # Character Chat
│   │   │   └── voice-call/      # Voice Call
│   │   ├── components/
│   │   │   ├── AITwinCreator/   # Step-by-step twin training wizard
│   │   │   ├── CharacterChat/   # Persistent narrative chat UI
│   │   │   └── VoiceCall/       # ElevenLabs TTS voice call UI
│   │   └── lib/                 # Session helpers, API clients
│   ├── portals/                 # Brand-specific portal apps
│   │   ├── main/                # Main platform portal
│   │   ├── ink-and-steel/       # Ink & Steel brand portal
│   │   ├── lotus-bloom/         # Lotus Bloom brand portal
│   │   ├── desperate-housewives/ # Desperate Housewives brand portal
│   │   ├── barely-legal/        # Barely Legal brand portal
│   │   └── dark-desires/        # Dark Desires brand portal
│   └── shared-ui/               # Shared UI component library
│       ├── components/          # Reusable React/UI components
│       ├── lib/                 # Shared utilities and helpers
│       └── themes/              # Brand-specific theme tokens
├── services/
│   ├── ai-twin/                 # Photo upload + Flux LoRA training pipeline
│   ├── image-generation/        # Flux 2 Pro + Banana.dev image service
│   ├── voice-cloning/           # ElevenLabs voice clone + TTS service
│   ├── narrative-engine/        # Persistent memory + cinematic branching
│   ├── cyrano/                  # Cyrano core (session, prompt, persona)
│   ├── core-api/                # NestJS monolith (auth, ledger, GateGuard, …)
│   ├── diamond-concierge/       # Diamond-tier VIP concierge
│   ├── ledger/                  # Canonical Ledger (append-only finance)
│   ├── creator-control/         # Creator management
│   ├── integration-hub/         # Service integration layer
│   ├── recovery/                # Diamond recovery flows
│   ├── ffs/                     # Flicker n'Flame Scoring (Red Room rewards)
│   ├── gamification/            # Earn/burn logic, prize pools
│   └── rewards-api/             # Rewards API
├── prisma/                      # Prisma schema + migrations
├── finance/                     # Canonical Ledger, REDBOOK, dynamic pricing
├── governance/                  # Governance artifacts
├── PROGRAM_CONTROL/             # Directive queue, ship-gate verifier, report-backs
├── docs/                        # Architecture, glossary, requirements
└── docker-compose.yml           # Cyrano-focused compose (db, redis, nats, api, cyrano-ui)
```

---

## Quick Start (Development)

```bash
# 1. Install dependencies
yarn install

# 2. Copy environment variables
cp .env.example .env
# Fill in DATABASE_URL, ELEVENLABS_API_KEY, BANANA_API_KEY, etc.

# 3. Start infrastructure (Postgres, Redis, NATS)
docker-compose up db redis nats -d

# 4. Apply Prisma migrations
yarn prisma migrate dev

# 5. Start the core API
yarn workspace core-api dev

# 6. Start the Cyrano standalone UI
cd apps/cyrano-standalone && yarn dev
# → http://localhost:3100
```

Or run everything with Docker Compose:

```bash
docker-compose up
# → API: http://localhost:3000
# → Cyrano UI: http://localhost:3100
```

---

## Key API Endpoints

| Endpoint | Description |
|---|---|
| `POST /cyrano/ai-twin` | Create a new AI twin record |
| `POST /cyrano/ai-twin/:id/photos` | Record a photo upload |
| `POST /cyrano/ai-twin/:id/train` | Start Flux LoRA training |
| `GET  /cyrano/ai-twin/house-models` | List platform house models |
| `POST /cyrano/images/generate` | Generate a photorealistic image |
| `POST /cyrano/voice` | Create a voice clone |
| `POST /cyrano/voice/tts` | Text-to-speech with cloned voice |
| `POST /cyrano/narrative/memory` | Store a memory for a user+twin |
| `POST /cyrano/narrative/context` | Build LLM context from memory bank |
| `POST /cyrano/narrative/branch` | Create a cinematic branch point |
| `POST /cyrano/narrative/branch/:id/resolve` | Resolve a branch choice |

---

## Environment Variables

See [`.env.example`](.env.example) for a full list. Key variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `ELEVENLABS_API_KEY` | ElevenLabs API key for voice cloning + TTS |
| `BANANA_API_KEY` | Banana.dev API key for Flux LoRA training |
| `BANANA_MODEL_KEY_FLUX_PRO` | Banana.dev model key for Flux Pro |
| `AI_TWIN_LORA_RANK` | LoRA rank for training (default: 16) |
| `NARRATIVE_MEMORY_TTL_DAYS` | Memory retention in days (default: 365) |

---

## Governance

This repo operates under the OQMI Coding Doctrine v2.0. All agents must read:

- **[`PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_GOVERNANCE.md`](PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_GOVERNANCE.md)** — governance invariants, PR lifecycle, escalation discipline.
- **[`docs/DOMAIN_GLOSSARY.md`](docs/DOMAIN_GLOSSARY.md)** — naming authority and commit prefix enum.

### Financial Integrity Zone (FIZ)

All paths under `services/ledger/`, `finance/`, and any code touching `balance`, `payout`,
`escrow`, or `ledger_entry` columns are FIZ-scoped. FIZ commits require:

```
FIZ: <subject>
REASON: <why>
IMPACT: <financial surface affected>
CORRELATION_ID: <idempotency key>
```

### Non-negotiable invariants

- **Append-only finance** — no `UPDATE`/`DELETE` on ledger tables; corrections are offset entries.
- **NATS for real-time** — all chat and AI events via NATS.io; no REST polling.
- **Network isolation** — Postgres (5432) and Redis (6379) never on public interface.
- **No secrets in tree** — all credentials in `.env` only, never committed.

---

## Future Merge Path

Cyrano Standalone shares the same Prisma schema, governance model, Canonical Ledger, and
user system as the main ChatNow.Zone platform. When ready to merge:

1. The `AiTwin`, `VoiceClone`, `MemoryBank`, `ImageCache`, and `NarrativeBranch` Prisma
   models drop cleanly into the ChatNow.Zone schema with no conflicts.
2. The four new services (`ai-twin`, `image-generation`, `voice-cloning`, `narrative-engine`)
   register as NestJS modules in `core-api/src/app.module.ts`.
3. The `cyrano-standalone` Next.js app becomes a sub-app in the main monorepo.

---

*Cyrano™ — OmniQuest Media Inc. · All rights reserved.*
