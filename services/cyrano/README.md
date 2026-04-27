# Cyrano — Whisper Copilot Service

**Service prefix:** `CYR:`  
**Domain:** Creator coaching / AI suggestion layer  
**Path:** `services/cyrano/`

## Purpose

Cyrano is the invisible whisper copilot for ChatNow.Zone creators. It
evaluates real-time session telemetry (room heat, dwell, silence, guest
history) and surfaces context-weighted suggestions to the creator's panel.
Suggestions are never visible to the guest.

## Architecture

Cyrano ships in four layers, all backed by the **same core suggestion
engine + shared template surface**:

| Layer | Role | Surface |
|-------|------|---------|
| 1 | Deterministic whisper copilot for ChatNow.Zone creators | NATS-only |
| 2 | LLM-backed standalone role-play platform (`apps/cyrano-standalone/`) | `/cyrano/auth/session` + standalone runtime |
| 3 | HCZ shift-briefing consumer | NATS subscriber |
| 4 | Enterprise multi-tenant Whisper API (teaching, coaching, first-responder, factory-safety, medical) | `/cyrano/layer4/*` REST + NATS |

### Components

| File | Role |
|------|------|
| `cyrano.service.ts` | Layer 1 suggestion engine — category selection, weight computation, copy generation |
| `persona.manager.ts` | Creator persona registry + session activation |
| `session-memory.store.ts` | In-process (creator_id, guest_id) durable fact + arc store |
| `cyrano.types.ts` | Shared TypeScript contracts (Layers 1-4) |
| `cyrano-prompt-templates.ts` | Shared template engine + Layer 4 content_mode resolver + extension-point registry |
| `cyrano-layer3-hcz.service.ts` | Layer 3 HCZ shift-briefing consumer |
| `cyrano-layer4-enterprise.service.ts` | Layer 4 orchestrator (tenant + rate-limit + audit + voice composition) |
| `cyrano-layer4.controller.ts` | Layer 4 REST surface — tenant register, key mint/list/revoke, prompt resolve, audit read |
| `cyrano-layer4.guard.ts` | Layer 4 request guard — tenant + API-key isolation |
| `cyrano-layer4.types.ts` | Layer 4 DTOs and reason-code enum |
| `cyrano-layer4-tenant.store.ts` | Append-only tenant registry (in-process; Phase-2 Prisma swap is drop-in) |
| `cyrano-layer4-api-key.service.ts` | Mint / verify / revoke API keys (SHA-256 hashed, never persists raw key) |
| `cyrano-layer4-rate-limiter.service.ts` | Per-tenant minute window + per-API-key 1-second burst |
| `cyrano-layer4-audit.service.ts` | Hash-chained tenant audit log (correlation_id idempotent, `verifyChain()` replay) |
| `cyrano-layer4-voice.bridge.ts` | Voice synthesis bridge — domain-default voice profiles + HIPAA consent enforcement |
| `cyrano.module.ts` | NestJS module wiring (Layers 1, 3, 4) |

## Layer 4 — Enterprise Whisper API

Layer 4 exposes Cyrano flows to enterprise tenants. Every request:

1. Carries `x-cyrano-tenant-id` + `x-cyrano-api-key` headers (and optional
   `x-correlation-id`, `x-consent-receipt-id`).
2. Is authenticated by `CyranoLayer4Guard` (tenant lookup + constant-time
   key hash compare + isolation check).
3. Is rate-limited per-tenant (minute window) and per-API-key (1-second burst).
4. Resolves a domain-aware template (teaching, coaching, first-responder,
   factory-safety, medical, plus content_mode-aware adult-domain overlays).
5. Optionally synthesises voice through `CyranoLayer4VoiceBridge`.
6. Is recorded — allow OR deny — in the **hash-chained tenant audit log**
   with `correlation_id` + `reason_code` for SOC 2 / HIPAA evidence.

### REST surface

