# RedRoom Rewards (rewards-api) — ASSUMPTIONS

## A001 — Append-only points ledger

`RedRoomLedgerService` is append-only. Entries are never updated or deleted;
debits are recorded as additional rows with negative `amount`. The default
in-memory sink is replaced at production wiring with a Prisma-backed sink.

## A002 — Bundle catalog is fixed at the source

`POINTS_BUNDLES` is the canonical catalog. Controllers and services MUST
resolve a bundle by id; free-form `priceUsd` from the client is rejected.
Adjusting prices is a governance event, not a runtime config flip.

## A003 — Audit precedes credit

`PointsPurchaseService.purchaseBundle()` writes an immutable
`POINTS_PURCHASE_AUTHORIZATION` audit record **before** any ledger credit.
A failure to write the audit record blocks the credit. Tests assert this
ordering and any refactor must preserve it.

## A004 — Full GateGuard Sentinel coverage (F-024)

`GateGuardSentinelService` runs on every EARN, PURCHASE, AWARD, and BURN
that flows through `PointsPurchaseService`, `RedRoomLedgerService.awardPointsWithCompliance`,
and `CreatorGiftingService.createPromotion`. Unusual earn / purchase
patterns trigger fraud-signal events; HARD_DECLINE outcomes throw a
`SentinelDeclineError` and prevent any ledger mutation.

## A005 — 18+ verification gate on award path

`RedRoomLedgerService.awardPointsWithCompliance()` requires AV success
before Sentinel evaluation. The default in-process verifier
(`InProcessAccountVerificationService`) returns verified=true unless an id
is explicitly blocked — production wiring substitutes a provider-backed
adapter (Veriff, Persona, etc.).

## A006 — Sentinel is optional at construction (backwards-compatible)

Legacy callers that instantiate `RedRoomLedgerService` or
`PointsPurchaseService` without compliance deps fall back to a
`NoopGateGuardSentinel` that always returns APPROVE. Production wiring
MUST inject a real `GateGuardSentinelService`. This is a transitional
contract; the noop default will be removed in a future governance increment.

## A007 — Fraud signals are best-effort

The `FraudSignalSink` is invoked but its failure does NOT abort the
decision. Decisioning is the contract; signal emission is observability.
The default `ConsoleFraudSignalSink` logs a warn line; production wiring
substitutes a NATS publisher targeting the `fraud.signal` topic.
