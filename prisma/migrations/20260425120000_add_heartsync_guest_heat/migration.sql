-- HZ + CRM: HeartSync + Guest-Heat schema migration
-- Business Plan §HZ + §B.4 — biometric relay tier config, room effects,
-- whale profiling, and gemstone award tables.
--
-- Tables created:
--   heartsync_tier_configs  — per-tier HeartSync feature toggles
--   room_effect_configs     — room-level visual/haptic effect config
--   whale_profiles          — guest spending intelligence (append-heavy)
--   gemstone_awards         — queued symbolic gifts to guests

-- ── heartsync_tier_configs ────────────────────────────────────────────────────
CREATE TABLE "heartsync_tier_configs" (
    "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
    "tier"           VARCHAR(40)  NOT NULL,
    "enabled"        BOOLEAN      NOT NULL DEFAULT FALSE,
    "combined_mode"  BOOLEAN      NOT NULL DEFAULT FALSE,
    "correlation_id" VARCHAR(100) NOT NULL,
    "reason_code"    VARCHAR(100) NOT NULL,
    "updated_by"     UUID         NOT NULL,
    "created_at"     TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "heartsync_tier_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "heartsync_tier_configs_tier_key"
    ON "heartsync_tier_configs" ("tier");

CREATE INDEX "heartsync_tier_configs_tier_enabled_idx"
    ON "heartsync_tier_configs" ("tier", "enabled");

-- Seed default tier rows — all disabled, combined_mode off.
-- Operators must enable tiers via platform admin after deployment.
DO $$
DECLARE
  seed_actor UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  INSERT INTO "heartsync_tier_configs"
    ("tier", "enabled", "combined_mode", "correlation_id", "reason_code", "updated_by")
  VALUES
    ('GUEST',              FALSE, FALSE, 'SEED-HZ-001', 'INITIAL_SEED', seed_actor),
    ('VIP',                FALSE, FALSE, 'SEED-HZ-002', 'INITIAL_SEED', seed_actor),
    ('VIP_SILVER',         FALSE, FALSE, 'SEED-HZ-003', 'INITIAL_SEED', seed_actor),
    ('VIP_SILVER_BULLET',  FALSE, FALSE, 'SEED-HZ-004', 'INITIAL_SEED', seed_actor),
    ('VIP_GOLD',           FALSE, FALSE, 'SEED-HZ-005', 'INITIAL_SEED', seed_actor),
    ('VIP_PLATINUM',       FALSE, FALSE, 'SEED-HZ-006', 'INITIAL_SEED', seed_actor),
    ('VIP_DIAMOND',        FALSE, FALSE, 'SEED-HZ-007', 'INITIAL_SEED', seed_actor)
  ON CONFLICT ("tier") DO NOTHING;
END $$;

-- ── room_effect_configs ───────────────────────────────────────────────────────
CREATE TABLE "room_effect_configs" (
    "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
    "room_id"        VARCHAR(100) NOT NULL,
    "effect_type"    VARCHAR(60)  NOT NULL,
    "enabled"        BOOLEAN      NOT NULL DEFAULT TRUE,
    "parameters"     JSONB,
    "correlation_id" VARCHAR(100) NOT NULL,
    "reason_code"    VARCHAR(100) NOT NULL,
    "created_at"     TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "room_effect_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "room_effect_configs_room_effect_key"
    ON "room_effect_configs" ("room_id", "effect_type");

CREATE INDEX "room_effect_configs_room_idx"
    ON "room_effect_configs" ("room_id");

-- ── whale_profiles ────────────────────────────────────────────────────────────
-- Append-heavy: new row on each rescore event. Never updated in-place.
CREATE TABLE "whale_profiles" (
    "id"               UUID          NOT NULL DEFAULT gen_random_uuid(),
    "guest_id"         UUID          NOT NULL,
    "loyalty_tier"     VARCHAR(30)   NOT NULL,
    "whale_score"      DECIMAL(5,2)  NOT NULL,
    "spend_24h"        DECIMAL(14,4) NOT NULL DEFAULT 0,
    "spend_72h"        DECIMAL(14,4) NOT NULL DEFAULT 0,
    "spend_7d"         DECIMAL(14,4) NOT NULL DEFAULT 0,
    "spend_14d"        DECIMAL(14,4) NOT NULL DEFAULT 0,
    "spend_30d"        DECIMAL(14,4) NOT NULL DEFAULT 0,
    "preference_vector" JSONB,
    "geo_region"       VARCHAR(10),
    "correlation_id"   VARCHAR(100)  NOT NULL,
    "reason_code"      VARCHAR(100)  NOT NULL,
    "rule_applied_id"  VARCHAR(100)  NOT NULL,
    "scored_at"        TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at"       TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "whale_profiles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "whale_profiles_guest_scored_idx"
    ON "whale_profiles" ("guest_id", "scored_at");

CREATE INDEX "whale_profiles_loyalty_scored_idx"
    ON "whale_profiles" ("loyalty_tier", "scored_at");

-- whale_score range guard
ALTER TABLE "whale_profiles"
    ADD CONSTRAINT "whale_profiles_score_check"
    CHECK ("whale_score" >= 0 AND "whale_score" <= 100);

-- loyalty_tier enum guard
ALTER TABLE "whale_profiles"
    ADD CONSTRAINT "whale_profiles_loyalty_tier_check"
    CHECK ("loyalty_tier" IN (
        'STANDARD', 'RISING', 'WARM', 'HOT', 'WHALE', 'ULTRA_WHALE'
    ));

-- ── gemstone_awards ───────────────────────────────────────────────────────────
-- Append-only: delivery state progression tracked via reason_code.
CREATE TABLE "gemstone_awards" (
    "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
    "guest_id"        UUID         NOT NULL,
    "session_id"      VARCHAR(100),
    "gem_type"        VARCHAR(40)  NOT NULL,
    "symbolism"       VARCHAR(255) NOT NULL,
    "visibility"      VARCHAR(20)  NOT NULL DEFAULT 'PUBLIC',
    "status"          VARCHAR(20)  NOT NULL DEFAULT 'QUEUED',
    "sent_at"         TIMESTAMPTZ,
    "send_delay_sec"  INT          NOT NULL DEFAULT 0,
    "correlation_id"  VARCHAR(100) NOT NULL,
    "reason_code"     VARCHAR(100) NOT NULL,
    "rule_applied_id" VARCHAR(100) NOT NULL,
    "created_at"      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "gemstone_awards_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "gemstone_awards_guest_status_idx"
    ON "gemstone_awards" ("guest_id", "status");

CREATE INDEX "gemstone_awards_session_status_idx"
    ON "gemstone_awards" ("session_id", "status");

-- visibility enum guard
ALTER TABLE "gemstone_awards"
    ADD CONSTRAINT "gemstone_awards_visibility_check"
    CHECK ("visibility" IN ('PUBLIC', 'PRIVATE'));

-- status enum guard
ALTER TABLE "gemstone_awards"
    ADD CONSTRAINT "gemstone_awards_status_check"
    CHECK ("status" IN ('QUEUED', 'SENT', 'VIEWED', 'DECLINED'));
