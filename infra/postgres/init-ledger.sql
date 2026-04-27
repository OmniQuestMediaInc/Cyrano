-- =============================================================================
-- ChatNow.Zone — Core Financial Ledger Schema
-- WO: WO-INIT-001
-- Doctrine: Append-Only Ledger | Deterministic Logic
-- =============================================================================

-- -----------------------------------------------------------------------------
-- EXTENSION: UUID generation
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- TABLE: user_risk_profiles
-- PURPOSE: Mini Credit Bureau — stores risk scoring data per user.
-- MUTATION POLICY: INSERT and UPDATE allowed; DELETE prohibited by policy.
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_risk_profiles (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL UNIQUE,

    -- Risk scoring
    risk_score          NUMERIC(5, 2)  NOT NULL DEFAULT 0.00
                            CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_tier           VARCHAR(20) NOT NULL DEFAULT 'UNRATED'
                            CHECK (risk_tier IN ('UNRATED', 'LOW', 'MEDIUM', 'HIGH', 'BLOCKED')), 

    -- Credit bureau data
    total_charged_back  NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_disputed      NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_approved      NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    chargeback_ratio    NUMERIC(5, 4)  NOT NULL DEFAULT 0.0000
                            CHECK (chargeback_ratio >= 0 AND chargeback_ratio <= 1),

    -- Velocity controls
    daily_spend_limit   NUMERIC(12, 2) NOT NULL DEFAULT 500.00,
    monthly_spend_limit NUMERIC(12, 2) NOT NULL DEFAULT 5000.00,

    -- Audit timestamps
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_evaluated_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_risk_profiles_risk_tier
    ON user_risk_profiles (risk_tier);

COMMENT ON TABLE user_risk_profiles IS
    'Mini Credit Bureau: stores risk scoring and velocity data per user. '
    'Risk scores are recalculated deterministically from ledger_entries. '
    'DELETE is prohibited by OQMI Append-Only Ledger Doctrine.';

-- =============================================================================
-- TABLE: studio_contracts
-- PURPOSE: Payroll split logic — defines revenue share between studio and
--          performers for each contract period.
-- MUTATION POLICY: INSERT and UPDATE allowed; DELETE prohibited by policy.
-- =============================================================================
CREATE TABLE IF NOT EXISTS studio_contracts (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    studio_id           UUID        NOT NULL,
    performer_id        UUID        NOT NULL,

    -- Contract terms
    contract_ref        VARCHAR(100) NOT NULL UNIQUE,
    effective_date      DATE        NOT NULL,
    expiry_date         DATE,
    status              VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                            CHECK (status IN ('DRAFT', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'TERMINATED')),

    -- Split ratios (must sum to 1.0000)
    studio_split        NUMERIC(5, 4) NOT NULL
                            CHECK (studio_split >= 0 AND studio_split <= 1),
    performer_split     NUMERIC(5, 4) NOT NULL
                            CHECK (performer_split >= 0 AND performer_split <= 1),
    platform_split      NUMERIC(5, 4) NOT NULL DEFAULT 0.0000
                            CHECK (platform_split >= 0 AND platform_split <= 1),

    -- Constraint: splits must sum to exactly 1
    CONSTRAINT split_ratio_sum CHECK (
        ROUND(studio_split + performer_split + platform_split, 4) = 1.0000
    ),

    -- Floor guarantees
    performer_floor_per_minute NUMERIC(8, 4),

    -- Audit timestamps
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(), 
    created_by          UUID        NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_studio_contracts_studio_id
    ON studio_contracts (studio_id);

CREATE INDEX IF NOT EXISTS idx_studio_contracts_performer_id
    ON studio_contracts (performer_id);

CREATE INDEX IF NOT EXISTS idx_studio_contracts_status
    ON studio_contracts (status);

COMMENT ON TABLE studio_contracts IS
    'Payroll split logic: defines revenue share ratios between studio, performer, '
    'and platform for each active contract. studio_split + performer_split + '
    'platform_split must equal 1.0000. DELETE is prohibited by policy.';

-- =============================================================================
-- TABLE: ledger_entries
-- PURPOSE: Append-Only Transaction History — immutable financial record.
-- MUTATION POLICY: INSERT ONLY. No UPDATE. No DELETE. Ever.
-- =============================================================================
CREATE TABLE IF NOT EXISTS ledger_entries (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Transaction identity
    transaction_ref     VARCHAR(100) NOT NULL UNIQUE,
    idempotency_key     VARCHAR(200) NOT NULL UNIQUE,
    parent_entry_id     UUID        REFERENCES ledger_entries(id),

    -- Parties
    user_id             UUID        NOT NULL,
    studio_id           UUID,
    performer_id        UUID,
    contract_id         UUID        REFERENCES studio_contracts(id),

    -- Transaction classification
    entry_type          VARCHAR(50) NOT NULL
                            CHECK (entry_type IN (
                                'CHARGE',
                                'REFUND',
                                'CHARGEBACK',
                                'REVERSAL',
                                'PAYOUT_STUDIO',
                                'PAYOUT_PERFORMER',
                                'PAYOUT_PLATFORM',
                                'ADJUSTMENT',
                                'FEE',
                                'REWARD_CREDIT',
                                'REWARD_REDEEM'
                            )),
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                            CHECK (status IN ('PENDING', 'SETTLED', 'FAILED', 'DISPUTED', 'REVERSED')),

    -- Amounts (all in minor units: cents)
    gross_amount_cents  BIGINT      NOT NULL CHECK (gross_amount_cents >= 0),
    fee_amount_cents    BIGINT      NOT NULL DEFAULT 0 CHECK (fee_amount_cents >= 0),
    net_amount_cents    BIGINT      NOT NULL CHECK (
                                (entry_type IN ('REFUND', 'CHARGEBACK', 'REVERSAL') AND net_amount_cents <= 0)
                                OR
                                (entry_type NOT IN ('REFUND', 'CHARGEBACK', 'REVERSAL') AND net_amount_cents >= 0)
                            ),
    currency            CHAR(3)     NOT NULL DEFAULT 'USD',

    -- Split ledger (populated for PAYOUT entries)
    studio_amount_cents    BIGINT   NOT NULL DEFAULT 0,
    performer_amount_cents BIGINT   NOT NULL DEFAULT 0,
    platform_amount_cents  BIGINT   NOT NULL DEFAULT 0,

    -- External gateway
    gateway             VARCHAR(50),
    gateway_txn_id      VARCHAR(200),
    gateway_response    JSONB,

    -- Metadata
    description         TEXT,
    metadata            JSONB,

    -- Immutable audit timestamp (no updated_at — append-only)
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforce append-only: prevent UPDATE and DELETE via triggers that raise errors
CREATE OR REPLACE FUNCTION ledger_entries_block_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION
        'OQMI Append-Only Doctrine violation: % on ledger_entries is prohibited. '
        'Ledger entries are immutable. Create a new correcting entry instead.',
        TG_OP;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_ledger_entries_no_update
    BEFORE UPDATE ON ledger_entries
    FOR EACH ROW EXECUTE FUNCTION ledger_entries_block_mutation();

CREATE OR REPLACE TRIGGER trg_ledger_entries_no_delete
    BEFORE DELETE ON ledger_entries
    FOR EACH ROW EXECUTE FUNCTION ledger_entries_block_mutation();

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_ledger_entries_user_id
    ON ledger_entries (user_id);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_studio_id
    ON ledger_entries (studio_id);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_performer_id
    ON ledger_entries (performer_id);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_contract_id
    ON ledger_entries (contract_id);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_entry_type
    ON ledger_entries (entry_type);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_status
    ON ledger_entries (status);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_created_at
    ON ledger_entries (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_gateway_txn_id
    ON ledger_entries (gateway_txn_id)
    WHERE gateway_txn_id IS NOT NULL;

COMMENT ON TABLE ledger_entries IS
    'Append-Only Transaction History. IMMUTABLE by OQMI Doctrine. '
    'INSERT ONLY — UPDATE and DELETE are blocked by database rules. '
    'Every financial event must produce a new row. '
    'Use parent_entry_id to link reversals, refunds, or corrections to originals.';

COMMENT ON COLUMN ledger_entries.idempotency_key IS
    'Caller-supplied idempotency key. Unique constraint prevents duplicate charges.';

COMMENT ON COLUMN ledger_entries.parent_entry_id IS
    'Links a REFUND, REVERSAL, or CHARGEBACK back to the original CHARGE entry.';

-- =============================================================================
-- TABLE: transactions
-- PURPOSE: High-level transaction record linking a user action (e.g. tip,
--          purchase) to one or more ledger_entries. Provides a single point
--          of reference for the originating event.
-- MUTATION POLICY: INSERT ONLY except status transitions. INSERT and status
--                  UPDATE are permitted. All other UPDATE columns and all
--                  DELETE operations are blocked by trigger.
-- WO: WO-INIT-001
-- =============================================================================
CREATE TABLE IF NOT EXISTS transactions (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity
    transaction_ref     VARCHAR(100) NOT NULL UNIQUE,
    idempotency_key     VARCHAR(200) NOT NULL UNIQUE,

    -- Parties
    user_id             UUID        NOT NULL,
    performer_id        UUID,
    studio_id           UUID,

    -- Classification
    transaction_type    VARCHAR(50) NOT NULL
                            CHECK (transaction_type IN (
                                'TIP',
                                'PURCHASE',
                                'SUBSCRIPTION',
                                'REFUND',
                                'CHARGEBACK',
                                'PAYOUT'
                            )),
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                            CHECK (status IN ('PENDING', 'SETTLED', 'FAILED', 'DISPUTED', 'REVERSED')),

    -- Amount
    gross_amount_cents  BIGINT      NOT NULL CHECK (gross_amount_cents >= 0),
    currency            CHAR(3)     NOT NULL DEFAULT 'USD',

    -- Metadata
    metadata            JSONB,

    -- Audit
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id
    ON transactions (user_id);

CREATE INDEX IF NOT EXISTS idx_transactions_performer_id
    ON transactions (performer_id)
    WHERE performer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_status
    ON transactions (status);

CREATE INDEX IF NOT EXISTS idx_transactions_created_at
    ON transactions (created_at DESC);

COMMENT ON TABLE transactions IS
    'High-level transaction record. Each transaction may produce one or more '
    'ledger_entries. Provides a single originating event reference for auditing.';

-- ---------------------------------------------------------------------------
-- Trigger: block DELETE and non-status UPDATE on transactions (append-only
-- with the sole exception of status transitions).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION transactions_block_mutation()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'transactions is append-only: DELETE is not permitted (id=%).', OLD.id;
    END IF;
    -- On UPDATE, only the status column may change.
    -- Note: updated_at is intentionally excluded here — it is managed by the
    -- separate trg_transactions_status_updated_at trigger and must be allowed
    -- to change in concert with a status update.
    IF TG_OP = 'UPDATE' THEN
        IF NEW.transaction_ref     IS DISTINCT FROM OLD.transaction_ref     OR
           NEW.idempotency_key     IS DISTINCT FROM OLD.idempotency_key     OR
           NEW.user_id             IS DISTINCT FROM OLD.user_id             OR
           NEW.performer_id        IS DISTINCT FROM OLD.performer_id        OR
           NEW.studio_id           IS DISTINCT FROM OLD.studio_id           OR
           NEW.transaction_type    IS DISTINCT FROM OLD.transaction_type    OR
           NEW.gross_amount_cents  IS DISTINCT FROM OLD.gross_amount_cents  OR
           NEW.currency            IS DISTINCT FROM OLD.currency            OR
           NEW.metadata            IS DISTINCT FROM OLD.metadata            OR
           NEW.created_at          IS DISTINCT FROM OLD.created_at
        THEN
            RAISE EXCEPTION
                'transactions is append-only: only status updates are permitted (id=%).', OLD.id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_transactions_block_mutation
BEFORE UPDATE OR DELETE ON transactions
FOR EACH ROW EXECUTE FUNCTION transactions_block_mutation();

-- ---------------------------------------------------------------------------
-- Trigger: maintain updated_at when transaction status changes.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        NEW.updated_at := NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_transactions_status_updated_at
BEFORE UPDATE OF status ON transactions
FOR EACH ROW EXECUTE FUNCTION set_transactions_updated_at();

-- =============================================================================
-- TABLE: identity_verification
-- WO: WO-036-KYC-VAULT-PUBLISH-GATE
-- PURPOSE: KYC identity verification records for performers.
--          Enforces Vault Segregation per Corpus v10 Section 4.2.
-- MUTATION POLICY: INSERT only. Status changes produce new rows (append-only).
--                  Expiry extension requires step-up auth (enforced in service
--                  layer). No raw PII stored — document_hash is SHA-256 only.
-- =============================================================================
CREATE TABLE IF NOT EXISTS identity_verification (
    verification_id     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    performer_id        UUID        NOT NULL,

    -- Identity evidence (no raw PII — hash reference only per Corpus v10 §4.2)
    document_hash       CHAR(64)    NOT NULL,  -- SHA-256 hex digest

    -- Age / eligibility
    dob                 DATE        NOT NULL,

    -- Verification lifecycle
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                            CHECK (status IN ('PENDING', 'VERIFIED', 'EXPIRED', 'REJECTED')),
    expiry_date         TIMESTAMPTZ,
    liveness_pass       BOOLEAN     NOT NULL DEFAULT FALSE,

    -- Step-up audit trail for expiry overrides (populated on manual extension)
    expiry_override_actor_id    UUID,
    expiry_override_reason_code VARCHAR(100),
    expiry_override_at          TIMESTAMPTZ,

    -- Audit timestamps
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_identity_verification_performer_id
    ON identity_verification (performer_id);

CREATE INDEX IF NOT EXISTS idx_identity_verification_status
    ON identity_verification (status);

COMMENT ON TABLE identity_verification IS
    'KYC identity verification records for performers. '
    'document_hash stores SHA-256 reference only — no raw PII (Corpus v10 §4.2). '
    'Expiry extensions require step-up authentication and a reason_code. '
    'WO: WO-036-KYC-VAULT-PUBLISH-GATE.';

-- Prevent deletion of identity_verification rows (append-only doctrine).
CREATE OR REPLACE FUNCTION identity_verification_block_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION
        'identity_verification is append-only: DELETE is not permitted (verification_id=%).', OLD.verification_id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_identity_verification_block_delete
BEFORE DELETE ON identity_verification
FOR EACH ROW EXECUTE FUNCTION identity_verification_block_delete();

-- Maintain updated_at on status change.
CREATE OR REPLACE FUNCTION set_identity_verification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_identity_verification_updated_at
BEFORE UPDATE ON identity_verification
FOR EACH ROW EXECUTE FUNCTION set_identity_verification_updated_at();

-- =============================================================================
-- TABLE: audit_events
-- WO: WO-036-KYC-VAULT-PUBLISH-GATE
-- PURPOSE: Immutable audit chain for compliance events.
--          Covers publish eligibility checks, vault access, and overrides.
-- MUTATION POLICY: INSERT only. No UPDATE or DELETE permitted.
-- =============================================================================
CREATE TABLE IF NOT EXISTS audit_events (
    event_id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Event classification
    event_type          VARCHAR(50) NOT NULL
                            CHECK (event_type IN (
                                'PUBLISH_ELIGIBILITY_CHECK',
                                'VAULT_ACCESS',
                                'EXPIRY_OVERRIDE',
                                'NOTIFICATION_SENT',
                                'NOTIFICATION_SUPPRESSED'
                            )),

    -- Actor / subject
    actor_id            UUID        NOT NULL,
    performer_id        UUID,

    -- Event detail
    purpose_code        VARCHAR(100),
    device_fingerprint  VARCHAR(255),
    outcome             VARCHAR(50),
    reason_code         VARCHAR(100),

    -- Notification audit fields (WO-038)
    template_id         VARCHAR(100),
    consent_basis_id    VARCHAR(100),

    -- Arbitrary structured context (no raw PII)
    metadata            JSONB,

    -- Immutable timestamp
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_actor_id
    ON audit_events (actor_id);

CREATE INDEX IF NOT EXISTS idx_audit_events_performer_id
    ON audit_events (performer_id);

CREATE INDEX IF NOT EXISTS idx_audit_events_event_type
    ON audit_events (event_type);

CREATE INDEX IF NOT EXISTS idx_audit_events_created_at
    ON audit_events (created_at DESC);

COMMENT ON TABLE audit_events IS
    'Immutable audit chain for compliance events. '
    'Covers publish eligibility checks, vault access, and expiry overrides. '
    'INSERT only — no UPDATE or DELETE permitted. '
    'WO: WO-036-KYC-VAULT-PUBLISH-GATE.';

-- Enforce append-only on audit_events.
CREATE OR REPLACE FUNCTION audit_events_block_mutation()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'audit_events is append-only: DELETE is not permitted (event_id=%).', OLD.event_id;
    END IF;
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION
            'audit_events is append-only: UPDATE is not permitted (event_id=%).', OLD.event_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_events_block_mutation
BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION audit_events_block_mutation();

-- =============================================================================
-- TABLE: referral_links
-- PURPOSE: Creator-Led Attribution Engine — tracks referral campaigns issued
--          by creators. Each link carries a fixed attribution window.
-- MUTATION POLICY: INSERT only. No UPDATE or DELETE permitted.
-- WO: WO-037
-- =============================================================================
CREATE TABLE IF NOT EXISTS referral_links (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Parties
    creator_id          UUID        NOT NULL,
    campaign_id         UUID        NOT NULL,

    -- Attribution window in days (deterministic, no hidden defaults)
    attribution_window_days  INTEGER NOT NULL CHECK (attribution_window_days > 0),

    -- Slug used in the referral URL (unique, URL-safe)
    link_slug           VARCHAR(100) NOT NULL UNIQUE,

    -- Anti-fraud: device fingerprint and payment instrument captured at
    -- link creation time to detect self-referral loops (WO-037 §anti-fraud).
    device_fingerprint  VARCHAR(255),
    payment_instrument_hash VARCHAR(64),   -- SHA-256 hash only — no raw PAN

    -- Status
    is_active           BOOLEAN     NOT NULL DEFAULT TRUE,

    -- Platform time (America/Toronto context embedded in metadata)
    metadata            JSONB,

    -- Immutable audit timestamp
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_links_creator_id
    ON referral_links (creator_id);

CREATE INDEX IF NOT EXISTS idx_referral_links_campaign_id
    ON referral_links (campaign_id);

CREATE INDEX IF NOT EXISTS idx_referral_links_link_slug
    ON referral_links (link_slug);

COMMENT ON TABLE referral_links IS
    'Creator-Led Attribution Engine: referral campaign links issued by creators. '
    'attribution_window_days determines the eligibility window for reward credit. '
    'device_fingerprint and payment_instrument_hash enable anti-fraud self-referral '
    'loop detection. INSERT only — no UPDATE or DELETE (WO-037).';

-- Enforce append-only on referral_links.
CREATE OR REPLACE FUNCTION referral_links_block_mutation()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'referral_links is append-only: DELETE is not permitted (id=%).', OLD.id;
    END IF;
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION
            'referral_links is append-only: UPDATE is not permitted (id=%).', OLD.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_referral_links_block_mutation
BEFORE UPDATE OR DELETE ON referral_links
FOR EACH ROW EXECUTE FUNCTION referral_links_block_mutation();

-- =============================================================================
-- TABLE: attribution_events
-- PURPOSE: Records every attribution event (click, sign-up, conversion)
--          linked to a referral_link. Each row is immutable.
-- MUTATION POLICY: INSERT only. No UPDATE or DELETE permitted.
-- WO: WO-037
-- =============================================================================
CREATE TABLE IF NOT EXISTS attribution_events (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Link back to the issuing referral
    referral_link_id    UUID        NOT NULL REFERENCES referral_links(id),

    -- Parties
    creator_id          UUID        NOT NULL,
    campaign_id         UUID        NOT NULL,

    -- Attributed user (the newly referred user)
    attributed_user_id  UUID        NOT NULL,

    -- Event classification
    event_type          VARCHAR(50) NOT NULL
                            CHECK (event_type IN (
                                'CLICK',
                                'SIGNUP',
                                'FIRST_PURCHASE',
                                'CONVERSION'
                            )),

    -- Anti-fraud snapshot at event time
    device_fingerprint  VARCHAR(255),
    payment_instrument_hash VARCHAR(64),   -- SHA-256 hash only — no raw PAN

    -- Ledger link: populated when a reward is credited
    ledger_entry_id     UUID        REFERENCES ledger_entries(id),
    rule_applied_id     VARCHAR(100),

    -- Platform time (America/Toronto)
    platform_time       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Metadata
    metadata            JSONB,

    -- Immutable audit timestamp
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attribution_events_referral_link_id
    ON attribution_events (referral_link_id);

CREATE INDEX IF NOT EXISTS idx_attribution_events_creator_id
    ON attribution_events (creator_id);

CREATE INDEX IF NOT EXISTS idx_attribution_events_attributed_user_id
    ON attribution_events (attributed_user_id);

CREATE INDEX IF NOT EXISTS idx_attribution_events_event_type
    ON attribution_events (event_type);

CREATE INDEX IF NOT EXISTS idx_attribution_events_created_at
    ON attribution_events (created_at DESC);

COMMENT ON TABLE attribution_events IS
    'Immutable log of attribution events tied to referral_links. '
    'Each rewarded conversion produces a ledger_entry (REWARD_CREDIT) and '
    'records the ledger_entry_id and rule_applied_id here. '
    'platform_time uses America/Toronto as primary timezone per OQMI doctrine. '
    'INSERT only — no UPDATE or DELETE (WO-037).';

-- Enforce append-only on attribution_events.
CREATE OR REPLACE FUNCTION attribution_events_block_mutation()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'attribution_events is append-only: DELETE is not permitted (id=%).', OLD.id;
    END IF;
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION
            'attribution_events is append-only: UPDATE is not permitted (id=%).', OLD.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_attribution_events_block_mutation
BEFORE UPDATE OR DELETE ON attribution_events
FOR EACH ROW EXECUTE FUNCTION attribution_events_block_mutation();

-- =============================================================================
-- TABLE: notification_consent_store
-- PURPOSE: Consent-Aware Notification Service — stores per-user, per-channel
--          opt-in/out state with jurisdiction rule versioning.
-- MUTATION POLICY: INSERT and UPDATE allowed (consent state may change over time).
--                  DELETE is prohibited — historical consent records are retained.
-- WO: WO-038
-- =============================================================================
CREATE TABLE IF NOT EXISTS notification_consent_store (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Subject
    user_id                 UUID        NOT NULL,

    -- Notification channel
    channel                 VARCHAR(20) NOT NULL
                                CHECK (channel IN ('Email', 'SMS', 'Push')),

    -- Consent state
    is_opted_in             BOOLEAN     NOT NULL DEFAULT FALSE,

    -- Jurisdiction compliance
    jurisdiction_rule_version VARCHAR(50) NOT NULL,

    -- Audit timestamps
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One active record per user+channel
    CONSTRAINT uq_notification_consent_user_channel UNIQUE (user_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_notification_consent_store_user_id
    ON notification_consent_store (user_id);

CREATE INDEX IF NOT EXISTS idx_notification_consent_store_channel
    ON notification_consent_store (channel);

COMMENT ON TABLE notification_consent_store IS
    'Per-user, per-channel notification consent records. '
    'GuardedNotificationService checks is_opted_in before emitting any message. '
    'jurisdiction_rule_version pins the regulation version under which consent '
    'was captured (e.g. CASL-2024, GDPR-2023). '
    'WO: WO-038.';

-- Prevent deletion of consent records.
CREATE OR REPLACE FUNCTION notification_consent_store_block_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION
        'notification_consent_store is append-only: DELETE is not permitted (id=%).', OLD.id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notification_consent_store_block_delete
BEFORE DELETE ON notification_consent_store
FOR EACH ROW EXECUTE FUNCTION notification_consent_store_block_delete();

-- Maintain updated_at on consent change.
CREATE OR REPLACE FUNCTION set_notification_consent_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notification_consent_updated_at
BEFORE UPDATE ON notification_consent_store
FOR EACH ROW EXECUTE FUNCTION set_notification_consent_updated_at();

-- =============================================================================
-- TABLE: tip_menu_items
-- PURPOSE: Creator-defined tip menu. Versioned, append-only.
-- All changes create new rows — no UPDATE on price or description columns.
-- MUTATION POLICY: INSERT only for new versions. UPDATE allowed on is_active only.
-- WO: FIZ-004
-- =============================================================================
CREATE TABLE IF NOT EXISTS tip_menu_items (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id          UUID        NOT NULL,
    item_name           VARCHAR(100) NOT NULL,
    description         TEXT,
    base_price_tokens   INTEGER     NOT NULL CHECK (base_price_tokens > 0),
    -- Geo-tier prices (NULL = use multiplier from GovernanceConfigService)
    geo_price_low       INTEGER,
    geo_price_med       INTEGER,
    is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
    version             INTEGER     NOT NULL DEFAULT 1,
    rule_applied_id     VARCHAR(100) NOT NULL DEFAULT 'TIP_MENU_v1',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tip_menu_items_creator_id ON tip_menu_items (creator_id);
CREATE INDEX IF NOT EXISTS idx_tip_menu_items_is_active  ON tip_menu_items (creator_id, is_active);
COMMENT ON TABLE tip_menu_items IS
    'Creator tip menu items. Append-only for new versions. is_active toggle permitted. '
    'Geo prices override multiplier if set. FIZ-004.';

-- =============================================================================
-- TABLE: game_sessions
-- PURPOSE: Immutable record of every gamification play (Wheel/Slots/Dice).
-- Token debit MUST occur before outcome is resolved. Append-only.
-- MUTATION POLICY: INSERT only. No UPDATE or DELETE.
-- WO: FIZ-004
-- =============================================================================
CREATE TABLE IF NOT EXISTS game_sessions (
    session_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL,
    creator_id          UUID        NOT NULL,
    game_type           VARCHAR(20) NOT NULL
                            CHECK (game_type IN ('SPIN_WHEEL', 'SLOT_MACHINE', 'DICE')),
    token_tier          INTEGER     NOT NULL CHECK (token_tier IN (25, 45, 60)),
    tokens_paid         INTEGER     NOT NULL CHECK (tokens_paid > 0),
    ledger_entry_id     UUID,       -- FK to ledger_entries.id (set after debit)
    outcome             JSONB,      -- {die_values: [3,4], total: 7} or {segment: 'PRIZE_A'}
    prize_awarded       TEXT,
    prize_table_version VARCHAR(50) NOT NULL,
    idempotency_key     VARCHAR(200) NOT NULL UNIQUE,
    rule_applied_id     VARCHAR(100) NOT NULL DEFAULT 'GAMIFICATION_v1',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_game_sessions_user_id    ON game_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_creator_id ON game_sessions (creator_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_game_type  ON game_sessions (game_type);
COMMENT ON TABLE game_sessions IS
    'Immutable gamification play log. Token debit precedes outcome. Append-only. FIZ-004.';

CREATE OR REPLACE FUNCTION game_sessions_block_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'game_sessions is append-only: % is not permitted (session_id=%).', TG_OP, OLD.session_id;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_game_sessions_block_mutation
BEFORE UPDATE OR DELETE ON game_sessions
FOR EACH ROW EXECUTE FUNCTION game_sessions_block_mutation();

-- =============================================================================
-- TABLE: prize_tables
-- PURPOSE: Creator-configured prize tables for gamification. Versioned.
-- MUTATION POLICY: INSERT only. Deactivation via new row with is_active=false.
-- WO: FIZ-004
-- =============================================================================
CREATE TABLE IF NOT EXISTS prize_tables (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id          UUID        NOT NULL,
    game_type           VARCHAR(20) NOT NULL
                            CHECK (game_type IN ('SPIN_WHEEL', 'SLOT_MACHINE', 'DICE')),
    token_tier          INTEGER     NOT NULL CHECK (token_tier IN (25, 45, 60)),
    prize_slot          VARCHAR(20) NOT NULL, -- e.g. '7' for dice, 'SEG_A' for wheel
    prize_description   TEXT        NOT NULL,
    is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
    version             VARCHAR(50) NOT NULL,
    rule_applied_id     VARCHAR(100) NOT NULL DEFAULT 'PRIZE_TABLE_v1',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prize_tables_creator_game ON prize_tables (creator_id, game_type, token_tier, is_active);
COMMENT ON TABLE prize_tables IS 'Creator prize tables for gamification. Versioned, append-only. FIZ-004.';

-- =============================================================================
-- TABLE: call_bookings
-- PURPOSE: PrivateCall booking records. Append-only.
-- MUTATION POLICY: INSERT only. Status transitions via new events table.
-- WO: FIZ-004
-- =============================================================================
CREATE TABLE IF NOT EXISTS call_bookings (
    booking_id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id              UUID        NOT NULL,
    vip_user_id             UUID        NOT NULL,
    scheduled_at_utc        TIMESTAMPTZ NOT NULL,
    block_type              VARCHAR(20) NOT NULL
                                CHECK (block_type IN ('MINI_6', 'STANDARD_12', 'PREMIUM_24', 'PER_MINUTE')),
    block_duration_mins     INTEGER     NOT NULL CHECK (block_duration_mins > 0),
    price_usd               NUMERIC(10,2) NOT NULL CHECK (price_usd > 0),
    status                  VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED'
                                CHECK (status IN ('SCHEDULED','CONFIRMED','ACTIVE','COMPLETED',
                                                   'CANCELLED_VIP','CANCELLED_CREATOR','NO_SHOW_VIP','NO_SHOW_CREATOR')),
    reschedule_fee_usd      NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    ledger_entry_id         UUID,
    idempotency_key         VARCHAR(200) NOT NULL UNIQUE,
    rule_applied_id         VARCHAR(100) NOT NULL DEFAULT 'PRIVATE_CALL_v1',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_call_bookings_creator_id  ON call_bookings (creator_id);
CREATE INDEX IF NOT EXISTS idx_call_bookings_vip_user_id ON call_bookings (vip_user_id);
CREATE INDEX IF NOT EXISTS idx_call_bookings_scheduled   ON call_bookings (scheduled_at_utc);
COMMENT ON TABLE call_bookings IS 'PrivateCall booking records. Append-only. FIZ-004.';

-- =============================================================================
-- TABLE: call_sessions
-- PURPOSE: Immutable real-time session log for PrivateCalls.
--          Login/ready/start/end timestamps are the evidence of attendance.
-- MUTATION POLICY: INSERT only. No UPDATE or DELETE — ever.
-- WO: FIZ-004
-- =============================================================================
CREATE TABLE IF NOT EXISTS call_sessions (
    session_id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id              UUID        NOT NULL REFERENCES call_bookings(booking_id),
    creator_login_at        TIMESTAMPTZ,
    vip_login_at            TIMESTAMPTZ,
    creator_ready_at        TIMESTAMPTZ,
    vip_ready_at            TIMESTAMPTZ,
    call_start_at           TIMESTAMPTZ,
    call_end_at             TIMESTAMPTZ,
    actual_duration_secs    INTEGER,
    creator_no_show         BOOLEAN     NOT NULL DEFAULT FALSE,
    vip_no_show             BOOLEAN     NOT NULL DEFAULT FALSE,
    voip_session_id         VARCHAR(200),
    rule_applied_id         VARCHAR(100) NOT NULL DEFAULT 'PRIVATE_CALL_v1',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_call_sessions_booking_id ON call_sessions (booking_id);
COMMENT ON TABLE call_sessions IS
    'Immutable PrivateCall session log. Login/ready timestamps are attendance evidence. '
    'No UPDATE or DELETE permitted. FIZ-004.';

CREATE OR REPLACE FUNCTION call_sessions_block_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'call_sessions is immutable: % is not permitted (session_id=%).', TG_OP, OLD.session_id;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_call_sessions_block_mutation
BEFORE UPDATE OR DELETE ON call_sessions
FOR EACH ROW EXECUTE FUNCTION call_sessions_block_mutation();

-- =============================================================================
-- TABLE: voucher_vault
-- PURPOSE: GWP (Gift With Purchase) offer catalog. is_permanent enforced.
-- MUTATION POLICY: INSERT only. No DELETE. is_active toggle on UPDATE permitted.
-- WO: FIZ-004
-- =============================================================================
CREATE TABLE IF NOT EXISTS voucher_vault (
    voucher_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_name          VARCHAR(100) NOT NULL,
    description         Text,
    eligible_tiers      TEXT[]      NOT NULL,   -- e.g. ['GOLD','PLATINUM','DIAMOND']
    trigger_type        VARCHAR(50) NOT NULL DEFAULT 'LOGIN',
    token_value         INTEGER,                -- Bonus tokens if applicable
    is_permanent        BOOLEAN     NOT NULL DEFAULT TRUE,   -- is_permanent=true enforced
    is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
    rule_applied_id     VARCHAR(100) NOT NULL DEFAULT 'GWP_VAULT_v1',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE voucher_vault IS
    'GWP offer catalog. is_permanent=true: entries are never deleted. '
    'Deactivation via is_active=false only. FIZ-004.';

CREATE OR REPLACE FUNCTION voucher_vault_block_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'voucher_vault is permanent: DELETE is not permitted (voucher_id=%).', OLD.voucher_id;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_voucher_vault_block_delete
BEFORE DELETE ON voucher_vault
FOR EACH ROW EXECUTE FUNCTION voucher_vault_block_delete();

-- =============================================================================
-- TABLE: content_suppression_queue
-- PURPOSE: DB-backed provisional suppression store (replaces in-memory Map).
-- MUTATION POLICY: INSERT for new records. UPDATE allowed on status only.
--                  DELETE prohibited.
-- WO: PRISMA-002
-- =============================================================================
CREATE TABLE IF NOT EXISTS content_suppression_queue (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id          VARCHAR(200) NOT NULL,
    case_id             VARCHAR(200) NOT NULL,
    rule_applied_id     VARCHAR(100) NOT NULL,
    status              VARCHAR(20)  NOT NULL DEFAULT 'PROVISIONAL'
                            CHECK (status IN ('PROVISIONAL', 'FINALIZED', 'LIFTED')),
    content_hash        CHAR(64),
    suppressed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finalized_at        TIMESTAMPTZ,
    lifted_at           TIMESTAMPTZ,
    lifted_by           UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_suppression_queue_content_id
    ON content_suppression_queue (content_id);
CREATE INDEX IF NOT EXISTS idx_suppression_queue_case_id
    ON content_suppression_queue (case_id);
CREATE INDEX IF NOT EXISTS idx_suppression_queue_status
    ON content_suppression_queue (status);

CREATE OR REPLACE FUNCTION content_suppression_queue_block_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION
        'content_suppression_queue is append-only: DELETE is not permitted (id=%).', OLD.id;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_content_suppression_queue_block_delete
BEFORE DELETE ON content_suppression_queue
FOR EACH ROW EXECUTE FUNCTION content_suppression_queue_block_delete();

-- =============================================================================
-- TABLE: prize_pools
-- PURPOSE: Creator-authored prize pools (shared or per-game). Append-only.
-- MUTATION POLICY: INSERT only. Tombstone via new row with is_active=false.
-- WO: PHASE-G1
-- =============================================================================
CREATE TABLE IF NOT EXISTS prize_pools (
    pool_id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id        UUID         NOT NULL,
    name              VARCHAR(120) NOT NULL,
    scoped_game_type  VARCHAR(20)
                          CHECK (scoped_game_type IS NULL OR
                                 scoped_game_type IN ('SPIN_WHEEL', 'SLOT_MACHINE', 'DICE')),
    version           VARCHAR(50)  NOT NULL,
    rule_applied_id   VARCHAR(100) NOT NULL DEFAULT 'PRIZE_POOL_v1',
    is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prize_pools_creator_active
    ON prize_pools (creator_id, is_active, scoped_game_type);
COMMENT ON TABLE prize_pools IS
    'Creator-authored prize pools (shared or scoped). Append-only (PHASE-G1).';

CREATE OR REPLACE FUNCTION prize_pools_block_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'prize_pools is append-only: DELETE is not permitted (pool_id=%).', OLD.pool_id;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_prize_pools_block_delete
BEFORE DELETE ON prize_pools
FOR EACH ROW EXECUTE FUNCTION prize_pools_block_delete();

-- =============================================================================
-- TABLE: prize_pool_entries
-- PURPOSE: Prize entries belonging to a pool. Each has rarity + base_weight.
-- MUTATION POLICY: INSERT only. Re-version by inserting a new pool.
-- =============================================================================
CREATE TABLE IF NOT EXISTS prize_pool_entries (
    entry_id        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id         UUID         NOT NULL,
    prize_slot      VARCHAR(40)  NOT NULL,
    name            VARCHAR(120) NOT NULL,
    description     TEXT         NOT NULL,
    rarity          VARCHAR(20)  NOT NULL
                        CHECK (rarity IN ('COMMON', 'RARE', 'EPIC', 'LEGENDARY')),
    base_weight     NUMERIC(10, 4) NOT NULL CHECK (base_weight > 0),
    asset_url       VARCHAR(500),
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    rule_applied_id VARCHAR(100) NOT NULL DEFAULT 'PRIZE_POOL_v1',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prize_pool_entries_pool_active
    ON prize_pool_entries (pool_id, is_active);
COMMENT ON TABLE prize_pool_entries IS
    'Individual prize entries with rarity and base_weight. Append-only (PHASE-G1).';

CREATE OR REPLACE FUNCTION prize_pool_entries_block_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'prize_pool_entries is append-only: % is not permitted (entry_id=%).',
        TG_OP, OLD.entry_id;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_prize_pool_entries_block_mutation
BEFORE UPDATE OR DELETE ON prize_pool_entries
FOR EACH ROW EXECUTE FUNCTION prize_pool_entries_block_mutation();

-- =============================================================================
-- TABLE: creator_game_configs
-- PURPOSE: Per-creator, per-game configuration: 1-3 token tiers, cooldown
--          override, enable flag, RRR burn opt-in.
-- MUTATION POLICY: INSERT only. New version supersedes prior row.
-- =============================================================================
CREATE TABLE IF NOT EXISTS creator_game_configs (
    config_id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id                 UUID         NOT NULL,
    game_type                  VARCHAR(20)  NOT NULL
                                   CHECK (game_type IN ('SPIN_WHEEL', 'SLOT_MACHINE', 'DICE')),
    token_tiers_csv            VARCHAR(60)  NOT NULL,
    prize_pool_id              UUID         NOT NULL,
    cooldown_seconds_override  INTEGER      CHECK (cooldown_seconds_override IS NULL OR
                                                   cooldown_seconds_override >= 0),
    enabled                    BOOLEAN      NOT NULL DEFAULT TRUE,
    accepts_rrr_burn           BOOLEAN      NOT NULL DEFAULT FALSE,
    version                    VARCHAR(50)  NOT NULL,
    rule_applied_id            VARCHAR(100) NOT NULL DEFAULT 'CREATOR_GAME_CONFIG_v1',
    created_at                 TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_creator_game_configs_creator_game
    ON creator_game_configs (creator_id, game_type, enabled);
COMMENT ON TABLE creator_game_configs IS
    'Per-creator-per-game config: tiers, cooldown, enabled flag (PHASE-G1).';

CREATE OR REPLACE FUNCTION creator_game_configs_block_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'creator_game_configs is append-only: % is not permitted (config_id=%).',
        TG_OP, OLD.config_id;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_creator_game_configs_block_mutation
BEFORE UPDATE OR DELETE ON creator_game_configs
FOR EACH ROW EXECUTE FUNCTION creator_game_configs_block_mutation();

-- =============================================================================
-- TABLE: game_cooldown_logs
-- PURPOSE: Append-only per-user-per-game cooldown ledger. Each play inserts
--          one row; reads compute the latest next_play_at_utc.
-- =============================================================================
CREATE TABLE IF NOT EXISTS game_cooldown_logs (
    log_id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID         NOT NULL,
    creator_id       UUID         NOT NULL,
    game_type        VARCHAR(20)  NOT NULL
                        CHECK (game_type IN ('SPIN_WHEEL', 'SLOT_MACHINE', 'DICE')),
    played_at_utc    TIMESTAMPTZ  NOT NULL,
    next_play_at_utc TIMESTAMPTZ  NOT NULL,
    rule_applied_id  VARCHAR(100) NOT NULL DEFAULT 'GAMIFICATION_COOLDOWN_v1',
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_game_cooldown_logs_lookup
    ON game_cooldown_logs (user_id, creator_id, game_type, next_play_at_utc);
COMMENT ON TABLE game_cooldown_logs IS
    'Per-user-per-game cooldown ledger. Append-only (PHASE-G1).';

CREATE OR REPLACE FUNCTION game_cooldown_logs_block_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'game_cooldown_logs is append-only: % is not permitted (log_id=%).',
        TG_OP, OLD.log_id;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_game_cooldown_logs_block_mutation
BEFORE UPDATE OR DELETE ON game_cooldown_logs
FOR EACH ROW EXECUTE FUNCTION game_cooldown_logs_block_mutation();

-- =============================================================================
-- TABLE: redroom_rewards_burns
-- PURPOSE: Local mirror of every RRR-point burn driven by a game play.
--          correlation_id is the cross-system idempotency key.
-- =============================================================================
CREATE TABLE IF NOT EXISTS redroom_rewards_burns (
    burn_id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                UUID         NOT NULL,
    creator_id             UUID         NOT NULL,
    game_type              VARCHAR(20)  NOT NULL
                              CHECK (game_type IN ('SPIN_WHEEL', 'SLOT_MACHINE', 'DICE')),
    rrr_points_burned      INTEGER      NOT NULL CHECK (rrr_points_burned > 0),
    czt_tokens_equivalent  INTEGER      NOT NULL CHECK (czt_tokens_equivalent > 0),
    correlation_id         VARCHAR(200) NOT NULL UNIQUE,
    reason_code            VARCHAR(40)  NOT NULL DEFAULT 'GAME_PLAY',
    rule_applied_id        VARCHAR(100) NOT NULL DEFAULT 'RRR_BURN_v1',
    burned_at_utc          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_redroom_rewards_burns_user_time
    ON redroom_rewards_burns (user_id, burned_at_utc);
COMMENT ON TABLE redroom_rewards_burns IS
    'Local mirror of RRR-point burns driven by game plays. Append-only (PHASE-G1).';

CREATE OR REPLACE FUNCTION redroom_rewards_burns_block_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'redroom_rewards_burns is append-only: % is not permitted (burn_id=%).',
        TG_OP, OLD.burn_id;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_redroom_rewards_burns_block_mutation
BEFORE UPDATE OR DELETE ON redroom_rewards_burns
FOR EACH ROW EXECUTE FUNCTION redroom_rewards_burns_block_mutation();
