# Guest-Heat — ASSUMPTIONS.md

## A001 — WhaleProfile Is Append-Only
Each call to `scoreGuest()` inserts a new `whale_profiles` row. The
service never updates a prior row. `getLatestProfile()` retrieves the
most recent row by `scored_at` DESC. This matches the platform's
append-only financial integrity pattern.

## A002 — Spend Values Are in CZT Tokens
All `SpendWindows` values and offer `value_czt` fields are in CZT
(ChatZoneTokens), not USD. USD display conversion is handled by the
UI layer using the canonical CZT/USD rate.

## A003 — Gemstone Delivery Is Best-Effort
`GemstoneService` uses in-process `setTimeout` timers. A process restart
cancels all pending timers. Gems with status `QUEUED` that were not sent
before restart must be re-queued by the caller. In production, a
persistent job queue (e.g. Bull) should be used for reliability.

## A004 — Teleprompter Chains Are Ephemeral
`CyranoTeleprompterService` stores chain state in an in-process Map.
Chains are not persisted to Postgres. A process restart clears all
active chains. Callers must restart chains after reconnection.

## A005 — Dual Flame Pulse Uses In-Process Cooldown
The 60-second pulse cooldown per session is tracked in-process. In a
horizontally-scaled deployment, multiple instances may each fire a
separate pulse. Redis-based distributed cooldown should be added for
production.

## A006 — Forecast Signals Are Rule-Based
`ForecastService` does not call any external weather or calendar APIs.
All signals are derived from UTC date/month logic. For production-grade
accuracy, integrate a weather API (e.g. OpenWeatherMap) and a statutory
holiday calendar for each geo region.

## A007 — Performance Timer Is Not Persisted
`PerformanceTimerService` maintains timer state in-process. Audit events
are emitted on NATS for downstream persistence. A process restart clears
all active timers. If a session resumes after restart, the timer must be
restarted with the correct elapsed offset.

## A008 — Offer Acceptance Is Caller-Managed
`OfferEngine` generates and emits offers. Tracking offer acceptance
(GUEST_HEAT_OFFER_ACCEPTED) is the responsibility of the caller/API
layer — it should emit the NATS topic after confirming the guest's action.

## A009 — Geo-Region Is ISO-Formatted or CNZ Code
`geo_region` fields use either ISO 3166-1 alpha-2 codes (e.g. `CA`, `GB`)
or CNZ composite codes (e.g. `SEA`, `MEA`, `LA`). The `GEO_PRICE_MULTIPLIERS`
map in `guest-heat.types.ts` uses CNZ codes. The caller must map ISO codes
to CNZ codes before passing to the OfferEngine.
