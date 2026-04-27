-- PAYLOAD 6 — Immutable Audit Architecture + RBAC + Canonical Compliance Lockdown
-- Canonical Corpus v10 Chapter 7 §5 + Appendix D/H.
-- Append-only. Hash-chained. DB triggers reject UPDATE and DELETE.
-- Emission + chain integrity is enforced at the service layer
-- (services/core-api/src/audit/immutable-audit.service.ts).

CREATE TABLE "immutable_audit_events" (
    "event_id"        UUID         NOT NULL DEFAULT gen_random_uuid(),
    "event_type"      VARCHAR(64)  NOT NULL,
    "correlation_id"  VARCHAR(128) NOT NULL,
    "actor_id"        VARCHAR(128) NOT NULL,
    "actor_role"      VARCHAR(32)  NOT NULL,
    "reason_code"     VARCHAR(64)  NOT NULL,
    "payload_hash"    CHAR(64)     NOT NULL,
    "hash_prior"      CHAR(64),
    "hash_current"    CHAR(64)     NOT NULL,
    "sequence_number" BIGINT       NOT NULL,
    "metadata"        JSONB,
    "rule_applied_id" VARCHAR(100) NOT NULL,
    "created_at"      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "immutable_audit_events_pkey" PRIMARY KEY ("event_id")
);
CREATE UNIQUE INDEX "immutable_audit_events_correlation_id_key"  ON "immutable_audit_events"("correlation_id");
CREATE UNIQUE INDEX "immutable_audit_events_sequence_number_key" ON "immutable_audit_events"("sequence_number");
CREATE        INDEX "immutable_audit_events_type_created_idx"    ON "immutable_audit_events"("event_type","created_at");
CREATE        INDEX "immutable_audit_events_actor_type_idx"      ON "immutable_audit_events"("actor_id","event_type");

-- Append-only enforcement: no UPDATE or DELETE permitted.
CREATE OR REPLACE FUNCTION reject_immutable_audit_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'immutable_audit_events is append-only — mutation rejected';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER immutable_audit_events_no_update
    BEFORE UPDATE ON "immutable_audit_events"
    FOR EACH ROW EXECUTE FUNCTION reject_immutable_audit_mutation();
CREATE TRIGGER immutable_audit_events_no_delete
    BEFORE DELETE ON "immutable_audit_events"
    FOR EACH ROW EXECUTE FUNCTION reject_immutable_audit_mutation();


CREATE TABLE "worm_export_records" (
    "export_id"          VARCHAR(128) NOT NULL,
    "from_utc"           TIMESTAMPTZ  NOT NULL,
    "to_utc"             TIMESTAMPTZ  NOT NULL,
    "first_event_id"     UUID         NOT NULL,
    "last_event_id"      UUID         NOT NULL,
    "first_sequence"     BIGINT       NOT NULL,
    "last_sequence"      BIGINT       NOT NULL,
    "event_count"        INTEGER      NOT NULL,
    "hash_seal"          CHAR(64)     NOT NULL,
    "storage_uri"        VARCHAR(512),
    "integrity_verified" BOOLEAN      NOT NULL DEFAULT TRUE,
    "rule_applied_id"    VARCHAR(100) NOT NULL,
    "exported_at"        TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "worm_export_records_pkey" PRIMARY KEY ("export_id")
);
CREATE INDEX "worm_export_records_exported_at_idx" ON "worm_export_records"("exported_at");

CREATE OR REPLACE FUNCTION reject_worm_export_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'worm_export_records is append-only — mutation rejected';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER worm_export_records_no_update
    BEFORE UPDATE ON "worm_export_records"
    FOR EACH ROW EXECUTE FUNCTION reject_worm_export_mutation();
CREATE TRIGGER worm_export_records_no_delete
    BEFORE DELETE ON "worm_export_records"
    FOR EACH ROW EXECUTE FUNCTION reject_worm_export_mutation();
