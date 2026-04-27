-- FIZ: RBAC-STUDIO-001 — Studio Onboarding + Affiliation + RBAC
-- REASON: Tech spec "Studio Onboarding & RBAC System" — adds Studio,
--         StudioAffiliation, CreatorOnboarding, StudioContractDocument
--         tables plus four enums; extends creators with affiliation_number.
-- IMPACT: All new tables. Existing creators rows get a NULLABLE
--         affiliation_number column (no backfill needed). Multi-tenant
--         columns (organization_id, tenant_id) are NOT NULL on every new
--         table per Canonical Corpus L0 invariants.
-- CORRELATION_ID: RBAC-STUDIO-001-INITIAL-MIGRATION
-- RULE_APPLIED_ID: STUDIO_AFFILIATION_v1

-- ── Enums ────────────────────────────────────────────────────────────────
CREATE TYPE "StudioStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'CLOSED');
CREATE TYPE "StudioRole" AS ENUM ('STUDIO_OWNER', 'STUDIO_ADMIN', 'CREATOR');
CREATE TYPE "AffiliationStatus" AS ENUM ('ACTIVE', 'PENDING', 'REVOKED');
CREATE TYPE "OnboardingStatus" AS ENUM ('PENDING', 'AFFILIATED', 'COMPLETE');
CREATE TYPE "StudioContractStatus" AS ENUM ('UPLOADED', 'SIGNED', 'COUNTERSIGNED', 'VOIDED');

-- ── creators: add affiliation_number (denormalised mirror) ───────────────
ALTER TABLE "creators"
  ADD COLUMN IF NOT EXISTS "affiliation_number" VARCHAR(9);

CREATE INDEX IF NOT EXISTS "creators_affiliation_number_idx"
  ON "creators" ("affiliation_number");

-- ── studios ──────────────────────────────────────────────────────────────
CREATE TABLE "studios" (
  "id"                  TEXT             NOT NULL PRIMARY KEY,
  "name"                VARCHAR(200)     NOT NULL,
  "affiliation_number"  VARCHAR(9)       NOT NULL,
  "status"              "StudioStatus"   NOT NULL DEFAULT 'PENDING',
  "commission_rate"     DECIMAL(5, 4)    NOT NULL DEFAULT 0.0000,
  "organization_id"     VARCHAR(100)     NOT NULL,
  "tenant_id"           VARCHAR(100)     NOT NULL,
  "correlation_id"      VARCHAR(128)     NOT NULL,
  "reason_code"         VARCHAR(64)      NOT NULL,
  "rule_applied_id"     VARCHAR(100)     NOT NULL,
  "created_at"          TIMESTAMPTZ      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMPTZ      NOT NULL,

  CONSTRAINT "studios_affiliation_number_unique" UNIQUE ("affiliation_number"),
  -- Length + alphabet enforced at the application layer, plus this CHECK.
  -- Allowed: 6-9 chars from {A-Z, 2-9}. Excludes 0, 1, O, I.
  CONSTRAINT "studios_affiliation_number_alphabet_chk"
    CHECK ("affiliation_number" ~ '^[A-HJ-NP-Z2-9]{6,9}$'),
  CONSTRAINT "studios_commission_rate_bounds_chk"
    CHECK ("commission_rate" >= 0.0000 AND "commission_rate" <= 1.0000)
);

CREATE INDEX "studios_affiliation_number_idx" ON "studios" ("affiliation_number");
CREATE INDEX "studios_status_org_idx" ON "studios" ("status", "organization_id");

