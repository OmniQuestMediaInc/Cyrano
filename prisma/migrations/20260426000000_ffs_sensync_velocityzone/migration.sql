-- Migration: 20260426000000_ffs_sensync_velocityzone
-- Scope: Flicker n'Flame Scoring (FFS), SenSync™ biometric layer, VelocityZone
--
-- Changes:
--   1. Add token_type column to token_balances (Single CZT enforcement)
--   2. Create ffs_snapshots (replaces room_heat_snapshots for new service)
--   3. Create ffs_adaptive_weights (replaces room_heat_adaptive_weights for new service)
--   4. Create sensync_tier_configs (replaces heartsync_tier_configs for new service)
--   5. Create sensync_consents (new — consent audit log per Law 25 / GDPR Art. 9)
--   6. Create creator_rate_tiers (new — FIS-scoped payout rate table)
--   7. Create velocityzone_events (new — admin-defined timed payout events)
--
-- Invariants:
--   • room_heat_snapshots, room_heat_adaptive_weights, heartsync_tier_configs
--     are RETAINED (not dropped) to preserve historical data. Services no
--     longer write to them; they are read-only legacy tables.
--   • All new tables include correlation_id and reason_code (OQMI invariant).
--   • creator_rate_tiers is FIZ-scoped (payout mutations touch this table).
--   • sensync_consents is append-only by application convention.
--   • No UPDATE/DELETE triggers added here — enforced in service layer.

-- ── 1. Single CZT token type enforcement ─────────────────────────────────────

ALTER TABLE token_balances
  ADD COLUMN IF NOT EXISTS token_type VARCHAR(10) NOT NULL DEFAULT 'CZT';

CREATE INDEX IF NOT EXISTS idx_token_balances_token_type
  ON token_balances (token_type);

COMMENT ON COLUMN token_balances.token_type IS
  'Single-token economy: always CZT. Enforced at application layer. '
  'Do not store any value other than CZT.';

