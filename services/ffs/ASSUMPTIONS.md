# Flicker n'Flame Scoring (FFS) — ASSUMPTIONS

**Work Order:** WO-003  
**Rule ID:** `FFS_ENGINE_v2`

This file documents design assumptions that cannot be verified purely from the
codebase.  Any assumption challenged by a future CEO directive or governance
amendment requires a `CHORE: bump rule_applied_id` commit.

---

## Signal Inputs

1. **`tips_per_min`** — assumed to be a rolling 60-second window computed by
   the caller (creator-control or tip.service). The engine does not own this
   aggregation.

2. **`heart_rate_bpm`** — provided by the SenSync™ BPM update subscription
   (`HZ_BPM_UPDATE` NATS topic). If the creator's band is unpaired, callers
   MUST set `heart_rate_bpm = heart_rate_baseline_bpm` to contribute zero
   delta (i.e. pass `0` for both fields).

3. **`eye_tracking_score`**, **`facial_excitement_score`**, **`motion_score`**,
   **`skin_exposure_score`** — assumed to be provided by `vision-monitor/` in
   the range `[0, 1]`.  Out-of-range values are clamped internally.

4. **`audio_vocal_ratio`** — assumed to be `1.0` for a fully vocal track and
   `0.0` for background music only.  The audio pipeline is responsible for
   real-time VAD (Voice Activity Detection).

5. **`heat_trend_5min`** — signed score delta over the last 5 minutes.
   Negative values are clamped to 0 for the momentum component (a downward
   trend does not actively penalise the score; it merely removes the momentum
   bonus).  Hot-streak tick count handles persistence of negative momentum
   indirectly.

---

## Leaderboard

6. The leaderboard is **fully in-memory**.  On service restart, it is rebuilt
   from live `ingest()` calls.  There is no DB-backed leaderboard replay.  If
   a persistent leaderboard is required post-launch, add a `FfsLeaderboardEntry`
   model (flagged in FLAGS.md).

7. The 10×10 grid is a visual layout hint for the frontend.  The engine
   guarantees rank order; the UI decides exact cell rendering.

---

## Anti-Flicker

8. Three consecutive ticks are required to confirm a tier transition.  At 1 Hz,
   this means a minimum 3-second delay before a tier change is surfaced.  This
   is an intentional design choice to prevent UI thrashing.

---

## Adaptive Weights

9. Adaptive multipliers are initialised to `1.0` for all components.  The first
   tip event seen for a creator creates the DB row.  Until the first tip, all
   weights are at default (no adaptive advantage or penalty).

10. Multiplier range `[0.80, 1.20]` is a governance constant.  Changing it
    requires a `rule_applied_id` bump and a FIZ commit if payout rates are
    indirectly affected.

---

## Dual Flame

11. Dual Flame support assumes both sessions are independently scored.  The
    partner score is an input provided by the caller — the Flicker n'Flame Scoring (FFS)
    does not look up the partner's score from its own state to avoid race
    conditions.

---

## Advisory Disclaimer

12. `skin_exposure_score` is tagged as advisory in code comments.  It is used
    solely as a scoring signal and must never be logged as PII or exposed in
    audit records.
