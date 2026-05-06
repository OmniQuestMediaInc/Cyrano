# DIRECTIVE: CYR-AI-TWIN-003-PIPELINE

**Status:** `QUEUED`
**Commit prefix:** `CYR:`
**Depends on:** CYR-CORE-001-PROVIDER-RELIABILITY (for retries / circuit
breaker / pre-flight ledger debit)
**Target paths:**

- `apps/cyrano-standalone/src/app/twin/create/*` (CREATE — wizard)
- `services/ai-twin/src/photo-validation.service.ts` (CREATE)
- `services/ai-twin/src/twin-pricing.service.ts` (CREATE)
- `services/ai-twin/src/ai-twin.service.ts` (UPDATE — cancellation,
  webhook signature verification)
- `services/ai-twin/src/ai-twin.controller.ts` (UPDATE — DTOs + cancel
  endpoint)

**Risk class:** R2 (paid path; user-uploaded photos; safety gate)

## Context

The AI Twin Creator is the headline Cyrano experience. Today the wizard
endpoints are stubs and the LoRA training job is a queue-and-pray flow
with no progress visibility, no cancellation, no cost preview, and no
photo-content safety filter.

## Tasks

1. **Wizard flow (`apps/cyrano-standalone/src/app/twin/create/`):**
   - Step 1 — upload (5–25 photos, ≥768×768, ≤10MB each).
   - Step 2 — validate (calls `photo-validation.service`).
   - Step 3 — preview cost (calls `twin-pricing.service`).
   - Step 4 — pre-flight `LedgerService.debitWallet()` with `FIZ:` prefix +
     `correlation_id` (matches the user's wallet bucket selection).
   - Step 5 — kick training. UI polls `GET /cyrano/ai-twin/:twinId` every
     5s and renders progress; switches to NATS subscription when the
     `ai-twin.training.progress` topic event arrives.
   - Step 6 — model registration on `TRAINING_COMPLETE`.

2. **PhotoValidationService:**
   - Reject non-photographic content (anime, paintings, sketches) via
     a CLIP-style classifier.
   - Reject minors via the existing GateGuard age estimator (consensus of
     2 different models, conservative).
   - Reject NSFW content for non-adult-themed portals.
   - Emit `cyrano.ai-twin.photo.rejected` on rejection with redacted
     payload.

3. **TwinPricingService:**
   - Cost = base_lora_cost (env) + per_photo_cost × photo_count.
   - Returns CZT total, USD equivalent, expected wait time.

4. **Cancellation:**
   - `POST /cyrano/ai-twin/:twinId/cancel` — verifies twin status,
     cancels Banana.dev job (stretch — best-effort), reverses the
     pre-flight debit via the canonical refund path, emits
     `cyrano.ai-twin.training.cancelled`.

5. **Webhook security:**
   - `POST /cyrano/ai-twin/training-callback` — verify HMAC signature
     using `BANANA_WEBHOOK_SECRET` (add to `.env.example`).

## Validation

- New unit specs for `photo-validation.service` + `twin-pricing.service`.
- New E2E spec exercising the full wizard against a stubbed Banana.dev
  worker.
- Cancellation reverses ledger state to the original pre-debit balance.
- Webhook with bad signature returns 401.
- `yarn typecheck && yarn lint && yarn test` clean.

## Report-back file

`PROGRAM_CONTROL/REPORT_BACK/CYR-AI-TWIN-003-PIPELINE.md`
