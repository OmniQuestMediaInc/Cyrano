// PAYLOAD G1 — server-side presenter for the creator gamification dashboard.
// Pure transformation: takes the raw service output and renders the
// CreatorGamificationDashboard shape. No service calls, no HTTP, no IO.
//
// SLOT_MACHINE retirement (CEO directive 2026-05-02; see
// docs/UX_INTEGRATION_BRIEF.md §8): SLOT_MACHINE is filtered out of every
// dashboard surface this presenter emits, regardless of whether it remains
// on backend GAMIFICATION.GAME_TYPES (backend cleanup is a v2 follow-up).
// The presenter is the single chokepoint that prevents UI exposure.

import { GAMIFICATION } from '../../services/core-api/src/config/governance.config';
import type {
  AnalyticsSummaryDto,
  PrizePool,
  CreatorGameConfig,
} from '../../services/gamification/src';
import { PLATFORM_DEFAULT_COOLDOWN_SECONDS } from '../../services/gamification/src/services/cooldown.service';
import type {
  CreatorGameCard,
  CreatorGamificationDashboard,
  GameType,
  PrizePoolViewModel,
} from '../types/gamification-contracts';

/** Game types the UI must never surface. CEO directive 2026-05-02. */
export const RETIRED_GAME_TYPES: ReadonlyArray<GameType> = ['SLOT_MACHINE'];

const DISPLAY_NAME: Partial<Record<GameType, string>> = {
  SPIN_WHEEL: 'Wheel of Fortune',
  DICE: 'Dice Game',
  // SLOT_MACHINE intentionally absent — RETIRED_GAME_TYPES filter blocks
  // any iteration that would attempt to look it up.
};

export interface GamificationPresenterInput {
  creator_id: string;
  pools: PrizePool[];
  configs: CreatorGameConfig[];
  analytics: AnalyticsSummaryDto;
  rrr_burn_globally_enabled: boolean;
}

/** Transform service-side data into the dashboard view model. */
export function presentCreatorGamificationDashboard(
  input: GamificationPresenterInput,
): CreatorGamificationDashboard {
  const { creator_id, pools, configs, analytics, rrr_burn_globally_enabled } = input;

  const pool_views: PrizePoolViewModel[] = pools
    .filter((p) => !p.scoped_game_type || !RETIRED_GAME_TYPES.includes(p.scoped_game_type))
    .map((p) => ({
    pool_id: p.pool_id,
    name: p.name,
    scoped_game_type: p.scoped_game_type,
    version: p.version,
    is_active: p.is_active,
    entries: p.entries
      .filter((e) => e.is_active)
      .map((e) => ({
        prize_slot: e.prize_slot,
        name: e.name,
        description: e.description,
        rarity: e.rarity,
        base_weight: e.base_weight,
        asset_url: e.asset_url,
      })),
  }));

  const cards: CreatorGameCard[] = GAMIFICATION.GAME_TYPES
    .filter((gt) => !RETIRED_GAME_TYPES.includes(gt))
    .map((gt) => {
    const cfg = configs.find((c) => c.game_type === gt);
    const tier_stat = analytics.per_game.find((g) => g.game_type === gt);
    const active_pool = cfg
      ? pools.find((p) => p.pool_id === cfg.prize_pool_id) ?? null
      : pools.find((p) => p.scoped_game_type === gt || p.scoped_game_type === null) ?? null;
    return {
      game_type: gt,
      display_name: DISPLAY_NAME[gt] ?? gt,
      enabled: cfg ? cfg.enabled : true,
      token_tiers: cfg ? cfg.token_tiers : [...GAMIFICATION.TOKEN_TIERS],
      cooldown_seconds: cfg?.cooldown_seconds_override ?? PLATFORM_DEFAULT_COOLDOWN_SECONDS,
      accepts_rrr_burn: cfg?.accepts_rrr_burn ?? false,
      active_pool_name: active_pool ? active_pool.name : null,
      stat_30d: {
        plays: tier_stat?.plays ?? 0,
        czt_revenue: tier_stat?.czt_revenue ?? 0,
        win_rate_pct: tier_stat?.win_rate_pct ?? 0,
      },
    };
  });

  return {
    creator_id,
    pools: pool_views,
    cards,
    rrr_burn_globally_enabled,
    captured_at_utc: new Date().toISOString(),
  };
}
