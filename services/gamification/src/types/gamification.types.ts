// services/gamification/src/types/gamification.types.ts
// Canonical types for the gamification module. Kept in lock-step with
// services/core-api/src/games/game-engine.service.ts (GameType) and the
// platform-wide GAMIFICATION constant in governance.config.ts.

import type { GameType } from '../../../core-api/src/games/game-engine.service';

export type { GameType };

/** Rarity tier with monotonically increasing implicit value. */
export const RARITY_TIERS = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'] as const;
export type RarityTier = (typeof RARITY_TIERS)[number];

/** Numeric rank used when biasing weighted selection by token tier. */
export const RARITY_RANK: Record<RarityTier, number> = {
  COMMON: 0,
  RARE: 1,
  EPIC: 2,
  LEGENDARY: 3,
};

/** A single prize candidate inside a prize pool. */
export interface PrizePoolEntry {
  entry_id: string;
  pool_id: string;
  prize_slot: string;            // e.g. '7' for dice, 'SEG_A' for wheel, 'THREE_OF_A_KIND'
  name: string;
  description: string;
  rarity: RarityTier;
  /** Base weight (>0). Higher = more likely. */
  base_weight: number;
  /** Optional asset URL — image or animated GIF rendered in UI. */
  asset_url?: string;
  /** ISO timestamp; append-only versioning. */
  created_at_utc: string;
  is_active: boolean;
}

/** A prize pool. May be shared across games or scoped to a single game. */
export interface PrizePool {
  pool_id: string;
  creator_id: string;
  name: string;
  /** When set, pool is only valid for that game. When null, pool is shared. */
  scoped_game_type: GameType | null;
  version: string;
  rule_applied_id: string;
  created_at_utc: string;
  is_active: boolean;
  entries: PrizePoolEntry[];
}

/** Creator-authored per-game configuration. */
export interface CreatorGameConfig {
  config_id: string;
  creator_id: string;
  game_type: GameType;
  /** 1–3 positive-integer token tiers. */
  token_tiers: number[];
  /** Pool to use for this game. May reference a shared pool. */
  prize_pool_id: string;
  /** Override seconds — falls back to platform default if null. */
  cooldown_seconds_override: number | null;
  /** When false, the game is disabled on the creator's surface. */
  enabled: boolean;
  /** Whether this creator accepts RRR-point burns alongside CZT. */
  accepts_rrr_burn: boolean;
  version: string;
  rule_applied_id: string;
  created_at_utc: string;
}

/** Outcome of a server-side weighted selection. */
export interface WeightedSelectionResult {
  entry: PrizePoolEntry;
  /** RNG draw in [0, total_weight). Useful for replay/audit only. */
  draw: number;
  total_weight: number;
}

/** Payment method for a play. */
export type PaymentMethod = 'CZT' | 'RRR';

/** A normalized record of a paid play. Persisted to game_sessions + audit. */
export interface PlayRecord {
  session_id: string;
  user_id: string;
  creator_id: string;
  game_type: GameType;
  token_tier: number;
  payment_method: PaymentMethod;
  /** CZT debit (when CZT) or token-equivalent of burned RRR points (when RRR). */
  tokens_paid: number;
  /** Burn id when payment_method = 'RRR'; null otherwise. */
  rrr_burn_id: string | null;
  ledger_entry_id: string | null;
  prize_slot: string;
  prize_name: string;
  rarity: RarityTier;
  outcome_data: Record<string, number>;
  idempotency_key: string;
  rule_applied_id: string;
  resolved_at_utc: string;
}
