# REPORT-BACK — OBS-001

**Directive:** THREAD11-COPILOT-INTAKE — Directive 8 (final of series)
**Rule:** OBS-001
**Agent:** CLAUDE_CODE
**Date:** 2026-04-17
**Branch:** obs/obs-001

---

## Files Created

- `services/obs-bridge/src/obs-bridge.service.ts` — OBSBridgeService: RTMP / browser-stream ingest surface; SHA-256 stream-key validation; NATS on connect/disconnect/key rotation.
- `services/obs-bridge/src/chat-aggregator.service.ts` — ChatAggregatorService: CNZ source, normalises to `ChatMessage`, publishes `chat.message.ingested` with jitter delay from `OBS.CHAT_JITTER_*_MS`.
- `services/obs-bridge/src/persona-engine.service.ts` — PersonaEngineService: subscribes to `CHAT_MESSAGE_INGESTED`, gates on `Creator.creator_auto`, prefixes Bill 149 disclosure on every response, publishes `persona.response.queued`. Rule-based only — no AI call (OBS-004).
- `services/obs-bridge/src/obs-bridge.module.ts` — NestJS module exporting all three services.
- `PROGRAM_CONTROL/REPORT_BACK/OBS-001-REPORT-BACK.md` (this file)

## Files Modified

- `prisma/schema.prisma` — Added minimal `Creator` model with `stream_key_hash` (unique, `@db.VarChar(64)` — SHA-256 hex) and `creator_auto` (Boolean, default `false`). `organization_id` + `tenant_id` required.
- `services/core-api/src/config/governance.config.ts` — Added `OBS` block:
  - `CHAT_JITTER_MIN_MS = 150`
  - `CHAT_JITTER_MAX_MS = 450`
  - `BILL_149_DISCLOSURE_PREFIX = 'This message was generated with AI assistance. '`
- `services/nats/topics.registry.ts` — Registered 5 new topics:
  - `OBS_STREAM_STARTED = 'obs.stream.started'`
  - `OBS_STREAM_ENDED = 'obs.stream.ended'`
  - `OBS_STREAM_KEY_ROTATED = 'obs.stream.key.rotated'`
  - `CHAT_MESSAGE_INGESTED = 'chat.message.ingested'`
  - `PERSONA_RESPONSE_QUEUED = 'persona.response.queued'`

## Files Confirmed Unchanged

- `services/core-api/src/app.module.ts` — not modified. (Integration of `OBSBridgeModule` into the application graph is a separate integration step; the directive scope is foundational module only.)
- `services/core-api/src/finance/*` — untouched.
- All MEMB-* / BJ-* artefacts — untouched.

## Stream Key — Confirmed Stored as Hash, Not Plaintext

- `OBSBridgeService.hashStreamKey(plaintext)` uses Node's `crypto.createHash('sha256')` and stores the hex digest in `Creator.stream_key_hash`.
- `regenerateStreamKey()` returns the plaintext value ONE TIME for out-of-band transmission to the creator; it is never logged and never re-derived from the DB.
- `acceptConnection()` hashes the provided key at request time and performs a constant-field comparison (`=== providedHash`) against the stored hash. Validation failure is logged WITHOUT the plaintext key.

## CREATOR_AUTO Flag Location

- Field: `Creator.creator_auto` in `prisma/schema.prisma`.
- Default: `false` (persona engine is off unless the creator opts in).
- Read by: `PersonaEngineService.handleIngested()` — when `false`, no response
  is generated and the engine returns early after logging.

## GovernanceConfig Constants Used

From `services/core-api/src/config/governance.config.ts`:

- `OBS.CHAT_JITTER_MIN_MS` = 150 ✅ (added)
- `OBS.CHAT_JITTER_MAX_MS` = 450 ✅ (added)
- `OBS.BILL_149_DISCLOSURE_PREFIX` = `'This message was generated with AI assistance. '` ✅ (added)

All three are referenced by name in the service files — no hardcoded
values.

## NATS Topic Constants Used

All from `services/nats/topics.registry.ts`:

- `NATS_TOPICS.OBS_STREAM_STARTED` ✅
- `NATS_TOPICS.OBS_STREAM_ENDED` ✅
- `NATS_TOPICS.OBS_STREAM_KEY_ROTATED` ✅
- `NATS_TOPICS.CHAT_MESSAGE_INGESTED` ✅
- `NATS_TOPICS.PERSONA_RESPONSE_QUEUED` ✅

No raw topic strings used.

## Invariants Confirmed

1. **Stream key stored as SHA-256 hash — never plaintext** —
   `OBSBridgeService.hashStreamKey` uses SHA-256; the `Creator.stream_key_hash`
   column is a 64-char hex field ✅
2. **Bill 149 prefix on all CREATOR_AUTO=true outputs — from GovernanceConfig
   only, never hardcoded** — `PersonaEngineService` reads
   `OBS.BILL_149_DISCLOSURE_PREFIX` and concatenates it to every generated
   response before publishing ✅
3. **Jitter bounds from GovernanceConfig OBS block** —
   `ChatAggregatorService.computeJitterMs()` uses `OBS.CHAT_JITTER_MIN_MS`
   and `OBS.CHAT_JITTER_MAX_MS` ✅
4. **`rule_applied_id` on all persona.response.queued events** —
   `OBS-001_PERSONA_ENGINE_v1` ✅
5. **Logger on all three services** —
   `OBSBridgeService`, `ChatAggregatorService`, `PersonaEngineService` ✅
6. **`organization_id` + `tenant_id` on all Prisma writes** —
   required on `Creator` model; required on every service input;
   echoed to every NATS payload ✅
7. **NATS_TOPICS.* constants only** — no raw strings ✅

## Multi-tenant Mandate

- `Creator.organization_id` and `Creator.tenant_id` required on row.
- Every service method accepts `organizationId` + `tenantId` inputs and
  threads them to every NATS payload.

## npx tsc --noEmit Result

Baseline: 1 pre-existing `tsconfig.json` `baseUrl` deprecation notice
(TS5101). Zero NEW TypeScript errors introduced.

```
tsconfig.json(12,5): error TS5101: Option 'baseUrl' is deprecated ...
```

## git diff --stat

```
prisma/schema.prisma                                  | 17 ++++
services/core-api/src/config/governance.config.ts     | 11 ++++
services/nats/topics.registry.ts                      |  8 +++
services/obs-bridge/src/chat-aggregator.service.ts    | 85  (created)
services/obs-bridge/src/obs-bridge.module.ts          | 13  (created)
services/obs-bridge/src/obs-bridge.service.ts         | 180 (created)
services/obs-bridge/src/persona-engine.service.ts     | 116 (created)
PROGRAM_CONTROL/REPORT_BACK/OBS-001-REPORT-BACK.md    | (created)
```

## Thread 11 Series Closure

DIRECTIVE 8 is the final directive of THREAD11-COPILOT-INTAKE. On this
merge, `THREAD11-COPILOT-INTAKE.md` is moved from `QUEUE/` to `DONE/`
(separate commit / PR housekeeping task).

## Result

**SUCCESS**

All OBS-001 scope items delivered:
- ✅ `OBSBridgeService` with SHA-256 stream-key validation
- ✅ `ChatAggregatorService` with jitter delivery per GovernanceConfig
- ✅ `PersonaEngineService` with CREATOR_AUTO gate + Bill 149 prefix
- ✅ `Creator` model fields: `stream_key_hash`, `creator_auto`
- ✅ `OBS` GovernanceConfig block
- ✅ 5 NATS topics registered
- ✅ Zero new tsc errors
