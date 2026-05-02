// PAYLOAD G1 — UI contracts for the creator gamification dashboard +
// player game surfaces. Mirrors services/gamification/src/dto/gamification.dto.ts
// 1:1 so a future Next.js page can bind without re-deriving field names.
//
// @alpha-frozen — wireframe binding target for Grok handoff
// (docs/UX_INTEGRATION_BRIEF.md §1). Note: SLOT_MACHINE is RETIRED across
// OQMI properties — kept on this enum only for backend type-compat with the
// gamification service DTO. The dedicated UI presenter at
// ui/components/slot-machine.ts is a throw-stub, but this value may still
// appear in current payloads until remaining UI surfaces are filtered. New
// UI work must not introduce slot machine rendering. See brief §8.

/**
 * @alpha-frozen — see brief §8.
 * SPIN_WHEEL and DICE are the in-scope gamification UI surfaces.
 * @deprecated SLOT_MACHINE — RETIRED across OQMI properties and retained
 * for backend type-compat. Treat as deprecated in UI code; filtering of
 * legacy Slot Machine surfaces is handled outside this file.
 */
export type GameType = 'SPIN_WHEEL' | 'SLOT_MACHINE' | 'DICE';
export type RarityTier = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
export type PaymentMethod = 'CZT' | 'RRR';

export interface PrizePoolEntryViewModel {
  prize_slot: string;
  name: string;
  description: string;
  rarity: RarityTier;
  base_weight: number;
  asset_url?: string;
}

export interface PrizePoolViewModel {
  pool_id: string;
  name: string;
  scoped_game_type: GameType | null;
  version: string;
  is_active: boolean;
  entries: PrizePoolEntryViewModel[];
}

export interface CreatorGameConfigViewModel {
  game_type: GameType;
  token_tiers: number[];
  prize_pool_id: string;
  cooldown_seconds_override: number | null;
  enabled: boolean;
  accepts_rrr_burn: boolean;
}

/** Card rendered for each game in the creator gamification dashboard. */
export interface CreatorGameCard {
  game_type: GameType;
  display_name: string;            // 'Wheel of Fortune' | 'Slot Machine' | 'Dice'
  enabled: boolean;
  token_tiers: number[];
  cooldown_seconds: number;        // resolved (override ?? default)
  accepts_rrr_burn: boolean;
  active_pool_name: string | null;
  /** Quick analytics for the last 30 days. */
  stat_30d: {
    plays: number;
    czt_revenue: number;
    win_rate_pct: number;
  };
}

/** Top-level dashboard payload for /creator/gamification. */
export interface CreatorGamificationDashboard {
  creator_id: string;
  pools: PrizePoolViewModel[];
  cards: CreatorGameCard[];
  rrr_burn_globally_enabled: boolean;
  captured_at_utc: string;
}

/** Player-facing card per game on the chat surface (price + cooldown). */
export interface PlayerGameOption {
  game_type: GameType;
  display_name: string;
  token_tiers: number[];
  payment_methods: PaymentMethod[];
  next_play_at_utc: string | null; // null = ready
}

/** Outcome payload sent to the client after a play resolves. */
export interface PlayOutcomeView {
  session_id: string;
  game_type: GameType;
  payment_method: PaymentMethod;
  tokens_paid: number;
  prize_slot: string;
  prize_name: string;
  prize_description: string;
  rarity: RarityTier;
  asset_url: string | null;
  outcome_data: Record<string, number>;
  resolved_at_utc: string;
  next_play_at_utc: string;
}

/** Mouse-shake telemetry sampled in the dice UI before release. */
export interface ShakeProofPayload {
  duration_ms: number;
  samples: number;
  avg_amplitude_px: number;
}
