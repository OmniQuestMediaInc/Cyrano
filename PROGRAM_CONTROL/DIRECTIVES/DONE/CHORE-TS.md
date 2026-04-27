### DIRECTIVE: CHORE-TS

**Status:** `[x] IN_PROGRESS`
**Commit prefix:** `CHORE:`
**Target path:** Multiple (see below)
**Risk class:** R0
**Gate:** All Tier 6 directives on main.

**Context:**
13 pre-existing TypeScript errors confirmed before v4. Not introduced by any
v4 directive. Two categories:
- 6x snake_case Prisma accessor mismatches (ledger_entries, audit_events, etc.)
- 1x user_risk_profiles accessor mismatch
- 6x TypeORM getRepository(string) type mismatches

**Task:**
Resolve all 13 errors. Zero new errors permitted.
Run `npx tsc --noEmit` before and after — output must go from 13 errors to 0.

**Validation:**
- [ ] npx tsc --noEmit output: 0 errors
- [ ] No source logic changed — types and accessors only
- [ ] All Prisma accessors use camelCase (Prisma client convention)

**Report-back file:** `PROGRAM_CONTROL/REPORT_BACK/CHORE-TS-CLEANUP.md`
Required: before/after tsc output, list of files modified.
