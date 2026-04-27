# VelocityZone — `services/velocityzone/`

**Business Plan Reference:** §3 — Creator Payout Model + VelocityZone
**Rule ID:** `VELOCITYZONE_v1`
**Status:** Active (new service)

---

## Purpose

**VelocityZone** maps real-time FFS scores to exact creator payout rates
during admin-defined time-window events. On every tip:

1. Check if a VelocityZone event is active for the creator.
2. If active: map current FFS score (0–100) linearly to a rate (7.5¢ → 9¢).
3. Rate is locked at tip processing time — immutable after the tip.

---

## Creator Rate Tiers

| Tier | Period | Floor | Ceiling |
|------|--------|-------|---------|
| `FOUNDING` | Day 1 – Day 60 | $0.075 / CZT | $0.090 / CZT |
| `STANDARD` | Day 1 – Day 60 | $0.065 / CZT | $0.080 / CZT |
| `POST_DAY_61` | Day 61+ (all) | $0.075 / CZT | $0.090 / CZT |

The Day-61 scheduled job (`POST /velocityzone/day61-promotion`) promotes all
`STANDARD` creators to `POST_DAY_61` in a single append-only operation.

---

## VelocityZone Rate Mapping

During an active event:
```
rate_usd = floor + (ffs_score / 100) × (ceiling - floor)
```

Rate is **locked at tip time** and written immutably to the ledger.

---

## NATS Topics

| Topic constant | Subject | When emitted |
|----------------|---------|--------------|
| `VELOCITYZONE_EVENT_ACTIVE` | `velocityzone.event.active` | Every 30 s cache refresh when events exist |
| `VELOCITYZONE_RATE_APPLIED` | `velocityzone.rate.applied` | Each tip during active event |

---

## REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/velocityzone/rate` | Evaluate locked tip rate at current FFS score |
| `POST` | `/velocityzone/creator/:id/seed-rate` | Seed creator rate tier on onboarding |
| `POST` | `/velocityzone/day61-promotion` | Trigger Day-61 rate promotion (scheduler) |
| `GET` | `/velocityzone/health` | Health check |

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `creator_rate_tiers` | Founding / standard / post-Day-61 rate bands per creator |
| `velocityzone_events` | Admin-defined time-window event definitions |
