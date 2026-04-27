# Report Back: Fix Conflicting transactions Table Definition

**Branch:** `copilot/fix-transactions-table-conflict`
**HEAD commit (after fix):** see `git log --oneline -1`

## Problem

`infra/postgres/init-ledger.sql` contained leftover duplicate comment lines in the
`transactions` table header block — remnants of a previously removed first
`CREATE TABLE transactions` definition (which had `sender_id`/`receiver_id` columns
incompatible with the `idx_transactions_user_id` index).

The leftover lines were:
```
-- PURPOSE: Tracks every single movement of value between users.
-- MUTATION POLICY: INSERT ONLY. No UPDATE. No DELETE. Ever.
```

These made the comment block misleading (two `PURPOSE` and two `MUTATION POLICY`
entries) and were inconsistent with the actual table definition. The CI validate-schema
job was also previously failing for this branch due to two conflicting `CREATE TABLE`
statements (the first definition was removed in the base merge).

## Fix Applied

Removed the two duplicate/leftover comment lines from the `transactions` table header
(lines 237–238 in the original file), leaving a single, accurate comment block with one
`PURPOSE` and one `MUTATION POLICY` entry.

## Files Changed

```
infra/postgres/init-ledger.sql | 2 --
1 file changed, 2 deletions(-)
```

## Verification

SQL schema applied to `postgres:16` with `psql -v ON_ERROR_STOP=1`:

```
CREATE EXTENSION
CREATE TABLE      ← user_risk_profiles
CREATE TABLE      ← studio_contracts
CREATE TABLE      ← ledger_entries (with append-only triggers)
CREATE TABLE      ← transactions (single definition, user_id present)
CREATE INDEX      ← idx_transactions_user_id  ✅
CREATE INDEX      ← idx_transactions_performer_id  ✅
CREATE INDEX      ← idx_transactions_status  ✅
CREATE INDEX      ← idx_transactions_created_at  ✅
CREATE FUNCTION / CREATE TRIGGER (block mutation + updated_at)  ✅
✅ SQL applied successfully
```

Only **one** `CREATE TABLE transactions` definition remains. All indexes reference
valid columns. Append-only enforcement triggers are intact.

## Result

✅ SUCCESS
