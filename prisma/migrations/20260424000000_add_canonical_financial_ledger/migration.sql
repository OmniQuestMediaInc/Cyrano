-- Canonical Financial Ledger (Payload 1) — OQMI_GOVERNANCE + REDBOOK
-- Three-bucket wallet + hash-chained append-only ledger + token expirations + REDBOOK rate cards.
-- Append-only invariants on wallet_ledger_entries are enforced at the application layer
-- (services/ledger/ledger.service.ts) and verified by hash_current continuity.

CREATE TABLE "wallets" (
    "id"                TEXT         NOT NULL,
    "user_id"           TEXT         NOT NULL,
    "user_type"         TEXT         NOT NULL,
    "purchased_tokens"  INTEGER      NOT NULL DEFAULT 0,
    "membership_tokens" INTEGER      NOT NULL DEFAULT 0,
    "bonus_tokens"      INTEGER      NOT NULL DEFAULT 0,
    "last_updated"      TIMESTAMP(3) NOT NULL,
    "organization_id"   TEXT         NOT NULL,
    "tenant_id"         TEXT         NOT NULL,
    "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "wallets_pkey"         PRIMARY KEY ("id"),
    CONSTRAINT "wallets_buckets_nonneg" CHECK (
        "purchased_tokens"  >= 0 AND
        "membership_tokens" >= 0 AND
        "bonus_tokens"      >= 0
    )
);
CREATE UNIQUE INDEX "wallets_user_id_key"              ON "wallets"("user_id");
CREATE        INDEX "wallets_user_type_idx"            ON "wallets"("user_type");
CREATE        INDEX "wallets_org_tenant_idx"           ON "wallets"("organization_id","tenant_id");

CREATE TABLE "wallet_ledger_entries" (
    "id"             TEXT         NOT NULL,
    "wallet_id"      TEXT         NOT NULL,
    "correlation_id" TEXT         NOT NULL,
    "reason_code"    TEXT         NOT NULL,
    "amount"         INTEGER      NOT NULL,
    "bucket"         TEXT         NOT NULL,
    "metadata"       JSONB,
    "hash_prev"      TEXT,
    "hash_current"   TEXT         NOT NULL,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "wallet_ledger_entries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "wallet_ledger_entries_correlation_id_key" ON "wallet_ledger_entries"("correlation_id");
CREATE        INDEX "wallet_ledger_entries_wallet_corr_idx"    ON "wallet_ledger_entries"("wallet_id","correlation_id");
CREATE        INDEX "wallet_ledger_entries_wallet_created_idx" ON "wallet_ledger_entries"("wallet_id","created_at");
CREATE        INDEX "wallet_ledger_entries_reason_idx"         ON "wallet_ledger_entries"("reason_code");
ALTER TABLE "wallet_ledger_entries"
    ADD CONSTRAINT "wallet_ledger_entries_wallet_id_fkey"
    FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Append-only enforcement: no UPDATE or DELETE permitted on wallet_ledger_entries.
CREATE OR REPLACE FUNCTION reject_wallet_ledger_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'wallet_ledger_entries is append-only — mutation rejected';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER wallet_ledger_entries_no_update
    BEFORE UPDATE ON "wallet_ledger_entries"
    FOR EACH ROW EXECUTE FUNCTION reject_wallet_ledger_mutation();
CREATE TRIGGER wallet_ledger_entries_no_delete
    BEFORE DELETE ON "wallet_ledger_entries"
    FOR EACH ROW EXECUTE FUNCTION reject_wallet_ledger_mutation();

CREATE TABLE "token_expirations" (
    "id"           TEXT           NOT NULL,
    "wallet_id"    TEXT           NOT NULL,
    "tokens"       INTEGER        NOT NULL,
    "expires_at"   TIMESTAMP(3)   NOT NULL,
    "status"       TEXT           NOT NULL,
    "recovery_fee" DECIMAL(10, 2),
    "created_at"   TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "token_expirations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "token_expirations_wallet_status_idx" ON "token_expirations"("wallet_id","status");
CREATE INDEX "token_expirations_status_expires_idx" ON "token_expirations"("status","expires_at");
ALTER TABLE "token_expirations"
    ADD CONSTRAINT "token_expirations_wallet_id_fkey"
    FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "rate_cards" (
    "id"              TEXT           NOT NULL,
    "tier"            TEXT           NOT NULL,
    "guest_price"     DECIMAL(10, 2) NOT NULL,
    "member_price"    DECIMAL(10, 2) NOT NULL,
    "creator_payout"  DECIMAL(6, 4)  NOT NULL,
    "platform_margin" DECIMAL(6, 4)  NOT NULL,
    "min_volume"      INTEGER,
    "heat_level"      TEXT,
    "valid_from"      TIMESTAMP(3)   NOT NULL,
    "valid_to"        TIMESTAMP(3),
    CONSTRAINT "rate_cards_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "rate_cards_tier_valid_from_idx" ON "rate_cards"("tier","valid_from");
