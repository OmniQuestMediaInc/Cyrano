// services/core-api/src/games/game-engine.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { randomInt } from 'crypto';
import { GAMIFICATION } from '../config/governance.config';

export type GameType = 'SPIN_WHEEL' | 'SLOT_MACHINE' | 'DICE';

export interface GameOutcome {
  session_id: string;
  game_type: GameType;
  token_tier: number;
  outcome_data: {
    // DICE: { die1: number, die2: number, total: number }
    // SPIN_WHEEL: { segment_index: number }
    // SLOT_MACHINE: { reel1: number, reel2: number, reel3: number }
    [key: string]: number;
  };
  prize_slot: string; // Maps to prize_tables.prize_slot
  resolved_at_utc: string;
  rule_applied_id: string;
}

@Injectable()
export class GameEngineService {
  private readonly logger = new Logger(GameEngineService.name);
  private readonly RULE_ID = 'GAMIFICATION_v1';

  /**
   * STEP 1: Validate the play request.
   * Called BEFORE token debit. Returns the idempotency key to use.
   * Caller must then debit tokens via LedgerService, THEN call resolveOutcome().
   */
  initiatePlay(params: {
    user_id: string;
    creator_id: string;
    game_type: GameType;
    token_tier: number;
  }): { idempotency_key: string; valid: boolean; error?: string } {
    if (!GAMIFICATION.GAME_TYPES.includes(params.game_type)) {
      return { idempotency_key: '', valid: false, error: `Invalid game_type: ${params.game_type}` };
    }
    if (!GAMIFICATION.TOKEN_TIERS.includes(params.token_tier as 25 | 45 | 60)) {
      return {
        idempotency_key: '',
        valid: false,
        error: `Invalid token_tier: ${params.token_tier}. Must be one of ${GAMIFICATION.TOKEN_TIERS.join(', ')}`,
      };
    }
    // Idempotency key is time-bucketed to 5-minute windows to prevent replay while
    // allowing legitimate retries after network failure
    const window = Math.floor(Date.now() / 300000);
    const idempotency_key = `GAME:${params.user_id}:${params.creator_id}:${params.game_type}:${params.token_tier}:${window}`;
    return { idempotency_key, valid: true };
  }

  /**
   * STEP 2: Resolve the outcome. Called AFTER confirmed token debit.
   * Uses crypto.randomInt() — never Math.random().
   * Result is deterministic from the RNG — no post-hoc manipulation possible.
   */
  resolveOutcome(params: {
    session_id: string;
    game_type: GameType;
    token_tier: number;
    prize_table: Array<{ prize_slot: string; prize_description: string }>;
  }): GameOutcome {
    let outcome_data: Record<string, number>;
    let prize_slot: string;

    switch (params.game_type) {
      case 'DICE': {
        const die1 = randomInt(1, 7); // 1–6 inclusive
        const die2 = randomInt(1, 7);
        const total = die1 + die2;
        outcome_data = { die1, die2, total };
        // Prize slot = the rolled total (2–12). Look up in prize table.
        prize_slot = String(total);
        break;
      }
      case 'SPIN_WHEEL': {
        const segment_index = randomInt(0, params.prize_table.length);
        outcome_data = { segment_index };
        prize_slot = params.prize_table[segment_index]?.prize_slot ?? '0';
        break;
      }
      case 'SLOT_MACHINE': {
        const reel1 = randomInt(0, params.prize_table.length);
        const reel2 = randomInt(0, params.prize_table.length);
        const reel3 = randomInt(0, params.prize_table.length);
        outcome_data = { reel1, reel2, reel3 };
        // Three-of-a-kind = top prize; two-of-a-kind = mid prize; else = consolation
        if (reel1 === reel2 && reel2 === reel3) {
          prize_slot = 'THREE_OF_A_KIND';
        } else if (reel1 === reel2 || reel2 === reel3 || reel1 === reel3) {
          prize_slot = 'TWO_OF_A_KIND';
        } else {
          prize_slot = 'NO_MATCH';
        }
        break;
      }
    }

    this.logger.log('GameEngineService: outcome resolved', {
      session_id: params.session_id,
      game_type: params.game_type,
      token_tier: params.token_tier,
      prize_slot,
      rule_applied_id: this.RULE_ID,
    });

    return {
      session_id: params.session_id,
      game_type: params.game_type,
      token_tier: params.token_tier,
      outcome_data,
      prize_slot,
      resolved_at_utc: new Date().toISOString(),
      rule_applied_id: this.RULE_ID,
    };
  }
}
