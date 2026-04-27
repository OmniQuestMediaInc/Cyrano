# PROC-001 — Webhook Hardening Service — REPORT BACK

**Directive:** PROC-001 (CLAUDE_CODE_BACKLOG_v6.md)
**Gate:** CEO-AUTHORIZED-STAGED-2026-04-10 (webhook infrastructure only)
**Authority:** Kevin B. Hartley, CEO/CD — OmniQuest Media Inc.
**Canonical Authority:** OQMI Coding Doctrine v2.0 · Canonical Corpus v10
**Result:** SUCCESS
**Date:** 2026-04-10

---

## Scope & Gate Compliance

Gate `CEO-AUTHORIZED-STAGED-2026-04-10` restricts PROC-001 to webhook
infrastructure only. This report confirms all three gate constraints held:

- [x] **No ledger writes.** `WebhookHardeningService` never imports, injects,
      or calls `LedgerService`, `PrismaService`, or any finance service.
- [x] **No balance columns.** No Prisma models, schema, or migrations touched.
      `git diff --stat prisma/` is empty.
- [x] **No transaction execution.** No processor API calls, no payout logic,
      no token release/freeze. Service is a pure validator + idempotency
      guard with NATS broadcast for observability.

DFSP-001 onward remain gated on GOV-FINTRAC + GOV-AGCO legal opinions —
this directive does not unlock them.

---

## Branch + HEAD

- **Branch:** `claude/run-proc-001-iSRHf`
- **Parent HEAD:** `b62e8859a3eb2f4a8a3d452f05d365e730b47616`
  (`GOV: update PROC-001 gate to CEO-AUTHORIZED-STAGED-2026-04-10; clarify GOV-AV independence (#188)`)

---

## Files Changed

```
services/core-api/src/app.module.ts                   |  2 ++
services/core-api/src/governance/governance.config.ts |  8 ++++++++
services/core-api/src/payments/payments.module.ts     | 17 ++++++++ (new)
services/core-api/src/payments/webhook-hardening.service.ts | 341 ++++ (new)
```

- `services/core-api/src/governance/governance.config.ts`
  Added `WEBHOOK_REPLAY_WINDOW_SECONDS` (300 = 5 min) and
  `WEBHOOK_NONCE_STORE_TTL_SECONDS` (600 = 10 min) to the PV-001
  `GovernanceConfig` const. Read-only, additive change — no existing
  constant mutated.

- `services/core-api/src/payments/webhook-hardening.service.ts` (NEW)
  `WebhookHardeningService` — multi-processor normalization layer.
  Supported processors: `stripe`, `ccbill`, `epoch`. See architecture
  section below.

- `services/core-api/src/payments/payments.module.ts` (NEW)
  `PaymentsModule` — registers and exports `WebhookHardeningService`.
  Follows the DfspModule provider/exports shape.

- `services/core-api/src/app.module.ts`
  Added `PaymentsModule` import and inserted into `imports: [...]`
  immediately after `DfspModule`. No other module order disturbed.

---

## Architecture — Hardening Chain

`WebhookHardeningService.validate(input)` runs the following chain in order
and fails fast on the first failing check. Every rejection emits a NATS
`fiz.webhook.validation.failure` event with `processor_id`, `event_id`,
`failure_reason`, and `rule_applied_id`.

1. **Processor support check** → `PROCESSOR_UNSUPPORTED`
2. **Input well-formed check** → `MALFORMED_INPUT`
   (type-guards `event_id`, `signature`, `signing_secret`, `raw_body`,
   `timestamp_seconds`; no secret ever logged)
3. **Replay window** → `REPLAY_WINDOW_EXCEEDED`
   `|now_sec − timestamp_sec| ≤ GovernanceConfig.WEBHOOK_REPLAY_WINDOW_SECONDS`
