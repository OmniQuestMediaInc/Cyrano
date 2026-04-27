-- CRM: Fan Fervor Score (FFS) schema migration
-- Business Plan §B.4 — per-guest engagement score emitted via NATS.
--
-- Tables created:
--   fan_fervor_scores — per-guest per-session FFS snapshots (append-only)

-- ── fan_fervor_scores ─────────────────────────────────────────────────────────

CREATE TABLE "fan_fervor_scores" (
    "id"                 UUID         NOT NULL DEFAULT gen_random_uuid(),
    "guest_id"           UUID         NOT NULL,
    "session_id"         VARCHAR(100) NOT NULL,
    -- Composite Fan Fervor Score 0–100.
    "ffs_score"          INTEGER      NOT NULL,
    -- Resolved tier: COLD | WARM | HOT | INFERNO.
    "ffs_tier"           VARCHAR(10)  NOT NULL,
    -- Raw base score before SenSync™/HeartSync boost.
    "base_score"         INTEGER      NOT NULL,
    -- Points added by the HeartSync biometric boost (0 if not opted in).
    "heartsync_boost"    INTEGER      NOT NULL DEFAULT 0,
    -- Whether the guest had active HeartSync biometric consent for this score.
    "heartsync_opted_in" BOOLEAN      NOT NULL DEFAULT FALSE,
    "correlation_id"     VARCHAR(100) NOT NULL,
    "rule_applied_id"    VARCHAR(100) NOT NULL,
    "scored_at"          TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fan_fervor_scores_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "fan_fervor_scores_guest_id_scored_at_idx"
    ON "fan_fervor_scores" ("guest_id", "scored_at");

CREATE INDEX "fan_fervor_scores_session_id_scored_at_idx"
    ON "fan_fervor_scores" ("session_id", "scored_at");

CREATE INDEX "fan_fervor_scores_ffs_tier_scored_at_idx"
    ON "fan_fervor_scores" ("ffs_tier", "scored_at");