-- ── 2. FFS Snapshots ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ffs_snapshots (
  id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id      VARCHAR(200) NOT NULL,
  creator_id      UUID        NOT NULL,
  ffs_score       DECIMAL(5,2) NOT NULL,
  ffs_tier        VARCHAR(20)  NOT NULL,
  components      JSONB        NOT NULL,
  correlation_id  VARCHAR(128) NOT NULL,
  reason_code     VARCHAR(100) NOT NULL,
  is_dual_flame   BOOLEAN      NOT NULL DEFAULT false,
  rule_applied_id VARCHAR(100) NOT NULL DEFAULT 'FFS_ENGINE_v1',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ffs_snapshots_session_created
  ON ffs_snapshots (session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_ffs_snapshots_creator_created
  ON ffs_snapshots (creator_id, created_at);

COMMENT ON TABLE ffs_snapshots IS
  'Append-only time-series of every FFS score computed. '
  'Replaces room_heat_snapshots for new FFS service. Rule: FFS_ENGINE_v1.';

-- ── 3. FFS Adaptive Weights ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ffs_adaptive_weights (
  id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id      UUID        NOT NULL UNIQUE,
  weights         JSONB        NOT NULL,
  tip_events_seen INTEGER      NOT NULL DEFAULT 0,
  last_updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  correlation_id  VARCHAR(128) NOT NULL,
  reason_code     VARCHAR(100) NOT NULL DEFAULT 'FFS_ADAPTIVE_INIT',
  rule_applied_id VARCHAR(100) NOT NULL DEFAULT 'FFS_ENGINE_v1',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ffs_adaptive_weights IS
  'Per-creator learned scoring multipliers (0.80–1.20). '
  'One row per creator. tip_events_seen is monotonically incrementing.';

-- ── 4. SenSync™ Tier Configs ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sensync_tier_configs (
  id             UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tier           VARCHAR(40)  NOT NULL,
  enabled        BOOLEAN      NOT NULL DEFAULT false,
  combined_mode  BOOLEAN      NOT NULL DEFAULT false,
  correlation_id VARCHAR(100) NOT NULL,
  reason_code    VARCHAR(100) NOT NULL,
  updated_by     UUID         NOT NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_sensync_tier UNIQUE (tier)
);

CREATE INDEX IF NOT EXISTS idx_sensync_tier_configs_tier_enabled
  ON sensync_tier_configs (tier, enabled);

COMMENT ON TABLE sensync_tier_configs IS
  'Per-tier on/off toggle for SenSync™ biometric relay. '
  'Replaces heartsync_tier_configs for new SenSync™ service.';

-- ── 5. SenSync™ Consents ─────────────────────────────────────────────────────
-- Law 25 / GDPR Article 9 compliance. Immutable by application convention.

CREATE TABLE IF NOT EXISTS sensync_consents (
  id                 UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consent_id         UUID         NOT NULL UNIQUE,
  session_id         VARCHAR(200)  NOT NULL,
  creator_id         UUID          NOT NULL,
  guest_id           UUID,
  basis              VARCHAR(30)   NOT NULL,       -- 'EXPLICIT_OPT_IN' only
  consent_version    VARCHAR(20)   NOT NULL,
  purpose_scope      VARCHAR(30)   NOT NULL,       -- 'ALL' | 'FFS_SCORING' | ...
  device_ids         TEXT[]        NOT NULL DEFAULT '{}',
  ip_hash            CHAR(64),                     -- SHA-256 only; never raw IP
  device_fingerprint VARCHAR(255),
  granted_at         TIMESTAMPTZ   NOT NULL,
  revoked_at         TIMESTAMPTZ,                  -- null until revoked
  correlation_id     VARCHAR(128)  NOT NULL,
  reason_code        VARCHAR(100)  NOT NULL,
  rule_applied_id    VARCHAR(100)  NOT NULL DEFAULT 'SENSYNC_v1',
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sensync_consents_session
  ON sensync_consents (session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_sensync_consents_creator
  ON sensync_consents (creator_id, granted_at);

CREATE INDEX IF NOT EXISTS idx_sensync_consents_guest
  ON sensync_consents (guest_id, granted_at);

COMMENT ON TABLE sensync_consents IS
  'Consent grant/revocation audit log for SenSync™ biometric relay. '
  'Raw BPM data is NEVER stored here — metadata only. '
  'Append-only: grants add rows; revocations update revoked_at only. '
  'Required for Quebec Law 25, GDPR Article 9, CCPA/CPRA compliance.';

COMMENT ON COLUMN sensync_consents.basis IS
  'Always EXPLICIT_OPT_IN for active consents; REVOKED tombstones not stored '
  '(revoked_at timestamp is used instead).';

COMMENT ON COLUMN sensync_consents.ip_hash IS
  'SHA-256 hash of guest IP address. Raw IP is never stored.';

-- ── 6. Creator Rate Tiers (FIZ-scoped) ───────────────────────────────────────
-- Any UPDATE to this table is a FIZ-scoped event.
-- Append-only by design: close old rows via effective_to; insert new row.

CREATE TABLE IF NOT EXISTS creator_rate_tiers (
  id               UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tier_id          UUID          NOT NULL UNIQUE,
  creator_id       UUID          NOT NULL,
  tier_name        VARCHAR(30)   NOT NULL,  -- 'FOUNDING' | 'STANDARD' | 'POST_DAY_61'
  rate_floor_usd   DECIMAL(8,6)  NOT NULL,
  rate_ceiling_usd DECIMAL(8,6)  NOT NULL,
  effective_from   TIMESTAMPTZ   NOT NULL,
  effective_to     TIMESTAMPTZ,             -- null = currently active
  correlation_id   VARCHAR(128)  NOT NULL,
  reason_code      VARCHAR(100)  NOT NULL,
  rule_applied_id  VARCHAR(100)  NOT NULL DEFAULT 'VELOCITYZONE_v1',
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creator_rate_tiers_creator
  ON creator_rate_tiers (creator_id, effective_from);

CREATE INDEX IF NOT EXISTS idx_creator_rate_tiers_tier_name
  ON creator_rate_tiers (tier_name);

COMMENT ON TABLE creator_rate_tiers IS
  'FIZ-scoped: per-creator payout rate bands. '
  'Append-only: close old rows via effective_to, insert new row on promotion. '
  'Any mutation requires REASON/IMPACT/CORRELATION_ID in commit message.';

-- ── 7. VelocityZone Events ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS velocityzone_events (
  id               UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id         UUID          NOT NULL UNIQUE,
  name             VARCHAR(100)  NOT NULL,
  starts_at        TIMESTAMPTZ   NOT NULL,
  ends_at          TIMESTAMPTZ   NOT NULL,
  rate_floor_usd   DECIMAL(8,6)  NOT NULL DEFAULT 0.075000,
  rate_ceiling_usd DECIMAL(8,6)  NOT NULL DEFAULT 0.090000,
  creator_ids      UUID[]        NOT NULL DEFAULT '{}',  -- empty = all creators
  status           VARCHAR(20)   NOT NULL DEFAULT 'SCHEDULED',
  created_by       UUID          NOT NULL,
  correlation_id   VARCHAR(128)  NOT NULL,
  reason_code      VARCHAR(100)  NOT NULL,
  rule_applied_id  VARCHAR(100)  NOT NULL DEFAULT 'VELOCITYZONE_v1',
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_velocityzone_events_active
  ON velocityzone_events (status, starts_at, ends_at);

COMMENT ON TABLE velocityzone_events IS
  'Admin-defined time-window VelocityZone events. '
  'FFS score maps linearly to rate_floor_usd → rate_ceiling_usd during the window. '
  'Rate is locked at tip processing time.';
