// PAYLOAD G1 — server-side presenter for the creator gamification dashboard.
// Pure transformation: takes the raw service output and renders the
// CreatorGamificationDashboard shape. No service calls, no HTTP, no IO.

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

const DISPLAY_NAME: Record<GameType, string> = {
  SPIN_WHEEL: 'Wheel of Fortune',
  SLOT_MACHINE: 'Slot Machine',
  DICE: 'Dice Game',
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

  const pool_views: PrizePoolViewModel[] = pools.map((p) => ({
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

  const cards: CreatorGameCard[] = GAMIFICATION.GAME_TYPES.map((gt) => {
    const cfg = configs.find((c) => c.game_type === gt);
    const tier_stat = analytics.per_game.find((g) => g.game_type === gt);
    const active_pool = cfg
      ? pools.find((p) => p.pool_id === cfg.prize_pool_id) ?? null
      : pools.find((p) => p.scoped_game_type === gt || p.scoped_game_type === null) ?? null;
    return {
      game_type: gt,
      display_name: DISPLAY_NAME[gt],
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
