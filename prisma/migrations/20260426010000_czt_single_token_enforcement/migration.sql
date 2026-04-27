-- Migration: 20260426010000_czt_single_token_enforcement
-- CHORE: Add token_type to wallet_ledger_entries (CZT single-token economy enforcement)

-- Add token_type column to wallet_ledger_entries (single-token economy enforcement)
-- Default is 'CZT' — enforced at DB layer via CHECK constraint
ALTER TABLE "wallet_ledger_entries"
  ADD COLUMN IF NOT EXISTS "token_type" VARCHAR(10) NOT NULL DEFAULT 'CZT';

-- Enforce CZT as the only allowed value at the DB layer
ALTER TABLE "wallet_ledger_entries"
  ADD CONSTRAINT "wallet_ledger_entries_token_type_czt_only"
  CHECK ("token_type" = 'CZT');

-- Add index on token_type for audit queries
CREATE INDEX IF NOT EXISTS "wallet_ledger_entries_token_type_idx"
  ON "wallet_ledger_entries" ("token_type");
