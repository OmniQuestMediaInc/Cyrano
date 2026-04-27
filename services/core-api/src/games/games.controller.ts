// services/core-api/src/games/games.controller.ts
// BIJOU: GM-002 — Games controller enforcing debit-before-reveal invariant
// Doctrine: token debit via LedgerService MUST precede outcome resolution.
import { Controller, Post, Body, HttpCode, HttpStatus, Logger, UseGuards } from '@nestjs/common';
import { GameEngineService, GameType } from './game-engine.service';
import { ZoneAccessGuard, ZoneGate } from '../zone-access/zone-access.guard';

export interface InitiatePlayRequest {
  user_id: string;
  creator_id: string;
  game_type: GameType;
  token_tier: number;
  // Prize table provided by caller (fetched from prize_tables by client)
  prize_table: Array<{ prize_slot: string; prize_description: string }>;
}

export interface PlayResponse {
  session_id: string;
  game_type: GameType;
  token_tier: number;
  outcome_data: Record<string, number>;
  prize_slot: string;
  prize_description: string;
  idempotency_key: string;
  resolved_at_utc: string;
  // Audit trail
  rule_applied_id: string;
}

@Controller('games')
@UseGuards(ZoneAccessGuard)
@ZoneGate('BIJOU')
export class GamesController {
  private readonly logger = new Logger(GamesController.name);

  constructor(private readonly gameEngine: GameEngineService) {}

  /**
   * POST /games/play
   *
   * Orchestration order (INVARIANT — do not reorder):
   * 1. Validate play request via initiatePlay()
   * 2. [CALLER RESPONSIBILITY] Debit tokens via LedgerService before calling
   *    this endpoint — the ledger_entry_id must be passed in the request body.
   *    This endpoint will NOT debit tokens itself; it enforces that a
   *    ledger_entry_id proving debit is present before resolving outcome.
   * 3. Resolve outcome via resolveOutcome()
   * 4. Return outcome to client for animation
   *
   * NOTE: Full LedgerService integration is a follow-on directive (GM-003).
   * This controller currently validates and resolves but does not independently
   * verify the ledger_entry_id against the database.
   * That verification will be added in GM-003 once TypeORM is fully wired.
   */
  @Post('play')
  @HttpCode(HttpStatus.OK)
  play(@Body() body: InitiatePlayRequest & { ledger_entry_id: string }): PlayResponse {
    // Guard: ledger_entry_id must be present — proves debit occurred
    if (!body.ledger_entry_id || body.ledger_entry_id.trim().length === 0) {
      this.logger.error('GamesController: play rejected — no ledger_entry_id provided', {
        user_id: body.user_id,
        game_type: body.game_type,
      });
      throw new Error(
        'DEBIT_REQUIRED: ledger_entry_id must be provided before outcome can be resolved. ' +
          'Debit tokens via LedgerService first.',
      );
    }

    const initResult = this.gameEngine.initiatePlay({
      user_id: body.user_id,
      creator_id: body.creator_id,
      game_type: body.game_type,
      token_tier: body.token_tier,
    });

    if (!initResult.valid) {
      throw new Error(`INVALID_PLAY: ${initResult.error}`);
    }

    const outcome = this.gameEngine.resolveOutcome({
      session_id: initResult.idempotency_key,
      game_type: body.game_type,
      token_tier: body.token_tier,
      prize_table: body.prize_table,
    });

    const matched_prize = body.prize_table.find((p) => p.prize_slot === outcome.prize_slot);

    this.logger.log('GamesController: play resolved', {
      session_id: outcome.session_id,
      ledger_entry_id: body.ledger_entry_id,
      prize_slot: outcome.prize_slot,
    });

    return {
      session_id: outcome.session_id,
      game_type: outcome.game_type,
      token_tier: outcome.token_tier,
      outcome_data: outcome.outcome_data,
      prize_slot: outcome.prize_slot,
      prize_description: matched_prize?.prize_description ?? 'Prize',
      idempotency_key: initResult.idempotency_key,
      resolved_at_utc: outcome.resolved_at_utc,
      rule_applied_id: outcome.rule_applied_id,
    };
  }
}
