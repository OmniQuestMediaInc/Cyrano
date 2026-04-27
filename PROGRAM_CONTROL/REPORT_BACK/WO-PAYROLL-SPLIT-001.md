# WO: INSTALL PAYROLL SPLITTER LOGIC

## Branch
`copilot/implement-payroll-split-logic`

## HEAD
`bb322c1`

## Files Changed
```
PROGRAM_CONTROL/REPORT_BACK/WO-PAYROLL-SPLIT-001.md |  59 +++++++++++++++++
services/core-api/src/db.ts                         |  10 +++
services/core-api/src/finance/ledger.module.ts      |  11 +++
services/core-api/src/finance/ledger.service.ts     |  55 ++++++++++++++++
4 files changed, 135 insertions(+)
```

## Commands Run + Verbatim Outputs

```
$ git log --oneline -6
d4670b3 fix: address d1faf7b review — PrismaService injection, TipTransaction type, date-bounded contract lookup, performer_id/studio_id/contract_id on ledger entry, WO headers, Files Changed fix
d1faf7b Merge branch 'main' into copilot/implement-payroll-split-logic
6678016 fix(governance): add // WO: WO-INIT-001 header to all new services/ TS files
6979b64 fix(statements): add ParseUUIDPipe to studioId/creatorId params for 400 on invalid UUIDs
49ff476 fix(statements): use new StatementsDenyAllGuard() instance to guarantee guard is applied
9aa8363 fix(statements): replace beneficiary_id with studio_id/performer_id per ledger schema

$ git diff --stat d1faf7b HEAD
 PROGRAM_CONTROL/REPORT_BACK/WO-PAYROLL-SPLIT-001.md |  17 +++---
 services/core-api/src/db.ts                         |   2 +-
 services/core-api/src/finance/ledger.module.ts      |   3 +-
 services/core-api/src/finance/ledger.service.ts     |  38 ++++++++++++------
 4 files changed, 42 insertions(+), 18 deletions(-)
```

## Changes Applied

### `services/core-api/src/db.ts`
Prisma singleton client — reuse the same `PrismaClient` instance across the process to prevent connection pool exhaustion. Added `// WO: WO-PAYROLL-SPLIT-001` governance header.

### `services/core-api/src/finance/ledger.service.ts`
- `@Injectable()` NestJS decorator with `PrismaService` constructor injection (no dual-pool risk)
- `REGULAR_PAYOUT_RATE = 0.065` and `VIP_PAYOUT_RATE = 0.080` rate constants
- Uses shared `TipTransaction` type from `ledger.types.ts` (no inline type duplication)
- `processSplitTransaction`: resolves studio contract filtered by `performer_id`, `status: 'ACTIVE'`, `effective_date ≤ today`, `expiry_date ≥ today OR null`, ordered by `effective_date DESC`
- Split calculation uses `Math.round` for reproducible cent values; performer receives the integer remainder to prevent floating-point accumulation
- Atomic `$transaction([ledger_entries.create(...)])` INSERT with `entry_type: 'CHARGE'`; `performer_id`, `studio_id`, `contract_id` populated from resolved contract

### `services/core-api/src/finance/ledger.module.ts`
NestJS `LedgerModule` providing both `PrismaService` and `LedgerService`; exports `LedgerService`. Added `// WO: WO-PAYROLL-SPLIT-001` governance header.

## Doctrine Compliance

| Invariant | Status |
|---|---|
| Append-Only Ledger | ✅ `this.db.$transaction([this.db.ledger_entries.create(...)])` — INSERT only, no UPDATE/DELETE |
| Deterministic Logic | ✅ Split calculation is deterministic: same inputs → same outputs; `Math.round` for reproducible cent values |
| Atomic Write | ✅ Wrapped in `this.db.$transaction([...])` |
| No Secrets / PII | ✅ No credentials or PII logged |

## Result
✅ SUCCESS
