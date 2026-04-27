# Report Back: ENFORCE FINANCIAL SCHEMA INTEGRITY
# Doctrine: OQMI Financial Invariants (R2)

## Branch
`copilot/enforce-financial-schema-integrity`

## HEAD
`369bd07`

## Files Changed
```
infra/postgres/init-ledger.sql | 6 +++---
1 file changed, 3 insertions(+), 3 deletions(-)
```

## Change Summary
Added `NOT NULL` constraint to all three split amount columns in `ledger_entries`.
This enforces OQMI Financial Invariant R2: no NULL values can enter the split calculation logic.

### Diff
```diff
-    studio_amount_cents    BIGINT   DEFAULT 0,
-    performer_amount_cents BIGINT   DEFAULT 0,
-    platform_amount_cents  BIGINT   DEFAULT 0,
+    studio_amount_cents    BIGINT   NOT NULL DEFAULT 0,
+    performer_amount_cents BIGINT   NOT NULL DEFAULT 0,
+    platform_amount_cents  BIGINT   NOT NULL DEFAULT 0,
```

## Verification
All three amount columns now have `NOT NULL DEFAULT 0`:
- `studio_amount_cents    BIGINT NOT NULL DEFAULT 0` ✅
- `performer_amount_cents BIGINT NOT NULL DEFAULT 0` ✅
- `platform_amount_cents  BIGINT NOT NULL DEFAULT 0` ✅

## Scope
- No other tables modified.
- Existing schema structure, triggers, indexes, and constraints are unchanged.
- The full append-only trigger infrastructure (`trg_ledger_entries_no_update`, `trg_ledger_entries_no_delete`) is preserved.

## Result
✅ SUCCESS
