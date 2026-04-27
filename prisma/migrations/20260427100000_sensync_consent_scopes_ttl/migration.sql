-- Migration: SenSync™ consent — granular scopes + ephemerality TTL (Phase 5.3)
--
-- Adds two columns to the existing sensync_consents table:
--   • consent_scopes      — JSONB array of active scopes; default = full set
--                           ['BPM_TO_FFS','BPM_TO_HAPTIC','BPM_TO_CYRANO','BPM_TO_PARTNER'].
--                           A scope can be removed individually (granular
--                           revocation) without revoking the entire row. When
--                           the array becomes empty, the row is treated as
--                           fully revoked and consent_revoked_at is stamped.
--   • consent_expires_at  — UTC timestamp at which the consent auto-expires.
--                           Default lifetime is 24h from grant; the rate-limit
--                           gate refuses samples once this has elapsed and the
--                           in-memory expiry sweeper tombstones the row.
--
-- Both columns are NULL-safe for backfilled rows: existing consent rows
-- predating this migration will have an empty scope set and no expiry, which
-- the service treats as "legacy consent" — still honoured but logged via the
-- audit pipeline.
--
-- Rule authority: SENSYNC_v1
-- Compliance: Quebec Law 25 §28, PIPEDA, GDPR Art. 17

ALTER TABLE sensync_consents
  ADD COLUMN IF NOT EXISTS consent_scopes JSONB
    NOT NULL
    DEFAULT '["BPM_TO_FFS","BPM_TO_HAPTIC","BPM_TO_CYRANO","BPM_TO_PARTNER"]'::jsonb;

ALTER TABLE sensync_consents
  ADD COLUMN IF NOT EXISTS consent_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_sensync_consents_expires_at
  ON sensync_consents (consent_expires_at);

COMMENT ON COLUMN sensync_consents.consent_scopes IS
  'Phase 5.3 — JSONB array of active consent scopes. Granular revocation '
  'removes a scope without revoking the row.';

COMMENT ON COLUMN sensync_consents.consent_expires_at IS
  'Phase 5.3 — UTC timestamp at which the consent row auto-expires '
  '(ephemerality). Default lifetime is 24h. Configurable in [60s..7d].';
