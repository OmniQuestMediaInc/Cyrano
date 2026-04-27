# TOK-006-FOLLOWUP — Report Back

## Branch
`fiz/tok-006-followup`

## HEAD Commit Hash
_(to be updated after commit)_

## Files Created
- `PROGRAM_CONTROL/REPORT_BACK/TOK-006-FOLLOWUP-REPORT-BACK.md` (this file)

## Files Modified
- `services/core-api/src/finance/ledger.service.ts`
  - Imported `TokenOrigin` from `./types/ledger.types` and re-exported it for consumers
  - Added `tokenOrigin: TokenOrigin` as a required parameter on `recordEntry`
  - Persisted `token_origin: data.tokenOrigin` on every `ledgerRepo.create()` call
  - Added private `bucketToOrigin(bucket: WalletBucket): TokenOrigin` helper
    - `WalletBucket.PURCHASED` → `TokenOrigin.PURCHASED`
    - `WalletBucket.PROMOTIONAL_BONUS` → `TokenOrigin.GIFTED`
    - `WalletBucket.MEMBERSHIP_ALLOCATION` → `TokenOrigin.GIFTED`
  - Updated the internal `recordEntry` call inside `debitWallet` to pass `tokenOrigin: this.bucketToOrigin(bucket)`

- `prisma/schema.prisma`
  - `TokenBalance.token_origin`: changed from `String? @default("PURCHASED")` to `String @default("PURCHASED")`
  - Field is now non-nullable; `@default("PURCHASED")` retained for existing rows

- `tests/integration/ledger-service.spec.ts`
  - Added `TokenOrigin` to import from `ledger.service`
  - Updated all 11 `recordEntry` call sites to include `tokenOrigin: TokenOrigin.PURCHASED`
    (all test calls are top-up / purchase credit operations → PURCHASED is correct)

## Files Confirmed Unchanged
- `services/nats/topics.registry.ts` — no changes required
- `services/core-api/src/governance/governance.config.ts` — no changes required
- `services/core-api/src/finance/types/ledger.types.ts` — `TokenOrigin` enum pre-existing; no changes
- `services/core-api/src/finance/tip.service.ts` — calls `recordSplitTip`, not `recordEntry` directly
- `services/core-api/src/growth/gwp.service.ts` — comment only ("Caller must post ledger credit…"); no direct `recordEntry` call
- `services/core-api/src/games/games.controller.ts` — comment only; no direct `recordEntry` call
- `services/core-api/src/compliance/reconciliation.service.ts` — read-only; no `recordEntry` calls

## Call Sites Updated

| File | Line | Context | TokenOrigin Assigned |
|------|------|---------|---------------------|
| `ledger.service.ts` | `debitWallet` internal | PROMOTIONAL_BONUS bucket debit | `GIFTED` (platform grant) |
| `ledger.service.ts` | `debitWallet` internal | MEMBERSHIP_ALLOCATION bucket debit | `GIFTED` (platform/membership allocation) |
| `ledger.service.ts` | `debitWallet` internal | PURCHASED bucket debit | `PURCHASED` (user-bought tokens) |
| `ledger-service.spec.ts` | test: records valid entry | TOPUP credit | `PURCHASED` |
| `ledger-service.spec.ts` | test: rejects non-BigInt | TOPUP credit | `PURCHASED` |
| `ledger-service.spec.ts` | test: idempotency (×2 calls) | TOPUP credit | `PURCHASED` |
| `ledger-service.spec.ts` | test: defaults rule_applied_id | TOPUP credit | `PURCHASED` |
| `ledger-service.spec.ts` | test: seed CSV transactions | TIP credit (customer pays) | `PURCHASED` |
| `ledger-service.spec.ts` | test: getBalance (200n, 50n, -30n) | TOPUP/SPEND | `PURCHASED` |
| `ledger-service.spec.ts` | test: isolates by token type (×2) | TOPUP credits | `PURCHASED` |
| `ledger-service.spec.ts` | test: Ghost Alpha scenario top-up | TOPUP credit | `PURCHASED` |

## Ambiguous Call Sites Flagged

**`debitWallet` internal call — MEMBERSHIP_ALLOCATION bucket**

The `MEMBERSHIP_ALLOCATION` bucket could be interpreted as either:
- `GIFTED` — tokens allocated by the platform as part of a membership benefit (not purchased directly)
- Ambiguous if a user purchases a membership tier that includes token allocation

**Reasoning for GIFTED assignment:** The OQMI doctrine and the TokenOrigin definition state PURCHASED means "guest bought tokens with real money" and GIFTED means "tokens granted by platform, promotion, or transfer." Membership allocations are granted by the platform as part of a membership benefit package, even if the membership itself was paid. The token grant within the membership is a platform allocation → GIFTED. This mirrors the spend-priority ordering (PROMOTIONAL_BONUS and MEMBERSHIP_ALLOCATION are consumed before PURCHASED tokens, reflecting their non-purchased nature).

## GovernanceConfig Constants Used
- None directly in this directive's changes (no GovernanceConfig changes required)

## NATS Topic Constants Used
- None (no new publish calls introduced)

## Prisma Schema
- `token_origin` on `TokenBalance` changed from nullable (`String?`) to non-nullable (`String @default("PURCHASED")`)
- `prisma generate` ran successfully — Prisma Client regenerated
- No migration generated (schema only, per directive)

## 15 Invariants — Confirmed

1. **No REFACTORING** — ✅ Only `recordEntry` signature and `debitWallet` internal call modified; no logic refactored
2. **APPEND-ONLY FINANCE** — ✅ No UPDATE or DELETE introduced; all writes are append-only via `save()`
3. **SCHEMA INTEGRITY** — ✅ `token_origin` non-nullable; `correlation_id` and `reason_code` untouched
4. **NETWORK ISOLATION** — ✅ No Postgres/Redis port changes
5. **SECRET MANAGEMENT** — ✅ No credentials introduced
6. **LATENCY INVARIANT** — ✅ No REST polling added; no NATS changes
7. **No hardcoded token_origin strings** — ✅ `TokenOrigin` enum used exclusively; no string literals
8. **Logger present** — ✅ `LedgerService` has `private readonly logger = new Logger(LedgerService.name)` (pre-existing)
9. **rule_applied_id present** — ✅ Persisted in `metadata.rule_applied_id` on every entry (pre-existing)
10. **organization_id + tenant_id** — ✅ Not removed from any Prisma writes
11. **NATS_TOPICS.* constants** — ✅ Not applicable (no new NATS publishes added)
12. **Multi-tenant mandate** — ✅ `organization_id` + `tenant_id` untouched in all Prisma models
13. **DROID MODE** — ✅ Executed as written, no creative deviation
14. **No UPDATE on balance columns** — ✅ Append-only; no UPDATE calls introduced
15. **TokenOrigin enum only** — ✅ `TokenOrigin.PURCHASED` and `TokenOrigin.GIFTED` enum values used; no raw strings

## npx tsc --noEmit

Baseline (before changes): **0 errors**
After changes: **0 errors**

Zero new TypeScript errors introduced.

## git diff --stat

```
prisma/schema.prisma                            |  2 +-
services/core-api/src/finance/ledger.service.ts | 17 +++++++++++++++++
tests/integration/ledger-service.spec.ts        | 18 +++++++++++++-----
3 files changed, 31 insertions(+), 6 deletions(-)
```

## Result

**SUCCESS**

Rule: TOK-006-FOLLOWUP
Authority: Kevin B. Hartley, CEO — OmniQuest Media Inc.
