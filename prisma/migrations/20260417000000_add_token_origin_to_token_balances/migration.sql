-- AlterTable: add token_origin to token_balances
ALTER TABLE "token_balances"
  ADD COLUMN IF NOT EXISTS "token_origin" TEXT DEFAULT 'PURCHASED';
