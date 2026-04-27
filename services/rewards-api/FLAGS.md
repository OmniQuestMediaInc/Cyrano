# RedRoom Rewards (rewards-api) — FLAGS

| ID    | Category           | Description                                                   | Default Used | CEO Action         |
| ----- | ------------------ | ------------------------------------------------------------- | ------------ | ------------------ |
| F-024 | GateGuard Sentinel | Full WGS + fraud monitoring on EARN / PURCHASE / AWARD / BURN | Yes          | Confirm thresholds |

## F-024 — GateGuard Sentinel thresholds

`SENTINEL_THRESHOLDS` (services/rewards-api/src/services/gate-guard-sentinel.service.ts):

| Knob              | Default | Effect                                                  |
| ----------------- | ------- | ------------------------------------------------------- |
| `cooldownAt`      | 40      | Score ≥ 40 → COOLDOWN (soft block, retry allowed)       |
| `hardDeclineAt`   | 70      | Score ≥ 70 → HARD_DECLINE (transaction blocked)         |
| `humanEscalateAt` | 90      | Score ≥ 90 → HUMAN_ESCALATE (Welfare Guardian hand-off) |
| `highValuePoints` | 5 000   | Awards above this fire the high-value fraud signal      |

## F-024 — Sentinel scope

Active on the following flows:

- `PointsPurchaseService.purchaseBundle()` — PURCHASE evaluation before
  audit and ledger credit.
- `RedRoomLedgerService.awardPointsWithCompliance()` — AWARD evaluation
  after AV succeeds.
- `CreatorGiftingService.createPromotion()` — AWARD evaluation on
  creator-issued promotions.

## F-024 — Fraud signal pattern

Emits `fraud.signal` (C-012 pattern) whenever:

- `points > SENTINEL_THRESHOLDS.highValuePoints`, OR
- `context.velocityHigh === true`

Signal emission is best-effort and does not block the ledger evaluation.
