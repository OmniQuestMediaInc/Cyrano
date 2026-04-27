# Guest-Heat — Intelligence Layer

**Service prefix:** `CRM:` / `CYR:` (teleprompter) / `HZ:` (dual-flame)  
**Domain:** Guest analytics, offer engine, Cyrano teleprompter  
**Path:** `services/guest-heat/`

## Purpose

Guest-Heat is the full intelligence layer for guest engagement and
monetisation on ChatNow.Zone. It tracks whale profiles, drives personalised
offers, coordinates gemstone gifts, powers the Cyrano teleprompter for
seasonal campaigns, manages the Dual Flame Pulse, produces predictive
spend forecasts, and maintains an immutable session performance timer.

## Components

### WhaleProfileService
- Scores each guest on a 0–100 whale scale using multi-window spend data
  (24h, 72h, 7d, 14d, 30d).
- Derives a `LoyaltyTier`: STANDARD → RISING → WARM → HOT → WHALE → ULTRA_WHALE.
- Persists scored profiles to `whale_profiles` (Prisma).
- Emits `guest_heat.whale.scored` on NATS.

### OfferEngine
- `SPENDING_PATTERN` offers — based on spend velocity + loyalty tier.
- `GEO_PRICE` offers — regional price shown to guest; full price retained
  in the offer record for audit. Multipliers from `GEO_PRICE_MULTIPLIERS`.
- `LOYALTY_REWARD` offers — 5% of 30d spend as bonus CZT.
- Emits `guest_heat.offer.triggered` on NATS.

### GemstoneService
- Queues gemstone awards to `gemstone_awards` (Prisma).
- Configurable erotic symbolism text; defaults per gem type.
- Public / Private visibility toggle.
- Deliberate send delay (5–20 s default; max 120 s) for human-like timing.
- Scheduled delivery via `setTimeout` — emits `guest_heat.gemstone.sent`.

### CyranoTeleprompterService
- Serial suggestion chains for **14 seasonal campaigns**:
  Valentine's, Pride, Carnaval, Halloween, Oktoberfest, Mardi Gras,
  Diwali, Chinese New Year, Cinco de Mayo, Fourth of July, Christmas,
  Thanksgiving, Birthday Week, Platform Anniversary.
- Each chain has 6 steps with beat (pause) durations.
- Ephemeral state — clears on session close or process restart.
- Emits `guest_heat.teleprompter.advanced` on NATS.

### DualFlamePulseService
- Fires when ≥2 VIP+ guests are simultaneously present in a HOT/INFERNO room.
- 60-second cooldown per session to avoid pulse spam.
- Emits `guest_heat.dual_flame.triggered` on NATS.

### ForecastService
- Rule-based predictive spend forecasting (no external API).
- Signals: `WEATHER_HOT`, `WEATHER_COLD`, `HOLIDAY`, `SEASONAL_PEAK`, `WEEKEND`.
- Confidence score based on signal convergence (60–95%).
- Emits `guest_heat.forecast.updated` on NATS.

### PerformanceTimerService
- GREEN (0–20 min) → YELLOW (20–40 min) → RED (40+ min).
- Each state transition produces an immutable audit record.
- Revenue at transition time captured for performance analysis.
- Emits `guest_heat.perf_timer.state` on NATS on every transition.

## REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/guest-heat/insights/score` | Score a guest (whale profiling) |
| GET | `/guest-heat/insights/:guest_id` | Get latest whale profile |
| POST | `/guest-heat/offers` | Trigger an offer |
| POST | `/guest-heat/gemstones` | Queue a gemstone |
| GET | `/guest-heat/gemstones/:guest_id/pending` | List pending gemstones |
| PATCH | `/guest-heat/gemstones/:gem_id/visibility` | Update gem visibility |
| POST | `/guest-heat/teleprompter/start` | Start a campaign chain |
| GET | `/guest-heat/teleprompter/:session_id/current` | Current suggestion |
| POST | `/guest-heat/teleprompter/:session_id/advance` | Advance chain |
| GET | `/guest-heat/teleprompter/:session_id/state` | Full chain state |
| GET | `/guest-heat/teleprompter/campaigns` | List all campaigns |
| POST | `/guest-heat/dual-flame/presence` | Register guest presence |
| POST | `/guest-heat/forecast` | Generate spend forecast |
| POST | `/guest-heat/perf-timer/start` | Start session timer |
| POST | `/guest-heat/perf-timer/tick` | Tick (evaluate state change) |
| GET | `/guest-heat/perf-timer/:session_id` | Get timer state |
| POST | `/guest-heat/perf-timer/stop` | Stop timer |

## Geo-Pricing

Regional price multipliers are applied to base CZT values when
generating `GEO_PRICE` offers. The regional price is shown to the guest
in the UI; the full `public_price_czt` is retained in the offer record
for audit purposes.

| Region | Multiplier |
|--------|-----------|
| NA (North America) | 1.00 |
| EU (Europe) | 0.92 |
| UK | 0.95 |
| AU | 0.88 |
| LA (Latin America) | 0.72 |
| IN (India) | 0.55 |
| SEA (South-East Asia) | 0.65 |
| MEA (Middle East / Africa) | 0.70 |

## NATS Topics Emitted

| Topic | Service | When |
|-------|---------|------|
| `guest_heat.whale.scored` | WhaleProfileService | Guest rescored |
| `guest_heat.offer.triggered` | OfferEngine | Offer generated |
| `guest_heat.offer.accepted` | (caller) | Guest accepts offer |
| `guest_heat.gemstone.queued` | GemstoneService | Gemstone queued |
| `guest_heat.gemstone.sent` | GemstoneService | Gemstone delivered |
| `guest_heat.dual_flame.triggered` | DualFlamePulseService | Dual Flame Pulse |
| `guest_heat.forecast.updated` | ForecastService | Forecast generated |
| `guest_heat.perf_timer.state` | PerformanceTimerService | Timer state change |
| `guest_heat.teleprompter.advanced` | CyranoTeleprompterService | Chain advanced |
