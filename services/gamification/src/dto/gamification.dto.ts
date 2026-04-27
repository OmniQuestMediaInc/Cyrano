// services/gamification/src/dto/gamification.dto.ts
// Wire-level DTOs for the GamificationController. Mirrored 1:1 in
// ui/types/gamification-contracts.ts so the Next.js surface binds without
// re-deriving field names.

import type { GameType, PaymentMethod, RarityTier } from '../types/gamification.types';

export interface UpsertPrizePoolDto {
  pool_id?: string;                    // omit to create
  name: string;
  scoped_game_type: GameType | null;   // null = shared
  entries: Array<{
    prize_slot: string;
    name: string;
    description: string;
    rarity: RarityTier;
    base_weight: number;
    asset_url?: string;
  }>;
}

export interface UpsertCreatorGameConfigDto {
  game_type: GameType;
  token_tiers: number[];               // 1–3 positive integers
  prize_pool_id: string;
  cooldown_seconds_override?: number | null;
  enabled: boolean;
  accepts_rrr_burn: boolean;
}

export interface InitiatePlayDto {
  user_id: string;
  creator_id: string;
  game_type: GameType;
  token_tier: number;
  payment_method: PaymentMethod;
  /** Required when GAMIFICATION_MOUSE_SHAKE_REQUIRED=true. */
  shake_proof?: {
    duration_ms: number;
    samples: number;                   // # of mouse-move samples observed
    avg_amplitude_px: number;
  };
  /** Optional CAPTCHA token; required after rate-limit trip. */
  captcha_token?: string;
}

export interface PlayResponseDto {
  session_id: string;
  game_type: GameType;
  token_tier: number;
  payment_method: PaymentMethod;
  tokens_paid: number;
  prize_slot: string;
  prize_name: string;
  prize_description: string;
  rarity: RarityTier;
  asset_url: string | null;
  outcome_data: Record<string, number>;
  resolved_at_utc: string;
  rule_applied_id: string;
  idempotency_key: string;
  /** Cooldown info shown in UI. */
  next_play_at_utc: string;
}

export interface AnalyticsSummaryDto {
  creator_id: string;
  window_days: number;
  per_game: Array<{
    game_type: GameType;
    plays: number;
    czt_revenue: number;
    rrr_revenue_points: number;
    win_rate_pct: number;
    revenue_by_tier: Array<{ token_tier: number; plays: number; tokens_paid: number }>;
  }>;
  generated_at_utc: string;
}

export interface ImportPrizePoolDto {
  format: 'JSON_V1';
  pool: UpsertPrizePoolDto;
}

export interface ExportPrizePoolDto {
  format: 'JSON_V1';
  pool: {
    pool_id: string;
    name: string;
    scoped_game_type: GameType | null;
    entries: Array<{
      prize_slot: string;
      name: string;
      description: string;
      rarity: RarityTier;
      base_weight: number;
      asset_url?: string;
    }>;
    exported_at_utc: string;
  };
}
