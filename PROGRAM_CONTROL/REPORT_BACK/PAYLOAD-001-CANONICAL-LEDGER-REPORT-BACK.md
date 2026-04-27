# PAYLOAD 1 — Canonical Financial Ledger + Three-Bucket Wallets + REDBOOK Rate Cards

**Branch:** `claude/financial-ledger-wallets-FrUdF`
**Authority:** OQMI_GOVERNANCE.md + Canonical Corpus v10 + REDBOOK + Business Plan v2.8
**Status:** IMPLEMENTED — 41 new tests passing, zero regressions in new module. Legacy `tests/integration/ledger-service.spec.ts` typecheck failures are pre-existing (confirmed via `git stash`) and are untouched by this payload.

## Summary

Delivered a new canonical `services/ledger/` module housing a three-bucket wallet + hash-chained append-only ledger, REDBOOK rate-card resolver, Flicker n'Flame Scoring payout hook, and Unified-CS Recovery Engine. The legacy `services/core-api/src/finance/ledger.service.ts` is preserved; the two layers coexist intentionally until a follow-up core-api wiring branch migrates consumers.

## Deliverables

### Prisma + Migration

- `prisma/schema.prisma` — four new Prisma models:
  - `CanonicalWallet`     → `wallets`
  - `CanonicalLedgerEntry` → `wallet_ledger_entries` (append-only, hash-chained)
  - `CanonicalTokenExpiration` → `token_expirations`
  - `CanonicalRateCard` → `rate_cards`
- Model names are prefixed `Canonical*` to avoid collision with the legacy `LedgerEntry` (payment-gateway oriented); table names match the directive verbatim.
- `prisma/migrations/20260424000000_add_canonical_financial_ledger/migration.sql`:
  - Creates the four tables + FK + indexes.
  - CHECK constraint: `wallets` bucket columns cannot go negative.
  - Triggers: reject `UPDATE` / `DELETE` on `wallet_ledger_entries` (append-only enforcement at the DB boundary).

### Governance Constants (no hardcoded prices anywhere in services)

`services/core-api/src/config/governance.config.ts`:
- `REDBOOK_RATE_CARDS` — Tease Regular bundle table (150/500/1 000/5 000/10 000), ShowZone Premium (300/1 000), Diamond Floor min/max, VIP baseline.
- `RECOVERY_ENGINE` — 14-day Diamond expiry, 48-hour warning window, $49 extension, $79 recovery, 70/30 redistribution, 20% Token Bridge, 60% 3/5ths Exit + 24-hour lock.
- `LEDGER_SPEND_ORDER` — canonical spend authority: `['purchased', 'membership', 'bonus']`. Compile-time guarded against drift.

### services/ledger/ module

- `types.ts` — bucket enum, reason-code union, rate-card tiers, heat levels, recovery action set, stable `LedgerError` + subclasses.
- `repository.ts` — `LedgerRepository` interface + `InMemoryLedgerRepository` for tests. Production Prisma adapter lives alongside in the follow-up wiring branch.
- `redbook-rate-card.service.ts` — Tease Regular / ShowZone / Diamond quotes + `resolveCreatorPayoutRate` honouring the Diamond floor.
- `ledger.service.ts` — three-bucket spend (governance-sourced order), idempotent `record()` / `credit()` / `spend()`, SHA-256 hash chain with `verifyChain()` audit. `HANDOFF` block at file bottom.
- `payout.service.ts` — `settleSessionClose()` for Flicker n'Flame Scoring-scored session payouts (credits creator `bonus` bucket, stamps rate in entry metadata).
- `recovery.service.ts` — `findExpirationsNeedingWarning`, `extendExpiration`, `recoverExpiration`, `tokenBridge`, `threeFifthsExit`, `redistributeExpired`.
- `index.ts` — barrel export.

### Tests (`tests/integration/`)

- `canonical-ledger.spec.ts` — 17 tests: spend order across all permutations, idempotent replay, hash chain continuity + tamper detection, input validation.
- `redbook-rate-card.spec.ts` — 14 tests: guest/member Tease pricing, ShowZone bundles, Diamond volume + velocity brackets, Flicker n'Flame Scoring rate bands, Diamond floor interaction.
- `recovery-engine.spec.ts` — 10 tests: 48-hour warning, extension fee + window, Token Bridge 20% + idempotency, 3/5ths Exit refund + lock, 70/30 redistribution.
- Total: **41 new tests, all green.**

## Invariants Satisfied

1. **Append-only** — `wallet_ledger_entries` UPDATE/DELETE rejected by DB trigger; service never mutates prior entries.
2. **Deterministic** — hash chain is sha-256 over canonical-sorted JSON; `verifyChain()` re-derives + asserts.
3. **Idempotent** — every public mutation carries a `correlationId`; replays return the prior result, diverging payloads raise `IdempotencyReplayError`.
4. **Three-bucket enforcement** — all debits flow through `LedgerService.spend()` which consumes `LEDGER_SPEND_ORDER` from governance config. Buckets are non-negative at the DB layer.
5. **No hardcoded prices** — every fee, percentage, window, and bundle price resolves through `governance.config`. A `FIZ: commit` on that file is the only change surface.

## Known Deltas & Follow-ups

- **Spend order divergence (INTENTIONAL, per directive):** this payload's order is `purchased → membership → bonus` (directive-literal), which is the reverse of legacy FIZ-003 (`PROMOTIONAL_BONUS → MEMBERSHIP → PURCHASED`). The two services coexist; consumer cutover is a separate branch.
- **Legacy test failure** (`tests/integration/ledger-service.spec.ts`) is pre-existing and references a retired `TokenType.REGULAR` / `TokenType.BIJOU` — verified via `git stash` that it fails on `main` without this payload.
- **Extension/Recovery markers** write a 1-token placeholder to carry fee + policy metadata into the append-only log. When the production Prisma adapter lands, replace the marker with a metadata-only entry via a typed `operation_kind` column.
- **Prisma migration:** not auto-run in this branch (no DATABASE_URL in the agent environment); the SQL file is shipped and ready to be applied by the standard CI migration step. No schema change requires the agent to run `prisma migrate dev`.

## HANDOFF

Three-bucket enforcement: **locked** (sourced from `LEDGER_SPEND_ORDER`, verified by tests + compile-time constant alignment).
Next priority: **RedBook Dashboard** (admin read surface for wallet state, expirations, rate-card overrides) → **GateGuard** (REST policy layer over LedgerService + RecoveryService).
