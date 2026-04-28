-- FIZ/GOV: legal_holds.correlation_id remediation
-- REASON:  OQMI_SYSTEM_STATE.md §7 flagged correlation_id missing from
--          legal_holds, breaking the financial/audit invariant that every
--          row carries an idempotency key.
-- IMPACT:  Adds correlation_id VARCHAR(64) NOT NULL to legal_holds and
--          backs an index for lookup. Existing rows (none expected pre-Alpha)
--          are backfilled with a deterministic 'BACKFILL_<id>' marker so the
--          NOT NULL constraint can be enforced without manual intervention.
-- CORRELATION_ID: legal-holds-correlation-id-2026-04-28

ALTER TABLE "legal_holds" ADD COLUMN "correlation_id" VARCHAR(64);

UPDATE "legal_holds"
   SET "correlation_id" = 'BACKFILL_' || "id"
 WHERE "correlation_id" IS NULL;

ALTER TABLE "legal_holds" ALTER COLUMN "correlation_id" SET NOT NULL;

CREATE INDEX "legal_holds_correlation_id_idx" ON "legal_holds"("correlation_id");