-- ── studio_affiliations ──────────────────────────────────────────────────
CREATE TABLE "studio_affiliations" (
  "id"               TEXT                NOT NULL PRIMARY KEY,
  "studio_id"        TEXT                NOT NULL,
  "creator_id"       TEXT                NOT NULL,
  "role"             "StudioRole"        NOT NULL DEFAULT 'CREATOR',
  "status"           "AffiliationStatus" NOT NULL DEFAULT 'ACTIVE',
  "joined_at"        TIMESTAMPTZ         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "correlation_id"   VARCHAR(128)        NOT NULL,
  "reason_code"      VARCHAR(64)         NOT NULL,
  "rule_applied_id"  VARCHAR(100)        NOT NULL,
  "organization_id"  VARCHAR(100)        NOT NULL,
  "tenant_id"        VARCHAR(100)        NOT NULL,
  "created_at"       TIMESTAMPTZ         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMPTZ         NOT NULL,

  CONSTRAINT "studio_affiliations_unique" UNIQUE ("studio_id", "creator_id"),
  CONSTRAINT "studio_affiliations_studio_fk"
    FOREIGN KEY ("studio_id") REFERENCES "studios"("id") ON DELETE RESTRICT,
  CONSTRAINT "studio_affiliations_creator_fk"
    FOREIGN KEY ("creator_id") REFERENCES "creators"("id") ON DELETE RESTRICT
);

CREATE INDEX "studio_affiliations_creator_idx" ON "studio_affiliations" ("creator_id");
CREATE INDEX "studio_affiliations_status_role_idx"
  ON "studio_affiliations" ("status", "role");

-- ── creator_onboardings ──────────────────────────────────────────────────
CREATE TABLE "creator_onboardings" (
  "id"                 TEXT                NOT NULL PRIMARY KEY,
  "creator_id"         TEXT                NOT NULL,
  "studio_id"          TEXT,
  "affiliation_number" VARCHAR(9),
  "status"             "OnboardingStatus"  NOT NULL DEFAULT 'PENDING',
  "secondary_email"    VARCHAR(255),
  "email_verified_at"  TIMESTAMPTZ,
  "email_block_reason" VARCHAR(64),
  "correlation_id"     VARCHAR(128)        NOT NULL,
  "reason_code"        VARCHAR(64)         NOT NULL,
  "rule_applied_id"    VARCHAR(100)        NOT NULL,
  "organization_id"    VARCHAR(100)        NOT NULL,
  "tenant_id"          VARCHAR(100)        NOT NULL,
  "created_at"         TIMESTAMPTZ         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"         TIMESTAMPTZ         NOT NULL,

  CONSTRAINT "creator_onboardings_creator_unique" UNIQUE ("creator_id"),
  CONSTRAINT "creator_onboardings_creator_fk"
    FOREIGN KEY ("creator_id") REFERENCES "creators"("id") ON DELETE RESTRICT,
  CONSTRAINT "creator_onboardings_studio_fk"
    FOREIGN KEY ("studio_id") REFERENCES "studios"("id") ON DELETE SET NULL
);

CREATE INDEX "creator_onboardings_aff_idx" ON "creator_onboardings" ("affiliation_number");
CREATE INDEX "creator_onboardings_status_idx" ON "creator_onboardings" ("status");

-- ── studio_contract_documents ────────────────────────────────────────────
CREATE TABLE "studio_contract_documents" (
  "id"                TEXT                   NOT NULL PRIMARY KEY,
  "studio_id"         TEXT                   NOT NULL,
  "creator_id"        TEXT                   NOT NULL,
  "storage_uri"       VARCHAR(500)           NOT NULL,
  "document_hash"     CHAR(64)               NOT NULL,
  "status"            "StudioContractStatus" NOT NULL DEFAULT 'UPLOADED',
  "signed_typed_name" VARCHAR(200),
  "signed_at"         TIMESTAMPTZ,
  "correlation_id"    VARCHAR(128)           NOT NULL,
  "reason_code"       VARCHAR(64)            NOT NULL,
  "rule_applied_id"   VARCHAR(100)           NOT NULL,
  "organization_id"   VARCHAR(100)           NOT NULL,
  "tenant_id"         VARCHAR(100)           NOT NULL,
  "created_at"        TIMESTAMPTZ            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMPTZ            NOT NULL,

  CONSTRAINT "studio_contract_documents_studio_fk"
    FOREIGN KEY ("studio_id") REFERENCES "studios"("id") ON DELETE RESTRICT
);

CREATE INDEX "studio_contract_documents_studio_status_idx"
  ON "studio_contract_documents" ("studio_id", "status");
CREATE INDEX "studio_contract_documents_creator_idx"
  ON "studio_contract_documents" ("creator_id");
