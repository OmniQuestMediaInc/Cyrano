# WEBHOOK_CONTRACTS.md

**Version:** v1.1  
**Status:** Active  
**Rule Applied (document cleanup):** GOVERNANCE-EQ-v1

## eCommsZone outbound contract (CyranoZone → eCommsZone)

**Transport:** HTTPS webhook + NATS mirror event  
**Webhook URL env:** `ECOMMSZONE_WEBHOOK_URL`  
**Auth header (optional):** `x-oqmi-webhook-secret` from `ECOMMSZONE_WEBHOOK_SECRET`

### Event: `hub.high_heat_monetization.v1`

- Fired when `services/integration-hub/src/hub.service.ts` emits `NATS_TOPICS.HUB_HIGH_HEAT_MONETIZATION`
- Sent to eCommsZone by `services/integration-hub/src/ecomms-zone.client.ts`
- Payload and `x-oqmi-rule-applied-id` header use `INTEGRATION_HUB_v2` from the integration-hub event envelope.

#### Payload schema

```json
{
  "session_id": "string",
  "creator_id": "string",
  "guest_id": "string",
  "tier": "COLD|WARM|HOT|INFERNO",
  "ffs_score": 0,
  "suggested_category": "string|null",
  "suggestion_id": "string|null",
  "captured_at_utc": "ISO-8601",
  "rule_applied_id": "INTEGRATION_HUB_v2"
}
```

## Cyrano strip redirect rule (L1/L2 remnants)

- Any remaining cross-repo notifications must go through NATS topics and/or this webhook contract.
- No direct cross-repo imports are allowed.

_[rule_applied_id: GOVERNANCE-EQ-v1]_
