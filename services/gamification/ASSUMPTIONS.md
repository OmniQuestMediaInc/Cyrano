# Assumptions — services/gamification

1. The shipped `GameEngineService` (GM-001) is preserved unmodified for
   backward compatibility. New work happens in `services/gamification/`,
   which composes the engine via DI.
2. `GAMIFICATION.TOKEN_TIERS = [25, 45, 60]` in governance.config remains
   the **platform default**. Creators may override with up to three
   custom positive integer tiers via `creator_game_configs.token_tiers`.
3. The relaxed `prize_pool_entries.token_tier` constraint (`>= 1`) is
   enforced application-side; the schema-level CHECK on legacy
   `prize_tables` (`IN (25,45,60)`) is left untouched — new pool data
   flows through `prize_pool_entries`, not `prize_tables`.
4. Rarity tiers are an enum: `COMMON | RARE | EPIC | LEGENDARY`. The
   weighted-selector treats rarity weight as the **numerator** and the
   token-tier multiplier as the **rarity-conditional bias** (higher
   tiers boost rarer outcomes monotonically).
5. The DICE game uses 2d6 → sum 2..12 (matches `GAMIFICATION.DICE_RANGE`).
   Mouse-shake events are advisory UX only — they do **not** influence
   the RNG, which is `crypto.randomInt()`.
6. Cooldown is enforced server-side via `game_cooldown_logs.next_play_at`.
   In-memory cache is intentionally avoided — the canonical store is the DB.
7. RRR-point burn is settled via the existing burn endpoint contract
   from Payload #13 (`/api/v1/burn/gift`). For game plays we use the
   `play` reason. The exchange rate is sourced from
   `RRR_POINT_USD_VALUE` × `GIFT_TOKEN_USD_VALUE`.
8. Analytics queries are read-only and never touch ledger or audit
   tables directly — they aggregate `game_sessions` and
   `redroom_rewards_burns`.
