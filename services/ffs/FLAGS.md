# Flicker n'Flame Scoring (FFS) — FLAGS

**Work Order:** WO-003  
**Rule ID:** `FFS_ENGINE_v2`

Feature flags and deferred capabilities for the Flicker n'Flame Scoring (FFS).

---

## Active Flags (default state)

| Flag | Default | Description |
|------|---------|-------------|
| `FFS_ANTI_FLICKER_TICKS` | `3` | Ticks required to confirm a tier change. Hard-coded constant — change requires rule_applied_id bump. |
| `FFS_EARLY_PHASE_MINUTES` | `5` | Session age threshold for the early-phase generosity boost. |
| `FFS_EARLY_PHASE_BOOST` | `1.10` | Multiplier applied during the early phase (10 % boost). |
| `FFS_DUAL_FLAME_PARTNER_MAX_BONUS` | `5` | Maximum pts contributed by partner's score in a Dual Flame session. |
| `FFS_HOT_AND_READY_MIN_SCORE` | `70` | Minimum score to qualify for the Hot and Ready leaderboard slot. |
| `FFS_HOT_AND_READY_MIN_DWELL` | `10` | Minimum dwell (minutes) to qualify for Hot and Ready. |
| `FFS_NEW_FLAMES_MAX_DWELL` | `15` | Maximum dwell (minutes) for New Flames category. |
| `FFS_ADAPTIVE_BOOST_ON_TIP` | `0.02` | Per-tip weight boost for elevated signals (+2 %). |
| `FFS_ADAPTIVE_DECAY_ON_TIP` | `0.005` | Per-tip weight decay for non-elevated signals (−0.5 %). |
| `FFS_ADAPTIVE_ELEVATION_THRESHOLD` | `0.70` | Signal elevation threshold at tip moment (70 % of normalised max). |

---

## Deferred / Future Flags

| Flag | Trigger condition | Description |
|------|-------------------|-------------|
| `FFS_PERSISTENT_LEADERBOARD` | Post-launch requirement | Persist leaderboard state to `room_heat_leaderboard_entries` DB table for restart-safety. |
| `FFS_REDIS_WINDOWS` | Volume scaling | Move rolling-window aggregations (tips/min, chat/min, hearts/min) from caller-provided inputs to Redis ZADD windows within the engine. |
| `FFS_CYRANO_DIRECT_INJECT` | Cyrano L2 integration | Allow the engine to directly call `CyranoService.evaluate()` instead of emitting via NATS + Hub. |
| `FFS_WEBHOOK_SNAPSHOT_EXPORT` | Compliance request | Export ffs_snapshots to WORM storage on session end. |
| `FFS_ML_WEIGHTS` | ML pipeline ready | Replace static adaptive weight learning with an ML-trained model inference call. |
