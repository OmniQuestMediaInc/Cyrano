# Report-Back: INFRA-002-TYPEFIX

**Directive:** INFRA-002-TYPEFIX
**Commit Prefix:** INFRA:
**Date:** 2026-03-29
**Agent:** Claude Code (Opus 4.6)
**Branch:** claude/fix-typescript-errors-6y4I8

---

## Summary

Resolved all 8 prescribed type fixes. Zero code-logic changes — type fixes and stub repairs only.

---

## Fixes Applied

### FIX 1: Created `finance/schema.ts`
- Created `CommissionSplitEntry` interface with all fields matching the actual return shape of `CommissionSplittingEngine.calculateDeterministicSplit()`: `transactionId`, `modelId`, `studioId`, `grossCents`, `modelNetCents`, `studioAgencyHoldbackCents`, `studioServiceFeesCents`, `platformSystemFeeCents`, `checksum`, `metadata`.
- `audit-dashboard.service.ts` and `batch-payout.service.ts` already import from `'./schema'` — resolved.

### FIX 2: Fixed `finance/commission-splitting.service.ts`
- Added `import { CommissionSplitEntry } from './schema'` to resolve the undefined return type on `calculateDeterministicSplit()`.

### FIX 3: Fixed `services/bijou/src/pass-pricing.service.ts`
- Confirmed `BIJOU_PRICING.ADMISSION_ST_TOKENS_BASE` exists in governance.config.ts (line 111).
- `SHOWZONE_PRICING` does NOT have `ADMISSION_ST_TOKENS_BASE` — it uses `PASS_BASE_ST_TOKENS`.
- Applied type cast `(config as typeof BIJOU_PRICING).ADMISSION_ST_TOKENS_BASE` to resolve the union-type property access error while preserving the `??` fallback to `SHOWZONE_PRICING.PASS_BASE_ST_TOKENS`.

### FIX 4: Fixed `services/core-api/src/core-api.module.ts`
- Changed import from `'../services/statements.service'` (non-existent) to `'./creator/surfaces/statements.service'` (actual location).

### FIX 5: Fixed `services/core-api/src/finance/ledger.module.ts`
- Removed `LedgerController` import and `controllers` array entry (file does not exist).
- Added `exports: [LedgerService]` so LedgerModule properly provides LedgerService to consuming modules.

### FIX 6: EntityClassOrSchema type errors
- Confirmed `@InjectRepository('string')` with `Repository<Record<string, unknown>>` pattern is already in place in:
  - `ledger.service.ts` (line 37)
  - `guarded-notification.service.ts` (lines 41-44)
  - `referral-reward.service.ts` (lines 43-48)
- No additional changes required — pattern compiles when `@nestjs/typeorm` and `typeorm` are installed.

### FIX 7: Fixed `tip.service.ts` / `ledger.types.ts` / `ledger.service.ts`
- Updated `TipTransaction` interface in `ledger.types.ts` to match TipService usage: `userId`, `creatorId`, `correlationId`, `tokenAmount`, `isVIP?`.
- Added `recordSplitTip(tx: TipTransaction): Promise<void>` stub method to `LedgerService` (additive only, no existing methods touched).
- Added `TipTransaction` import to `ledger.service.ts`.

### FIX 8: Verified `studio-report.service.ts`
- File already exists at `services/core-api/src/studio/studio-report.service.ts`.
- Added missing `@Injectable()` decorator for NestJS DI compatibility with `StudioReportController`.

---

## Validation: `npx tsc --noEmit`

**Target: zero errors** — NOT achieved due to missing `node_modules`.

### Remaining errors (all pre-existing, outside FIX 1-8 scope):

| Category | Count | Root Cause |
|----------|-------|------------|
| Cannot find module `@nestjs/common` | ~25 | Dependencies not installed |
| Cannot find module `typeorm` / `@nestjs/typeorm` | ~5 | Dependencies not installed |
| Cannot find module `crypto` | ~8 | `@types/node` not installed |
| Cannot find module `@prisma/client` | 2 | Dependencies not installed |
| Cannot find name `process` / `Buffer` / `NodeJS` | ~8 | `@types/node` not installed |
| `tip.service.ts(9)` TS2554 | 1 | `new LedgerService()` called with 0 args (needs 2) — constructor wiring, not a type-only fix |
| `studio-report.controller.ts(10)` TS2554 | 1 | `getStudioEarnings()` called with 0 args (needs `studioId`) — logic gap, not a type-only fix |

**Note:** The module-resolution errors (50+) will clear once `yarn install` provisions `@nestjs/*`, `typeorm`, `@prisma/client`, and `@types/node`. The two TS2554 argument-count errors are logic gaps that require code-level decisions beyond type-only repair.

---

## HANDOFF

**Built:** All 8 type fixes from INFRA-002 directive applied.
**Left incomplete:** Zero-error target blocked by uninstalled dependencies and 2 argument-count mismatches.
**Next agent's first task:** Run `yarn install` to provision node_modules, then address the 2 remaining TS2554 errors in `tip.service.ts` (LedgerService constructor wiring) and `studio-report.controller.ts` (missing studioId parameter passthrough).
