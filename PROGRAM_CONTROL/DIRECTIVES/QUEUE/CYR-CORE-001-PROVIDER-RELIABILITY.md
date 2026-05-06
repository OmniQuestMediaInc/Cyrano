# DIRECTIVE: CYR-CORE-001-PROVIDER-RELIABILITY

**Status:** `QUEUED`
**Commit prefix:** `CYR:`
**Target paths:**

- `services/core-api/src/common/http-client.ts` (CREATE)
- `services/core-api/src/common/circuit-breaker.ts` (CREATE)
- `services/ai-twin/src/ai-twin.service.ts` (UPDATE)
- `services/image-generation/src/image.service.ts` (UPDATE)
- `services/voice-cloning/src/voice.service.ts` (UPDATE)
- `services/narrative-engine/src/narrative.service.ts` (UPDATE)

**Risk class:** R2 (production reliability)

## Context

Phase 1 Hygiene refresh closed compile-level gaps in the four new Cyrano
services (ai-twin, image-generation, voice-cloning, narrative-engine), but
each currently calls Banana.dev / ElevenLabs / Flux through bare `fetch()`
calls with no retry, no timeout, no circuit breaker, and only opportunistic
logging. Production traffic against any of these will brown out under
provider hiccups.

## Tasks

1. Implement a shared `HttpClient` in `services/core-api/src/common/http-client.ts`:
   - Configurable timeout (default 30s).
   - Exponential backoff retry on 5xx + network errors (default 3 retries:
     1s → 2s → 4s with jitter).
   - Per-call structured logging with `correlation_id`, latency_ms,
     `provider`, `status_code`.
   - Honors `AbortSignal` for cancellation.

2. Implement a `CircuitBreaker` (closed → open → half-open) in
   `services/core-api/src/common/circuit-breaker.ts`:
   - Trip threshold: 5 consecutive failures (configurable).
   - Reset timeout: 30 s.
   - Per-provider instance (banana, elevenlabs, flux).

3. Refactor the four service `fetch(...)` call sites to use `HttpClient` +
   `CircuitBreaker`. Re-introduce the deleted `NATS_IMAGE_FAILED` constant
   in `image.service.ts` and emit it from the new failure path.

4. Add request validation (class-validator + DTOs) on every public NestJS
   endpoint that touches a paid provider:
   `services/ai-twin/src/ai-twin.controller.ts`,
   `services/image-generation/src/image.controller.ts`,
   `services/voice-cloning/src/voice.controller.ts`.

5. Apply `@nestjs/throttler` rate limiting (per `user_id` + per-IP) on all
   provider-backed endpoints. Default: 10 req/min/user, 100 req/min/IP.

6. Ensure every paid call goes through Ledger first:
   - Pre-flight `LedgerService.debitWallet()` with `FIZ:` prefix and
     `correlation_id`.
   - On provider failure, refund via the existing append-only refund path
     (do not attempt to delete the original debit — invariant).

## Validation

- New `tests/integration/http-client.spec.ts` covers retry, timeout, jitter.
- New `tests/integration/circuit-breaker.spec.ts` covers state transitions.
- Refactored services pass existing specs unchanged.
- `yarn typecheck && yarn lint && yarn test` clean.
- Smoke E2E against a stubbed Banana.dev returning 503 confirms graceful
  degradation + ledger refund.

## Report-back file

`PROGRAM_CONTROL/REPORT_BACK/CYR-CORE-001-PROVIDER-RELIABILITY.md`
