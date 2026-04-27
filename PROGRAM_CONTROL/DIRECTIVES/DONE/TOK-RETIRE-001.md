# DIRECTIVE: TOK-RETIRE-001
# Retire ShowToken Types and Update Payout Logic to Flicker n'Flame Scoring Rates

**Directive ID:** TOK-RETIRE-001
**Agent:** CLAUDE_CODE
**Parallel-safe:** NO
**Touches:** services/core-api/src/finance/ledger.service.ts, services/core-api/src/config/governance.config.ts, services/bijou/src/pass-pricing.service.ts, services/showzone/src/room-session.service.ts
**Mode:** DROID
**FIZ:** YES
**Commit prefix:** FIZ:
**Risk class:** R1
**Status:** DONE
**Gate:** PAY-RATES-001 on main — CONFIRMED (#240 merged)

---

## Objective

Retire `TokenType.SHOW_THEATER` and `TokenType.BIJOU`; collapse `TokenType` to CZT-only. Replace binary `SHOW_THEATER`/`REGULAR` payout rate split with Flicker n'Flame Scoring rate resolver. Remove `PAYOUT_RATE_SHOWTHEATER`/`PAYOUT_RATE_REGULAR` and `SHOWTOKEN_EXCHANGE` block. Rename `ST_` field names to `CZT_` in `SHOWZONE_PRICING` and `BIJOU_PRICING`. Update dependent services.

---

## Scope

### Files Modified
- `services/core-api/src/finance/ledger.service.ts` — `TokenType` collapsed to `{ CZT = 'CZT' }`; `resolvePayoutRate` helper added; `recordEntry` interface extended with optional `heatScore?` and `diamondFloorActive?`; imports added (`Decimal`, `GovernanceConfig`).
- `services/core-api/src/config/governance.config.ts` — `PAYOUT_RATE_SHOWTHEATER` and `PAYOUT_RATE_REGULAR` removed from `GovernanceConfigService`; `SHOWTOKEN_EXCHANGE` block removed; `SHOWZONE_PRICING` and `BIJOU_PRICING` `ST_` fields renamed to `CZT_`.
- `services/bijou/src/pass-pricing.service.ts` — field references updated to `CZT_` names.
- `services/showzone/src/room-session.service.ts` — single field reference `PAYOUT_RATE_PER_ST` → `PAYOUT_RATE_PER_CZT` (required to satisfy tsc `zero new errors` invariant after `governance.config.ts` rename).

### Definition of Done

- [x] `TokenType` enum = `{ CZT = 'CZT' }` only
- [x] `PAYOUT_RATE_SHOWTHEATER` removed from `GovernanceConfigService`
- [x] `PAYOUT_RATE_REGULAR` removed from `GovernanceConfigService`
- [x] `SHOWTOKEN_EXCHANGE` const block removed
- [x] `SHOWZONE_PRICING` `ST_` fields renamed to `CZT_`
- [x] `BIJOU_PRICING` `ST_` fields renamed to `CZT_`
- [x] `pass-pricing.service.ts` updated to `CZT_` field references
- [x] `resolvePayoutRate` helper added to `LedgerService`
- [x] `heatScore?` and `diamondFloorActive?` added to `recordEntry` interface
- [x] `npx tsc --noEmit` clean — zero new errors
- [x] Report-back filed
- [x] `docs/REQUIREMENTS_MASTER.md` TOK-001/002/003/004 + PAY-013 updated to DONE
