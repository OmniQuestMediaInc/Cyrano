# Flicker n'Flame Scoring — `services/ffs/`

**Business Plan Reference:** B.4 — Room-level telemetry
**Rule ID:** `FFS_ENGINE_v1`
**Status:** Active (renamed from `services/room-heat/`)

---

## Purpose

The **Flicker n'Flame Scoring (FFS)** engine computes a real-time **composite score (0–100)** for every
live creator session. The score is published to NATS on subject `ffs.score.update` every 1 Hz and consumed by:

- **CreatorControl.Zone** — session suggestions and price nudges
- **Cyrano™** — suggestion weighting and category selection
- **Integration Hub** — payout scaling and Diamond Concierge handoffs
- **VelocityZone** — maps FFS score to exact payout rate during timed events
- **GateGuard Welfare Score** — welfare signal weighting
- **Leaderboard surface** — 10 × 10 grid sorted coolest-to-hottest

---

## Architecture

```
NATS (SENSYNC_BPM_UPDATE, CHAT_MESSAGE_INGESTED)
        │
        ▼
 FfsService.ingest(FfsInput)
        │
        ├─ calculateComponents()    ← 13 weighted signals
        ├─ earlyPhaseBoost()        ← +10 % if dwell < 5 min
        ├─ dualFlameBonus()         ← up to +5 pts from partner
        ├─ resolveAntiFlickerTier() ← 3-tick confirmation rule
        │
        ├─ NATS publish (FFS_SCORE_UPDATE, FFS_TIER_CHANGED,
        │                FFS_PEAK, FFS_HOT_AND_READY,
        │                FFS_DUAL_FLAME_PEAK)
        │
        ├─ Prisma.ffsSnapshot.create()  (async)
        │
        └─ 1 Hz interval → re-emit with refreshed timestamp
```

---

## Score Composition (sum of ceilings = 100)

| Signal | Max pts | Input field |
|--------|--------:|-------------|
| Tip pressure | 15 | `tips_per_min` |
| Chat velocity | 8 | `chat_velocity_per_min` |
| Dwell | 5 | `dwell_minutes` |
| Heart reactions | 8 | `heart_reactions_per_min` |
| Private/spy viewers | 5 | `private_spy_count` |
| Heart rate delta (SenSync™ or raw) | 12 | `sensync_bpm ?? heart_rate_bpm − baseline` |
| Eye tracking | 6 | `eye_tracking_score` (0–1) |
| Facial excitement | 7 | `facial_excitement_score` (0–1) |
| Skin exposure | 5 | `skin_exposure_score` (0–1) |
| Motion | 5 | `motion_score` (0–1) |
| Audio vocal ratio | 5 | `audio_vocal_ratio` (0–1) |
| 5-min momentum | 10 | `heat_trend_5min` |
| Hot streak | 9 | `hot_streak_ticks` |
| **Total** | **100** | |

---

## Tier Bands (canonical — DOMAIN_GLOSSARY.md)

| Tier | Score range | VelocityZone payout floor |
|------|-------------|--------------------------|
| COLD | 0–33 | $0.075 / CZT |
| WARM | 34–60 | $0.080 / CZT |
| HOT | 61–85 | $0.085 / CZT |
| INFERNO | 86–100 | $0.090 / CZT |

---

## Anti-Flicker Rule

A tier transition is only confirmed after **3 consecutive ticks** agree on the new tier.

---

## SenSync™ Integration

When a SenSync™ wearable is paired and consent is granted, the FFS engine
receives `SENSYNC_BPM_UPDATE` events and folds the live BPM into the
`sensync_bpm` field of the input frame. The heart-rate component uses
`sensync_bpm` over `heart_rate_bpm` when present.

If the device disconnects or consent is revoked, the engine automatically
falls back to behavioral signals only (graceful degradation).

---

## NATS Topics

| Topic constant | Subject | When emitted |
|----------------|---------|--------------|
| `FFS_SCORE_UPDATE` | `ffs.score.update` | Every ingest (and 1 Hz re-emit) |
| `FFS_TIER_CHANGED` | `ffs.score.tier.changed` | Tier crosses a band boundary |
| `FFS_PEAK` | `ffs.score.peak` | Score enters INFERNO |
| `FFS_HOT_AND_READY` | `ffs.score.hot_and_ready` | Score ≥ 70 + dwell ≥ 10 min |
| `FFS_DUAL_FLAME_PEAK` | `ffs.score.dual_flame.peak` | Dual Flame hits INFERNO |
| `FFS_LEADERBOARD_UPDATED` | `ffs.score.leaderboard.updated` | ~every 10 s |
| `FFS_SESSION_STARTED` | `ffs.score.session.started` | `startSession()` called |
| `FFS_SESSION_ENDED` | `ffs.score.session.ended` | `endSession()` called |
| `FFS_ADAPTIVE_UPDATED` | `ffs.score.adaptive.updated` | Adaptive weights shift after tip |

---

## REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/ffs/leaderboard?category=all` | 10×10 leaderboard |
| `GET` | `/ffs/session/:id` | Current FFS score for a session |
| `POST` | `/ffs/ingest` | Ingest a telemetry frame |
| `POST` | `/ffs/session/:id/start` | Pre-register a session |
| `DELETE` | `/ffs/session/:id` | End a session |
| `POST` | `/ffs/tip-event` | Trigger adaptive learning from a tip |
| `GET` | `/ffs/adaptive-weights/:creatorId` | Read creator adaptive multipliers |

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `ffs_snapshots` | Append-only time-series of every FFS score computed |
| `ffs_adaptive_weights` | One row per creator — learned component multipliers |

---

## Environment Variables

See `.env.example` in this directory.
