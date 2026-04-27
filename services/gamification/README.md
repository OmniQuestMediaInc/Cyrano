# services/gamification

**Status:** Phase 0–5 scaffolding (branch: `claude/add-prize-pool-management-RmG9y`).

Extends the shipped `services/core-api/src/games/` module (GM-001) with:

- `PrizePoolService` — creator prize pools (shared or per-game), rarity-tiered.
- `CreatorGameConfigService` — per-creator price points, cooldowns, enable flags.
- `WeightedSelector` — deterministic, `crypto.randomInt`-backed weighted RNG.
- `CooldownService` — platform-default + creator-override per-game cooldowns.
- `GameSecurityService` — mouse-shake verification + per-IP rate limiting.
- `RedRoomRewardsBurnService` — alternate payment in RRR points (Payload #13 parity).
- `GameAnalyticsService` — win-rates, revenue per price-point, per-game.
- `GameAuditService` — append-only `ImmutableAuditEvent` writes for every play.
- `PlayOrchestratorService` — full debit → resolve → audit pipeline (LedgerService DI).
- `GamificationController` — REST surface for creator config + player plays + history.

All values flow through `services/core-api/src/config/governance.config.ts`
(`GAMIFICATION`, `RRR_POINT_USD_VALUE`, `RRR_GIFT_COMMISSION_PCT`). No constants
are duplicated locally.

## Invariants

- Ledger debit precedes outcome resolution. Enforced by orchestrator.
- Every play produces a `game_sessions` insert + `immutable_audit_events` row.
- Weighted selection is funded by `crypto.randomInt()` only — never `Math.random()`.
- `correlation_id` and `reason_code` are required on every ledger write.
- Append-only: `prize_pools`, `prize_pool_entries`, `creator_game_configs`,
  `game_play_audit`, `redroom_rewards_burns` honour the existing mutation triggers.