4. **Nonce dedup** (when the processor supplies one) → `NONCE_ALREADY_SEEN`
5. **Per-processor signature validation** → `SIGNATURE_INVALID`
   - `stripe`: HMAC-SHA256 over `${timestamp}.${raw_body}`
   - `ccbill`: HMAC-SHA256 over `${event_id}.${timestamp}.${raw_body}`
   - `epoch`: SHA-256 digest over `raw_body + signing_secret`
   All equality checks go through `crypto.timingSafeEqual()` via a
   `constantTimeEquals` wrapper.
6. **event_id idempotency** → `EVENT_ID_DUPLICATE`
   Dedup explicitly happens **before** any downstream consumer can write
   to the ledger. The service only tracks seen IDs; it does not itself
   write ledger entries.

On success, both `event_id` and `nonce` (when present) are recorded into
append-only in-process `Map<string, TtlEntry>` stores, harvested lazily on
TTL expiry (`WEBHOOK_NONCE_STORE_TTL_SECONDS`). Stores are namespaced by
processor (`processor::key`). A Redis / Postgres backing is a drop-in swap
for a later PROC directive — the public surface does not change.

### Dead Letter Queue hook (advisory only)

`sendToDeadLetterQueue(params)` publishes to `fiz.webhook.dlq` with
`processor_id`, `event_id`, `failure_reason`, `body_byte_length`, and
`rule_applied_id`. **Raw body contents are never published** — consumers
receive only the byte length for triage. Per directive: "human review
required" — no automatic re-processing.

---

## Standing-Invariant Compliance

| # | Invariant | Status |
|---|---|---|
| 1 | No UPDATE/DELETE on ledger/audit/game/call/voucher tables | ✅ no DB access at all |
| 2 | FIZ commits require REASON/IMPACT/CORRELATION_ID | ✅ see commit message |
| 3 | No hardcoded constants — read from `governance.config.ts` | ✅ `WEBHOOK_REPLAY_WINDOW_SECONDS`, `WEBHOOK_NONCE_STORE_TTL_SECONDS` read from `GovernanceConfig` |
| 4 | `crypto.randomInt()` only; `Math.random()` prohibited | ✅ no randomness used |
| 5 | No `@angular/core` imports | ✅ verified |
| 6 | `npx tsc --noEmit` zero code-level errors | ✅ see validation section |
| 7 | Every service has a `Logger` instance | ✅ `private readonly logger = new Logger(...)` |
| 8 | Report-back mandatory before DONE | ✅ this file |
| 9 | NATS topics only from `topics.registry.ts` | ✅ `NATS_TOPICS.WEBHOOK_VALIDATION_FAILURE` + `WEBHOOK_DLQ` (registry already contained both) |
| 10 | AI services advisory only, no financial execution | ✅ N/A — no AI; service is infrastructure-only |
| 11 | Step-up auth before sensitive actions | ✅ N/A — webhook validator does not perform sensitive actions |
| 12 | RBAC before step-up, fail-closed on unknown perm | ✅ N/A |
| 13 | SHA-256 for all hashes | ✅ HMAC-SHA256 (Stripe, CCBill) + SHA-256 (Epoch) |
| 14 | All timestamps America/Toronto | ✅ N/A — timestamps compared in epoch seconds (timezone-invariant) |
| 15 | `rule_applied_id` on every service output object | ✅ `'WEBHOOK_HARDENING_v1'` on every `ValidationResult` and every NATS payload |

**No refactoring:** No existing file had logic changed. Additions only:
- 8 lines added to `GovernanceConfig` const (2 constants + section header)
- 2 lines added to `app.module.ts` (import + registration)
- 2 new files under `src/payments/`

**No renames.** No existing NATS topic strings touched. `NATS_TOPICS.WEBHOOK_VALIDATION_FAILURE`
and `NATS_TOPICS.WEBHOOK_DLQ` already existed in `services/nats/topics.registry.ts`.

**No package changes.** `yarn.lock` not touched. `crypto` is a Node stdlib module.

---

## Validation

### `npx tsc --noEmit` — zero new errors

Run from `services/core-api`:

