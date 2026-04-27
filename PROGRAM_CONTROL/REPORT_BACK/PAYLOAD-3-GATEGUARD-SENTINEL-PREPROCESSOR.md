# PAYLOAD 3 — GateGuard Sentinel™ Pre-Processor + Welfare Guardian Score

## Branch + HEAD

- **Branch:** `claude/gateguard-sentinel-preprocessor-4zXSw`
- **Base:** `origin/main` (merge base of branch)

## Scope (CEO Assignment = Approval)

- GateGuard Sentinel™ pre-processor wraps every purchase / spend / payout
  transaction BEFORE any ledger mutation.
- Welfare Guardian Score — real-time composite score (fraud + welfare) on a
  0..100 band per dimension; threshold bands drive a deterministic decision.
- Four-outcome decisioner:
  `APPROVE` | `COOLDOWN` | `HARD_DECLINE` | `HUMAN_ESCALATE`.
- Zero-knowledge AV stubs — NATS fan-out, signed callback intake, chain-of-
  custody log append.
- Federated intelligence hooks — shared ban list / cross-platform fraud
  signals compose into the fraud envelope.
- Human Contact Zone escalation — NATS topic + automatic emission on the
  HUMAN_ESCALATE decision.
- Append-only persistence with SHA-256 hash-chained `gateguard_logs`.
- `@Middleware` wrapper wired at `/purchase`, `/spend`, `/payout`.

## Files Changed

```
prisma/schema.prisma                                           (EXTENDED — +2 models, +53 lines)
services/nats/topics.registry.ts                               (EXTENDED — +10 topics)
services/core-api/src/app.module.ts                            (MODIFIED — GateGuardModule + middleware wiring)
services/core-api/src/gateguard/gateguard.types.ts             (NEW)
services/core-api/src/gateguard/welfare-guardian.scorer.ts     (NEW)
services/core-api/src/gateguard/gateguard.service.ts           (NEW)
services/core-api/src/gateguard/gateguard.middleware.ts        (NEW)
services/core-api/src/gateguard/gateguard.module.ts            (NEW)
tests/integration/gateguard-scorer.spec.ts                     (NEW)
tests/integration/gateguard-service.spec.ts                    (NEW)
tests/integration/gateguard-middleware.spec.ts                 (NEW)
PROGRAM_CONTROL/REPORT_BACK/PAYLOAD-3-GATEGUARD-SENTINEL-PREPROCESSOR.md (NEW)
```

## Prisma Extensions

Both tables are append-only, mirror the repo's existing snake_case mapping,
and are indexed on the fields callers query (correlation_id, decision,
transaction_id, action).

```prisma
model WelfareGuardianScore {
  id              String   @id @default(uuid())
  transaction_id  String   @unique @db.VarChar(200)
  fraud_score     Int
  welfare_score   Int
  risk_factors    Json
  decision        String   @db.VarChar(32)
  correlation_id  String   @db.VarChar(100)
  rule_applied_id String   @db.VarChar(100)
  created_at      DateTime @default(now()) @db.Timestamptz

  @@index([correlation_id])
  @@index([decision, created_at])
  @@map("welfare_guardian_scores")
}

model GateGuardLog {
  id              String   @id @default(uuid())
  transaction_id  String   @db.VarChar(200)
  action          String   @db.VarChar(50)
  score           Json
  decision        String   @db.VarChar(32)
  hash_prior      String   @db.Char(64)
  hash_current    String   @db.Char(64)
  correlation_id  String   @db.VarChar(100)
  rule_applied_id String   @db.VarChar(100)
  created_at      DateTime @default(now()) @db.Timestamptz

  @@index([transaction_id])
  @@index([correlation_id])
  @@index([action, created_at])
  @@map("gateguard_logs")
}
```

## Scorer — Welfare Guardian Score

- **Rule ID:** `WELFARE_GUARDIAN_v1` (scorer) / `GATEGUARD_SENTINEL_v1` (service).
- **Bands:** `fraudScore`, `welfareScore` — each 0..100.
- **Threshold decisioner** (`services/core-api/src/gateguard/welfare-guardian.scorer.ts`):
  - `[0, 40)` → `APPROVE`
  - `[40, 70)` → `COOLDOWN`
  - `[70, 90)` → `HARD_DECLINE`
  - `[90, 100]` → `HUMAN_ESCALATE`
  - Either dimension on its own may promote the decision (max rule).
- **Welfare signals:** spend velocity (60m / 24h), action-scoped velocity
  bands, hour-of-day, session dwell, chase-loss pattern, self-reported
  distress, recent decline count.
- **Fraud signals:** account age, device fingerprint churn (7d), IP/geo
  mismatch, VPN, prior chargeback (auto-bar at 100), disputes (180d),
  structuring pattern, baseline DFSP risk score.
