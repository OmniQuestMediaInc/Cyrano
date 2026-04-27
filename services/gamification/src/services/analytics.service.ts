// services/gamification/src/services/analytics.service.ts
// Aggregates play volume, win rate, and revenue per token tier. Reads-only —
// never mutates ledger or audit data. Backed by the same game_sessions feed
// that powers the player history view.

import { Injectable, Logger } from '@nestjs/common';
import { GAMIFICATION } from '../../../core-api/src/config/governance.config';
import type { AnalyticsSummaryDto } from '../dto/gamification.dto';
import type { GameType } from '../types/gamification.types';

export interface AnalyticsPlayRow {
  game_type: GameType;
  token_tier: number;
  tokens_paid: number;
  prize_slot: string;
  /** Set when payment_method = 'RRR'. */
  rrr_points: number | null;
  /** True iff the resolved prize was a non-consolation win. */
  is_win: boolean;
  resolved_at_utc: string;
}

export interface AnalyticsRepository {
  /** Returns play rows for a creator within the given window. */
  fetchCreatorWindow(creator_id: string, window_days: number): Promise<AnalyticsPlayRow[]>;
}

@Injectable()
export class GameAnalyticsService {
  private readonly logger = new Logger(GameAnalyticsService.name);

  constructor(private readonly repo: AnalyticsRepository) {}

  async summaryForCreator(creator_id: string, window_days: number): Promise<AnalyticsSummaryDto> {
    if (!Number.isInteger(window_days) || window_days <= 0 || window_days > 365) {
      throw new Error(`ANALYTICS_INVALID_WINDOW: window_days must be 1..365 (got ${window_days})`);
    }
    const rows = await this.repo.fetchCreatorWindow(creator_id, window_days);
    const per_game: AnalyticsSummaryDto['per_game'] = GAMIFICATION.GAME_TYPES.map((gt) => {
      const subset = rows.filter((r) => r.game_type === gt);
      const plays = subset.length;
      const wins = subset.filter((r) => r.is_win).length;
      const czt_revenue = subset
        .filter((r) => r.rrr_points === null)
        .reduce((acc, r) => acc + r.tokens_paid, 0);
      const rrr_revenue_points = subset
        .filter((r) => r.rrr_points !== null)
        .reduce((acc, r) => acc + (r.rrr_points ?? 0), 0);
      const tierMap = new Map<number, { plays: number; tokens_paid: number }>();
      for (const r of subset) {
        const cur = tierMap.get(r.token_tier) ?? { plays: 0, tokens_paid: 0 };
        cur.plays += 1;
        cur.tokens_paid += r.tokens_paid;
        tierMap.set(r.token_tier, cur);
      }
      const revenue_by_tier = Array.from(tierMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([token_tier, agg]) => ({ token_tier, ...agg }));
      return {
        game_type: gt,
        plays,
        czt_revenue,
        rrr_revenue_points,
        win_rate_pct: plays === 0 ? 0 : Math.round((wins / plays) * 10_000) / 100,
        revenue_by_tier,
      };
    });

    return {
      creator_id,
      window_days,
      per_game,
      generated_at_utc: new Date().toISOString(),
    };
  }
}
