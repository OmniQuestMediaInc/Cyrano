-- Migration: 20260427000000_single_czt_enforcement_v1
-- FEATURE: feature/single-czt-enforcement-v1 — Single CZT Token Economy spec §2
-- CORRELATION_ID: SINGLE-CZT-ENFORCEMENT-V1
-- AUTHORITY: services/showzone/RETIRED.md, ChatNowZone Tech Spec §1+§2
--
-- This migration is the structural cap on the Single CZT Token Economy work:
--   1. Re-asserts the CZT-only CHECK constraints on every token-bearing
--      table, idempotently. Safe to re-run; matches the constraint names from
--      20260426010000 + 20260426200000 so older deployments do not duplicate.
--   2. Installs an immutability trigger on token_balances and
--      wallet_ledger_entries that rejects any UPDATE that attempts to mutate
--      token_type — independent from the value-level CHECK, which only catches
--      values, not column-level rewrites that pass the value check.
--
-- All token-bearing rows must have token_type = 'CZT'. ShowToken / SZT and
-- every other historical token type are retired. See Canonical Corpus
-- invariants: append-only ledger + correlation_id + reason_code.

-- ── 1a. token_balances: idempotent CHECK + index re-assert ──────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'token_balances_token_type_czt_only'
  ) THEN
    ALTER TABLE "token_balances"
      ADD CONSTRAINT "token_balances_token_type_czt_only"
      CHECK ("token_type" = 'CZT');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "token_balances_token_type_idx"
  ON "token_balances" ("token_type");

-- ── 1b. wallet_ledger_entries: idempotent CHECK + index re-assert ───────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wallet_ledger_entries_token_type_czt_only'
  ) THEN
    ALTER TABLE "wallet_ledger_entries"
      ADD CONSTRAINT "wallet_ledger_entries_token_type_czt_only"
      CHECK ("token_type" = 'CZT');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "wallet_ledger_entries_token_type_idx"
  ON "wallet_ledger_entries" ("token_type");

-- ── 2. Immutability trigger function ────────────────────────────────────────
-- Rejects any UPDATE that changes token_type away from 'CZT'. Together with
-- the CHECK constraint and the application-layer guard
-- (services/core-api/src/finance/ledger.service.ts → CZT_TOKEN_TYPE), this
-- gives us three concentric layers of enforcement.
CREATE OR REPLACE FUNCTION "fn_token_type_immutable"()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."token_type" IS DISTINCT FROM OLD."token_type" THEN
    RAISE EXCEPTION
      'token_type is immutable (was %, attempted %). Single CZT economy is enforced.',
      OLD."token_type", NEW."token_type"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- ── 3. Install trigger on token_balances ────────────────────────────────────
DROP TRIGGER IF EXISTS "trg_token_balances_token_type_immutable"
  ON "token_balances";

CREATE TRIGGER "trg_token_balances_token_type_immutable"
BEFORE UPDATE OF "token_type" ON "token_balances"
FOR EACH ROW
EXECUTE FUNCTION "fn_token_type_immutable"();

-- ── 4. Install trigger on wallet_ledger_entries ─────────────────────────────
-- Append-only invariant means UPDATE on this table should be rare-to-never,
-- but the trigger is cheap insurance.
DROP TRIGGER IF EXISTS "trg_wallet_ledger_entries_token_type_immutable"
  ON "wallet_ledger_entries";

CREATE TRIGGER "trg_wallet_ledger_entries_token_type_immutable"
BEFORE UPDATE OF "token_type" ON "wallet_ledger_entries"
FOR EACH ROW
EXECUTE FUNCTION "fn_token_type_immutable"();
