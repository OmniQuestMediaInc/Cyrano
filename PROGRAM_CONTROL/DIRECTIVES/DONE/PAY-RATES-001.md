# DIRECTIVE: PAY-RATES-001
# Add Flicker n'Flame Scoring Payout Rate Constants to GovernanceConfig

**Directive ID:** PAY-RATES-001
**Agent:** CLAUDE_CODE
**Parallel-safe:** YES
**Touches:** services/core-api/src/governance/governance.config.ts
**Mode:** DROID
**FIZ:** YES
**Commit prefix:** FIZ:
**Risk class:** R1
**Status:** DONE
**Gate:** NONE — additive only

---

## Objective

Add the five locked Flicker n'Flame Scoring payout rate constants + three heat band
boundaries to `services/core-api/src/governance/governance.config.ts`.
Locked by CEO 2026-04-16. Not operator-configurable.

---

## Scope

### File Modified
- `services/core-api/src/governance/governance.config.ts`

### Definition of Done

- [x] `RATE_COLD: new Decimal('0.075')` added
- [x] `RATE_WARM: new Decimal('0.080')` added
- [x] `RATE_HOT: new Decimal('0.085')` added
- [x] `RATE_INFERNO: new Decimal('0.090')` added
- [x] `RATE_DIAMOND_FLOOR: new Decimal('0.080')` added
- [x] `HEAT_BAND_COLD_MAX: 33`
- [x] `HEAT_BAND_WARM_MAX: 60`
- [x] `HEAT_BAND_HOT_MAX: 85`
- [x] No existing constants modified
- [x] `npx tsc --noEmit` clean (zero new errors vs baseline)
- [x] Report-back filed to `PROGRAM_CONTROL/REPORT_BACK/PAY-RATES-001.md`
- [x] `docs/REQUIREMENTS_MASTER.md` PAY-001..PAY-005 updated to DONE