- **AV overrides:** `FAILED` → welfare = 100; `PENDING` → welfare ≥ cooldown
  line; `UNKNOWN` → +10 welfare.
- **Federated overrides:** `sharedBanList` / `crossPlatformFraud` lift fraud
  to at least the `HARD_DECLINE` floor.

## GateGuardService API

- `evaluate(input)` — idempotent, persists, publishes NATS, returns result.
- `preProcess(input, ledgerAction)` — pre-processor wrapper; ledger runs only
  on `APPROVE`; throws `GateGuardDeclineError` otherwise.
- `onAvResult(...)` — AV-provider callback intake; appends to the hash chain.
- `requestFederatedLookup(...)` — NATS fan-out for federated intel.
- `escalateToHumanContactZone(result, reason)` — HCZ escalation emit.

## Middleware

`GateGuardMiddleware` is wired in `app.module.ts` for `/purchase`, `/spend`,
`/payout`:

- `APPROVE` → attaches `req.gateGuard` and calls `next()`.
- `COOLDOWN` → `409 Conflict` (retryable after cool-off).
- `HARD_DECLINE` / `HUMAN_ESCALATE` → `402 Payment Required` (terminal).
- Malformed request → `400 GATEGUARD_BAD_REQUEST`.
- Evaluation exception → `500 GATEGUARD_EVALUATION_FAILED`.

## NATS Topics Added (`services/nats/topics.registry.ts`)

```
gateguard.evaluation.completed
gateguard.decision.approved
gateguard.decision.cooldown
gateguard.decision.hard_decline
gateguard.decision.human_escalate
gateguard.welfare.signal
gateguard.av.check_requested
gateguard.av.check_returned
gateguard.federated.lookup
gateguard.human_contact_zone.escalated
```

## Hash Chain

Every `gateguard_logs` row includes `hash_prior` + `hash_current`, computed as:

```
hash_current = SHA256(hash_prior || canonical_json(payload))
```

- `canonical_json` sorts keys and serialises BigInts as strings so the hash
  is stable across platforms.
- First entry for a transaction links to `GATEGUARD_GENESIS_HASH` (64 × '0').
- AV callbacks append a new link to the same transaction's chain.
- The scorer test suite includes a round-trip assertion that verifies the
  stored hash matches an independently recomputed value.

## Validation Checks

| # | Check | Result |
|---|-------|--------|
| 1 | New Prisma models present & append-only | PASS |
| 2 | Scorer produces `APPROVE` on clean VERIFIED-AV purchase | PASS |
| 3 | Chargeback auto-bar → `HUMAN_ESCALATE` + HCZ NATS emit | PASS |
| 4 | `PENDING` AV → `COOLDOWN` | PASS |
| 5 | Federated ban → `HARD_DECLINE` | PASS |
| 6 | Idempotency — repeat evaluation no-ops | PASS |
| 7 | Hash chain links genesis → first log row | PASS |
| 8 | Hash chain links AV callback to same transaction | PASS |
| 9 | Middleware: 402 on HARD_DECLINE, 409 on COOLDOWN | PASS |
| 10 | Middleware: 400 on malformed input | PASS |
| 11 | Middleware: header fallback for missing body fields | PASS |
| 12 | `yarn typecheck` | PASS (0 errors) |
| 13 | `yarn typecheck:api` | PASS |
| 14 | `yarn lint` | PASS (0 warnings, --max-warnings 0) |
| 15 | `yarn test` — GateGuard suites | 50/50 PASS |

Note: one pre-existing failure in `tests/integration/ledger-service.spec.ts`
(`TokenType.REGULAR` was removed by an earlier token-retirement commit —
unrelated to this payload).

## HANDOFF

- **Built:** GateGuardService pre-processor, Welfare Guardian scorer,
  middleware, 50 unit+integration tests, NATS topics, Prisma models,
  SHA-256 hash chain.
- **Left incomplete:**
  - AV provider signature verification is a stub — `onAvResult()` trusts
    the `providerSignatureId` field; a real provider adapter (KYC-vault,
    Stripe Identity, Onfido) must verify the signature before calling
    the service.
  - Federated intelligence adapter is a stub — `requestFederatedLookup()`
    fires a NATS event; a subscriber that populates the federation list
    has not been implemented in this payload.
  - Cyrano / Flicker n'Flame Scoring welfare-signal consumption is downstream of the
    `gateguard.welfare.signal` topic — that consumer lives in PAYLOAD 4.
  - Prisma migration SQL (`prisma/migrations/*/migration.sql`) is not
    generated here — run `yarn prisma:generate && yarn prisma:push` in a
    dev environment to create the tables; the schema.prisma change is
    the authoritative source.
- **Next agent's first task:** Author the AV provider adapter (Stripe
  Identity or equivalent) that verifies signed callbacks and invokes
  `GateGuardService.onAvResult()`.

## Reply Token

`## GATEGUARD PAYLOAD COMPLETE`
