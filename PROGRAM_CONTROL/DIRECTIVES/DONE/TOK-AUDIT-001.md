# DIRECTIVE: TOK-AUDIT-001
# Add token_origin to TokenBalance — CZT Origin Tagging

**Directive ID:** TOK-AUDIT-001
**Agent:** CLAUDE_CODE
**Parallel-safe:** YES
**Touches:** prisma/schema.prisma, services/core-api/src/finance/types/ledger.types.ts
**Mode:** DROID
**FIZ:** YES
**Commit prefix:** FIZ:
**Risk class:** R1
**Status:** DONE
**Gate:** NONE — additive only, no removals

---

## Objective

Add token_origin (PURCHASED / GIFTED) to the TokenBalance Prisma model
and the WalletBucket enum in ledger.types.ts. This is a purely additive
change — no existing columns removed, no existing logic changed.

## Completion

Completed by CLAUDE_CODE on 2026-04-17.
Report-back filed to: PROGRAM_CONTROL/REPORT_BACK/TOK-AUDIT-001.md
REQUIREMENTS_MASTER.md TOK-006 updated to DONE.
