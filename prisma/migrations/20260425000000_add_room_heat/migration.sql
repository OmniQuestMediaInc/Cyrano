-- WO-003 — Room-Heat Engine: schema migration
-- Business Plan B.4 — real-time composite heat score persistence.
-- Two tables:
--   room_heat_snapshots        — append-only time-series heat score samples
--   room_heat_adaptive_weights — per-creator adaptive scoring multipliers

-- ── room_heat_snapshots ────────────────────────────────────────────────────────
CREATE TABLE "room_heat_snapshots" (
    "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
    "session_id"      VARCHAR(200) NOT NULL,
    "creator_id"      UUID         NOT NULL,
    "heat_score"      DECIMAL(5,2) NOT NULL,
    "heat_tier"       VARCHAR(20)  NOT NULL,
    -- JSON object of HeatScoreComponents (13 component keys + values).
    "components"      JSONB        NOT NULL,
    "correlation_id"  VARCHAR(128) NOT NULL,
    "reason_code"     VARCHAR(100) NOT NULL,
    "is_dual_flame"   BOOLEAN      NOT NULL DEFAULT FALSE,
    "rule_applied_id" VARCHAR(100) NOT NULL DEFAULT 'ROOM_HEAT_ENGINE_v2',
    "created_at"      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "room_heat_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "room_heat_snapshots_session_created_idx"
    ON "room_heat_snapshots" ("session_id", "created_at");

CREATE INDEX "room_heat_snapshots_creator_created_idx"
    ON "room_heat_snapshots" ("creator_id", "created_at");

-- heat_tier CHECK constraint guards against drift from the canonical enum.
ALTER TABLE "room_heat_snapshots"
    ADD CONSTRAINT "room_heat_snapshots_tier_check"
    CHECK ("heat_tier" IN ('COLD', 'WARM', 'HOT', 'INFERNO'));

-- ── room_heat_adaptive_weights ─────────────────────────────────────────────────
CREATE TABLE "room_heat_adaptive_weights" (
    "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
    -- One row per creator. Unique enforced — upsert path in service.
    "creator_id"      UUID         NOT NULL,
    -- JSON Record<string, number> — multiplier per scoring component key.
    "weights"         JSONB        NOT NULL,
    -- Monotonic counter incremented on each tip event that drives learning.
    "tip_events_seen" INTEGER      NOT NULL DEFAULT 0,
    "last_updated_at" TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correlation_id"  VARCHAR(128) NOT NULL,
    "reason_code"     VARCHAR(100) NOT NULL DEFAULT 'ADAPTIVE_INIT',
    "rule_applied_id" VARCHAR(100) NOT NULL DEFAULT 'ROOM_HEAT_ADAPTIVE_v1',
    "created_at"      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "room_heat_adaptive_weights_pkey"    PRIMARY KEY ("id"),
    CONSTRAINT "room_heat_adaptive_weights_creator" UNIQUE      ("creator_id")
);
