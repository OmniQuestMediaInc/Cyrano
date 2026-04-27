# Guest-Heat — FLAGS.md

## FLAG-001: WHALE_SCORE_CEILING_CZT
**Value:** 5 000 CZT (30-day normalisation ceiling)  
**Intent:** A guest spending 5 000 CZT across weighted windows scores 100.
To adjust, modify `CEILING` in `computeWhaleScore()` in `guest-heat.service.ts`.

## FLAG-002: LOYALTY_TIER_THRESHOLDS
**Values:**
- ULTRA_WHALE ≥ 90
- WHALE ≥ 70
- HOT ≥ 50
- WARM ≥ 30
- RISING ≥ 15
- STANDARD ≥ 0  
**Intent:** Tier boundaries are tuned to business plan B.4 §3. To adjust,
modify `LOYALTY_THRESHOLDS` in `guest-heat.service.ts`.

## FLAG-003: GEMSTONE_MAX_DELAY_SEC
**Value:** 120 seconds  
**Intent:** Maximum allowed send delay for gemstone delivery. Prevents
gems from being queued indefinitely. Default random delay is 5–20 s.

## FLAG-004: DUAL_FLAME_PULSE_COOLDOWN_MS
**Value:** 60 000 ms (60 seconds)  
**Intent:** Prevents pulse spam in a single session. One pulse maximum
per 60-second window. Adjust `PULSE_COOLDOWN_MS` in
`dual-flame-pulse.service.ts`.

## FLAG-005: PERF_TIMER_YELLOW_THRESHOLD_MIN
**Value:** 20 minutes  
**Intent:** Session transitions from GREEN to YELLOW after 20 minutes.
Adjust `PERF_TIMER.YELLOW_THRESHOLD_MIN` in `guest-heat.types.ts`.

## FLAG-006: PERF_TIMER_RED_THRESHOLD_MIN
**Value:** 40 minutes  
**Intent:** Session transitions from YELLOW to RED after 40 minutes.
Adjust `PERF_TIMER.RED_THRESHOLD_MIN` in `guest-heat.types.ts`.

## FLAG-007: FORECAST_BASE_CONFIDENCE
**Value:** 60% + 10% per signal (max 95%)  
**Intent:** Base confidence of 60% with 10% uplift per detected signal
(HOLIDAY, WEEKEND, SEASONAL_PEAK, WEATHER_HOT, WEATHER_COLD).

## FLAG-008: OFFER_LOYALTY_REWARD_PCT
**Value:** 5% of 30d spend  
**Intent:** Loyalty reward offer value is 5% of the guest's 30-day spend.
Adjust in `OfferEngine.generateLoyaltyRewardOffer()`.

## FLAG-009: OFFER_SPENDING_PATTERN_TTL_MINUTES
**Value:** 30 minutes  
**Intent:** Spending-pattern offers expire after 30 minutes. Loyalty
reward offers expire after 24 hours. Geo-price offers after 60 minutes.

## FLAG-010: GEO_PRICE_LOWEST_MULTIPLIER
**Value:** 0.55 (India region)  
**Intent:** Minimum regional price multiplier applied to base CZT offers.
The full `public_price_czt` is always retained in the offer record.
