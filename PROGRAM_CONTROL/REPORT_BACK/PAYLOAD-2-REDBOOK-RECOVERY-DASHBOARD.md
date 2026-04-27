# PAYLOAD 2 — REDBOOK Unified CS Recovery Dashboard + Diamond Concierge

**Branch:** `claude/redbook-dashboard-concierge-xgbN6`
**Status:** Wave 1 scaffolding complete. Ready for review + GateGuard wiring.
**Parallel-safe with:** Payload 1 (ledger service hardening). No overlap with
`prisma/schema.prisma` or `services/core-api/src/finance/ledger.service.ts`.

## Modules delivered

| Module | Path | Status |
| --- | --- | --- |
| Recovery Engine | `services/recovery/src/recovery.service.ts` | NEW — Wave 1 done |
| Recovery Types | `services/recovery/src/recovery.types.ts` | NEW |
| Admin Recovery Controller | `services/recovery/src/admin-recovery.controller.ts` | NEW — surface `/admin/recovery` |
| Recovery Module | `services/recovery/src/recovery.module.ts` | NEW |
| Diamond Concierge Service | `services/diamond-concierge/src/diamond.service.ts` | NEW — Wave 1 done |
| Diamond Concierge Module | `services/diamond-concierge/src/diamond-concierge.module.ts` | NEW |
| Notification Engine | `services/notification/src/notification.service.ts` | NEW — Wave 1 done |
| Notification Module | `services/notification/src/notification.module.ts` | NEW |
| Recovery integration tests | `tests/integration/recovery-service.spec.ts` | NEW — 22 cases |
| Diamond integration tests | `tests/integration/diamond-concierge-service.spec.ts` | NEW — 22 cases |
| Notification integration tests | `tests/integration/notification-engine.spec.ts` | NEW — 17 cases |

## REDBOOK §5 coverage

- **Pillar 1 — Token Bridge**: 20% bonus token offer + signed-waiver acceptance
  + temporary 24h restriction window flag. Soft offer — no ledger credit at
  this layer (delegated to LedgerService Token Extension pathway in Wave 2).
- **Pillar 2 — Three-Fifths Exit**: scaffolding + audit trail + permanent flag
  on case. Cash-refund execution returns `POLICY_GATED` until a CEO override
  context is supplied. Governance reference: **FIZ-002-REVISION-2026-04-11**.
- **Pillar 3 — Expiration**: 70/30 distribution to creator bonus pool /
  platform management fee using `DIAMOND_TIER.EXPIRED_CREATOR_POOL_PCT` and
  `DIAMOND_TIER.EXPIRED_PLATFORM_MGMT_PCT` as the canonical sources.
  $49 extension and $79 recovery fees surfaced from the same config.
- **48-hour expiry warning**: dispatcher enqueue for Diamond wallets in the
  warning window. Excludes non-Diamond, zero-balance, and out-of-window
  wallets.
- **High-balance personal touch**: triggers above $10,000 USD equivalent.
  Routes to `HUMAN_CONTACT_ZONE` channel via NotificationEngine.

## Diamond §4 coverage

- Volume + Velocity pricing (3 volume tiers × 5 velocity bands, table-driven
  from `DIAMOND_TIER.VOLUME_TIERS` and `DIAMOND_TIER.VELOCITY_MULTIPLIERS`).
- Platform floor guarantee at $0.077 / token enforced exhaustively (verified
  by spec across all 15 tier×band combinations).
- 14-day expiry stamp + safety-net metadata builder.
- Concierge surface fusion (security + fraud + hospitality signal streams).
- Liquidity snapshot helper for the dashboard Diamond panel.

## Audit & governance invariants

- Every state change appends a `RecoveryAuditEntry` with `correlation_id`,
  `rule_applied_id` (`REDBOOK_RECOVERY_v1`), `actor_id`, and `reason_code`.
- `NotificationEngine` records both dispatched and suppressed attempts with
  `rule_applied_id` `NOTIFICATION_ENGINE_v1` and a deterministic dedup key.
- Recovery cases are append-only — `stage` advances monotonically forward
  through the `RecoveryStage` union; earlier audit entries are never
  modified (Invariant #1).
- No mutation to `prisma/schema.prisma`, `LedgerService`, `TokenExtensionService`,
  or any other Payload 1 surface.

## Verification

- `yarn lint services/recovery services/diamond-concierge services/notification`
  → clean (max-warnings 0)
- `yarn test tests/integration/recovery-service.spec.ts`
  `tests/integration/diamond-concierge-service.spec.ts`
  `tests/integration/notification-engine.spec.ts`
  → **61 passed / 0 failed**
- Full `yarn test`: 149 passed, 1 pre-existing failure in
  `tests/integration/ledger-service.spec.ts` (TS2300 duplicate-identifier
  on `TokenOrigin`) — present on `main` before Payload 2 and unrelated to
  this work.

## Next priority — GateGuard integration

Recovery case open should flow through the GateGuard Sentinel pre-processor
for Diamond-tier high-risk wallets. Surface the existing `WalletSnapshot`
contract as the sentinel input type. See `## HANDOFF` block at the bottom
of `services/recovery/src/recovery.service.ts` for the full deferred-work
list.
