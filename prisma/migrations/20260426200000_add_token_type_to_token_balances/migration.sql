-- FIZ: Add token_type to token_balances — enforce single CZT token economy
-- REASON: CNZ-WORK-001 Section 2 — enforce that only CZT tokens can be stored
--         in the token_balances table; prevents non-CZT token types from being
--         written to the ledger either accidentally or via a rogue code path.
-- IMPACT: Adds a NOT NULL column with default 'CZT' (safe — no existing rows
--         need a backfill) and a CHECK constraint that rejects any value other
--         than 'CZT'.  Existing rows written before this migration will have
--         token_type = 'CZT' via the DEFAULT.  The @@index([token_type]) index
--         supports future analytics queries filtering by token type.
-- CORRELATION_ID: CNZ-WORK-001-TOKEN-TYPE-ENFORCEMENT

-- AlterTable: add token_type to token_balances with CZT-only CHECK constraint.
ALTER TABLE "token_balances"
  ADD COLUMN IF NOT EXISTS "token_type" VARCHAR(10) NOT NULL DEFAULT 'CZT';

-- CHECK constraint: enforce that only CZT tokens can be stored here.
-- This prevents accidental insertion of legacy or foreign token types.
ALTER TABLE "token_balances"
  ADD CONSTRAINT "token_balances_token_type_czt_only"
  CHECK ("token_type" = 'CZT');

-- Index to support analytics queries filtering by token_type.
CREATE INDEX IF NOT EXISTS "token_balances_token_type_idx"
  ON "token_balances" ("token_type");
