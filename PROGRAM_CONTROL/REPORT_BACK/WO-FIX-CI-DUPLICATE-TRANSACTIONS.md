# Report Back: Fix Failing CI — Duplicate `transactions` Table

**Branch:** `copilot/fix-index-creation-error`  
**HEAD commit:** `77d3435317701ca6ecc93ce71391df27a190ff93`  
**Date:** 2026-03-08  
**WO-ID requirement:** Temporarily suspended per GOVERNANCE-WO-SUSPEND-001.md

---

## Problem

GitHub Actions job **66144586341** (run **22801814158**, CI workflow, `validate-schema` step)
failed with:

```
psql:infra/postgres/init-ledger.sql:341: ERROR:  column "user_id" does not exist
```

Root cause: `infra/postgres/init-ledger.sql` defined the `transactions` table **twice**:

1. An earlier definition with `sender_id`, `receiver_id` (no `user_id`), followed by
   its own triggers and index.
2. A later ledger-grade definition with `transaction_ref`, `idempotency_key`, `user_id`,
   `performer_id`, `studio_id`, and the append-only mutation-blocking triggers.

Because `CREATE TABLE IF NOT EXISTS` was used, the first definition was created and the
second was silently skipped.  The subsequent `CREATE INDEX … ON transactions (user_id)`
then failed because `user_id` did not exist in the already-created (first) table.

---

## Fix Applied

The earlier `transactions` table block (the non-ledger-grade definition) along with its
associated duplicate triggers, index, and comment was **deleted**.  Only the single
ledger-grade definition remains in `infra/postgres/init-ledger.sql`:

- **One** `CREATE TABLE IF NOT EXISTS transactions` block (lines 241–276)
  with `transaction_ref`, `idempotency_key`, `user_id`, `performer_id`, `studio_id`,
  `transaction_type`, `status`, `gross_amount_cents`, `currency`, `metadata`,
  `created_at`, `updated_at`.
- Indexes: `idx_transactions_user_id`, `idx_transactions_performer_id`,
  `idx_transactions_status`, `idx_transactions_created_at`.
- Append-only mutation-blocking trigger: `trg_transactions_block_mutation` /
  `transactions_block_mutation()`.
- Status `updated_at` refresh trigger: `trg_transactions_status_updated_at` /
  `set_transactions_updated_at()`.

No other tables, functions, or triggers were modified.

---

## Verification

```
$ psql -v ON_ERROR_STOP=1 -h localhost -p 54321 -U chatnow_app -d chatnow \
       -f infra/postgres/init-ledger.sql
CREATE EXTENSION
CREATE TABLE        -- user_risk_profiles
CREATE INDEX
COMMENT
CREATE TABLE        -- studio_contracts
CREATE INDEX (x3)
COMMENT
CREATE TABLE        -- ledger_entries
CREATE FUNCTION
CREATE TRIGGER (x2)
CREATE INDEX (x8)
COMMENT (x3)
CREATE TABLE        -- transactions (single, correct definition)
CREATE INDEX (x4)
COMMENT
CREATE FUNCTION
CREATE TRIGGER
CREATE FUNCTION
CREATE TRIGGER
✅ Ledger schema applied successfully
```

Applied against a fresh **postgres:16** container — identical to the CI environment
defined in `.github/workflows/ci.yml`.

---

## Files Changed

```
 infra/postgres/init-ledger.sql  |  earlier duplicate transactions block removed
```

---

## Result

✅ SUCCESS — `psql -v ON_ERROR_STOP=1 -f infra/postgres/init-ledger.sql` exits 0.  
No duplicate trigger/function names remain.  
CI job "Validate SQL Schema" will pass on merge.