```
$ cd services/core-api && npx tsc --noEmit
tsconfig.json(4,5): error TS5101: Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0. Specify compilerOption '"ignoreDeprecations": "6.0"' to silence this error.
EXIT=0
```

The `TS5101` line is a **pre-existing** deprecation notice for the root
`tsconfig.json`'s `baseUrl` option and is unrelated to PROC-001. Verified
by running `tsc --noEmit` against the baseline (modified files stashed):
the same single `TS5101` line is produced, exit 0. No new errors introduced.

### Directive validation checklist

| # | Requirement | Evidence |
|---|---|---|
| ✅ | Stripe HMAC-SHA256 validates correctly | `verifyHmacSha256()` over `${timestamp_seconds}.${raw_body}` using `crypto.createHmac('sha256', secret)`, verified via `timingSafeEqual` |
| ✅ | Replay rejected when timestamp drift > 5 minutes | `isWithinReplayWindow()` compares `|now − ts|` against `GovernanceConfig.WEBHOOK_REPLAY_WINDOW_SECONDS` (= 300); over-window returns `REPLAY_WINDOW_EXCEEDED` |
| ✅ | Duplicate `event_id` rejected before ledger write | `hasSeenEventId()` check in step 6 of the hardening chain returns `EVENT_ID_DUPLICATE` before the service's only success path (which still writes no ledger entry — infrastructure-only) |
| ✅ | NATS published on every validation failure | `reject()` is the single exit point for every failure reason and calls `nats.publish(NATS_TOPICS.WEBHOOK_VALIDATION_FAILURE, {...})` with `processor_id`, `event_id`, `failure_reason`, `rule_applied_id` |
| ✅ | `npx tsc --noEmit` zero new errors | confirmed above |

---

## Security Notes

- `signing_secret` is **never** logged. The `catch` branch of
  `isSignatureValid()` captures only the error class name (`err.name`),
  not the message, not the stack.
- `raw_body` is **never** logged and **never** published over NATS.
  The DLQ hook publishes only `body_byte_length` for triage.
- All hash comparisons use `crypto.timingSafeEqual()` to prevent
  timing side channels.
- Length-mismatched signatures short-circuit before `timingSafeEqual`
  (which itself throws on length mismatch) so we do not leak via
  exception timing.
- No PII is logged. Only `processor_id` (enum), `event_id` (opaque
  processor ID), and `failure_reason` (enum) ever appear in logs or NATS
  payloads.

---

## Follow-Ups (intentionally not part of PROC-001)

1. **Persistent dedup store.** The in-process `Map` stores satisfy this
   directive's scope. Swap for Redis (preferred) or a Postgres
   `webhook_dedup_log` table in a later PROC directive — once GOV-FINTRAC
   + GOV-AGCO clear and ledger-integrated webhook handling is authorized.
2. **Processor-specific envelope decoders.** The baseline HMAC contracts
   enforced here are the floor. Full CCBill DataLink envelope parsing
   and Epoch callback field mapping belong in PROC-002 / DFSP-001.
3. **HTTP transport layer.** No controller was added. A controller that
   calls `WebhookHardeningService.validate()` before dispatching to a
   ledger consumer belongs in PROC-002 (per directive sequencing:
   "PROC-001 on main → DFSP-001").

---

## HANDOFF

- **Built:** `WebhookHardeningService`, `PaymentsModule`, two new
  `GovernanceConfig` constants, `AppModule` wiring. All commits
  `FIZ:`-prefixed with four-line REASON/IMPACT/CORRELATION_ID format.
- **Intentionally left incomplete (per gate):** No controllers, no
  ledger writes, no processor API calls, no persistent dedup store.
- **Next agent's first task:** When GOV-FINTRAC + GOV-AGCO legal
  opinions clear, begin DFSP-001 (Platform OTP + Account Recovery
  Hold) per `CLAUDE_CODE_BACKLOG_v6.md`. DFSP-001 depends on PROC-001
  being on `main`.

---

*End of PROC-001 report-back.*