| Method | Path | Notes |
|--------|------|-------|
| POST | `/cyrano/layer4/tenants` | Register/upsert a tenant (admin) |
| POST | `/cyrano/layer4/tenants/:tenantId/keys` | Mint an API key (returns raw key once) |
| GET | `/cyrano/layer4/tenants/:tenantId/keys` | List hashed key records |
| DELETE | `/cyrano/layer4/tenants/:tenantId/keys/:apiKeyId` | Revoke a key |
| GET | `/cyrano/layer4/tenants/:tenantId/audit` | Read tenant audit log + chain verify |
| POST | `/cyrano/layer4/prompt` | Resolve a domain prompt (gated by Layer 4 guard) |

### Reason-code enum (Layer 4)

`TENANT_AUTHORIZED`, `TENANT_NOT_FOUND`, `TENANT_DISABLED`,
`API_KEY_MISSING`, `API_KEY_INVALID`, `API_KEY_REVOKED`,
`TENANT_MISMATCH`, `BAA_NOT_SIGNED`, `TEMPLATE_UNAVAILABLE`,
`CONTENT_MODE_FORBIDDEN`, `CONTENT_MODE_MISMATCH`,
`RATE_LIMIT_EXCEEDED`, `VOICE_NOT_PERMITTED`,
`VOICE_SYNTHESIS_FAILED`, `VOICE_DISABLED_BY_REQUEST`,
`CONSENT_RECEIPT_MISSING`, `PROMPT_OK`.

### NATS topics (Layer 4)

`cyrano.layer4.tenant.registered`, `cyrano.layer4.api_key.issued`,
`cyrano.layer4.api_key.revoked`, `cyrano.layer4.prompt.granted`,
`cyrano.layer4.prompt.denied`, `cyrano.layer4.rate_limited`,
`cyrano.layer4.audit.recorded`, `cyrano.layer4.voice.synthesized`,
`cyrano.layer4.voice.skipped`.

## Suggestion Categories

| Category | When to Surface |
|----------|----------------|
| `CAT_SESSION_OPEN` | Session start (COLD heat, OPENING phase) |
| `CAT_ENGAGEMENT` | Mid-session flow maintenance |
| `CAT_ESCALATION` | HOT / INFERNO heat — intimacy escalation |
| `CAT_NARRATIVE` | Arc reinforcement |
| `CAT_CALLBACK` | ≥2 durable facts on record + WARM/HOT phase |
| `CAT_RECOVERY` | Silence ≥ 60 s or COLD heat in mid-session |
| `CAT_MONETIZATION` | HOT+ heat, untipped guest, or PEAK phase |
| `CAT_SESSION_CLOSE` | CLOSING phase or INFERNO heat winding down |

## Latency SLOs

| Target | Value |
|--------|-------|
| Ideal | < 2 000 ms |
| Hard cutoff | < 4 000 ms |

Suggestions exceeding the hard cutoff are silently discarded. A
`CYRANO_SUGGESTION_DROPPED` NATS event is emitted for audit.

## Persona Model

Each creator may register multiple personas. Exactly one persona is
active per session. Tone and style notes from the active persona feed
into suggestion copy templates.

## Session Memory

`SessionMemoryStore` maintains (creator_id, guest_id)-scoped facts and
narrative arcs across sessions. Facts drive `CAT_CALLBACK` suggestions.
In Layer 1, storage is in-process; Layer 2 will persist to Prisma.

## NATS Topics Emitted

| Topic | When |
|-------|------|
| `cyrano.suggestion.emitted` | Valid suggestion dispatched |
| `cyrano.suggestion.dropped` | Suggestion discarded (latency or no match) |
| `cyrano.memory.updated` | Durable fact updated (emitted by caller) |

## Integration

Cyrano is consumed by the Integration Hub (`services/integration-hub/`),
which subscribes to ffs and session events and forwards
`CyranoInputFrame` objects to `CyranoService.suggest()`.

Cyrano is **not** directly exposed via REST — suggestions flow exclusively
through the creator's copilot panel via NATS.
