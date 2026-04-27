# Cyrano — FLAGS.md

## FLAG-001: CYRANO_IDEAL_LATENCY_MS
**Value:** 2000 ms  
**Intent:** Suggestions delivered faster than this are considered optimal.
No action taken at this threshold — it is a monitoring SLO.

## FLAG-002: CYRANO_HARD_CUTOFF_MS
**Value:** 4000 ms  
**Intent:** Suggestions exceeding 4 s are discarded silently.
`CYRANO_SUGGESTION_DROPPED` is emitted for audit and monitoring.
To adjust, update `CYRANO_LATENCY.HARD_CUTOFF_MS` in `cyrano.service.ts`.

## FLAG-003: CALLBACK_FACT_THRESHOLD
**Value:** 2 durable facts  
**Intent:** `CAT_CALLBACK` is only surfaced when the session memory
contains at least 2 facts for the (creator_id, guest_id) pair. Prevents
premature callback suggestions on first visits.

## FLAG-004: RECOVERY_SILENCE_THRESHOLD_SEC
**Value:** 60 seconds  
**Intent:** `CAT_RECOVERY` weight is boosted by +15 when
`silence_seconds >= 60`. Threshold is defined in `computeWeight()`.

## FLAG-005: SESSION_OPEN_STALE_THRESHOLD_MIN
**Value:** 5 minutes  
**Intent:** `CAT_SESSION_OPEN` weight is penalised by −20 when
`dwell_minutes >= 5`. Prevents session-open suggestions from surfacing
mid-session.

## FLAG-006: MONETIZATION_TIPPED_BOOST
**Value:** +10 weight  
**Intent:** When `guest_has_tipped` is true, `CAT_MONETIZATION` weight
is boosted by 10. A tipping guest is a warm lead — monetisation
suggestions are more likely to convert.

## FLAG-007: CALLBACK_WEIGHT_PROXIMITY_THRESHOLD
**Value:** 20 points  
**Intent:** `CAT_CALLBACK` is only preferred over the top-weighted
category when it is within 20 weight points of the maximum. Prevents
low-relevance callbacks from dominating high-heat rooms.

## FLAG-008: LAYER4_DEFAULT_RATE_LIMIT_PER_MINUTE
**Value:** 600 requests/minute (10 rps sustained).
**Intent:** Default per-tenant ceiling. Tenants override at registration
time via `rate_limit_per_minute`. Defined in
`cyrano-layer4-tenant.store.ts` as `DEFAULT_TENANT_RATE_LIMIT_PER_MINUTE`.

## FLAG-009: LAYER4_BURST_WINDOW_MS
**Value:** 1 000 ms.
**Intent:** Per-API-key burst window. Each key is allowed
`max(10, ceil(limit_per_minute / 60))` requests per second to prevent a
single rogue key from exhausting the tenant's per-minute budget.
Defined in `cyrano-layer4-rate-limiter.service.ts`.

## FLAG-010: LAYER4_BURST_DEFAULT_CEILING
**Value:** 10 requests/second/key.
**Intent:** Lower-bound for the burst ceiling, regardless of the
tenant's per-minute limit. Defined in
`cyrano-layer4-rate-limiter.service.ts` as `DEFAULT_BURST_CEILING`.

## FLAG-011: LAYER4_NON_ADULT_DOMAINS
**Value:** `[TEACHING, COACHING, FIRST_RESPONDER, FACTORY_SAFETY, MEDICAL]`
**Intent:** Tenants registered to these domains are forced to
`content_mode = non_adult` regardless of caller request. Defined in
`cyrano-layer4-tenant.store.ts` as `NON_ADULT_DOMAINS`.

## FLAG-012: LAYER4_HIPAA_CONSENT_REQUIRED
**Value:** `true` for `compliance_regime = HIPAA` or `GDPR`.
**Intent:** Every Layer 4 prompt request from a HIPAA / GDPR tenant
MUST attach `x-consent-receipt-id`. Voice synthesis under HIPAA also
requires the receipt. Defined in
`cyrano-layer4-enterprise.service.ts` and
`cyrano-layer4-voice.bridge.ts`.
