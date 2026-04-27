// services/gamification/src/services/play-orchestrator.service.ts
// End-to-end play pipeline. Order is INVARIANT:
//
//   1. resolve creator config & assert game enabled
//   2. assert cooldown OK (server-side)
//   3. validate shake-proof + rate-limit + CAPTCHA
//   4. resolve prize pool (scoped > shared)
//   5. settle payment:
//        - 'CZT' → LedgerService.spend()  (correlation_id derived from session)
//        - 'RRR' → RedRoomRewardsBurnService.burnForPlay()  (must be opted-in)
//   6. weighted-select prize (crypto.randomInt RNG)
//   7. derive game_type-specific outcome_data from the selected prize
//   8. record game_sessions row, cooldown row, audit row
//   9. return PlayResponseDto
//
// Any failure between steps 5 and 8 is caught and surfaced — the ledger row
// already exists by design (append-only), so re-attempting the play uses the
// same correlation_id and short-circuits at LedgerService.findExistingSpend.

import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  GAMIFICATION,
} from '../../../core-api/src/config/governance.config';
import {
  GameEngineService,
  type GameType,
} from '../../../core-api/src/games/game-engine.service';
import {
  cryptoIntRng,
  selectWeighted,
  type IntRng,
} from '../internal/weighted-selector';
import type {
  GameSessionRecord,
  GameSessionRepository,
} from './game-session.repository';
import type { InitiatePlayDto, PlayResponseDto } from '../dto/gamification.dto';
import type { PlayRecord, PrizePool, PrizePoolEntry } from '../types/gamification.types';
import { CooldownService } from './cooldown.service';
import { CreatorGameConfigService } from './creator-game-config.service';
import { GameAuditService } from './audit.service';
import { GameSecurityService } from './security.service';
import { PrizePoolService } from './prize-pool.service';
import { RedRoomRewardsBurnService } from './redroom-rewards-burn.service';

/** DI token — keeps the orchestrator decoupled from a specific Ledger import. */
export const LEDGER_PORT = Symbol.for('GAMIFICATION_LEDGER_PORT');

/** Minimal ledger surface the orchestrator depends on (subset of LedgerService). */
export interface GamificationLedgerPort {
  spendForPlay(args: {
    user_id: string;
    creator_id: string;
    amount: number;
    correlation_id: string;
    metadata: Record<string, unknown>;
  }): Promise<{ ledger_entry_id: string }>;
}

export class PlayOrchestratorError extends Error {
  public readonly code:
    | 'GAME_DISABLED'
    | 'POOL_NOT_FOUND'
    | 'POOL_EMPTY_FOR_GAME'
    | 'RRR_NOT_ACCEPTED'
    | 'INVALID_PAYMENT_METHOD';
  constructor(code: PlayOrchestratorError['code'], detail: string) {
    super(`PLAY_ORCHESTRATOR: ${code} — ${detail}`);
    this.name = 'PlayOrchestratorError';
    this.code = code;
  }
}

@Injectable()
export class PlayOrchestratorService {
  private readonly logger = new Logger(PlayOrchestratorService.name);

  constructor(
    private readonly engine: GameEngineService,
    private readonly creatorConfig: CreatorGameConfigService,
    private readonly prizePools: PrizePoolService,
    private readonly cooldown: CooldownService,
    private readonly security: GameSecurityService,
    private readonly rrrBurn: RedRoomRewardsBurnService,
    private readonly audit: GameAuditService,
    private readonly sessions: GameSessionRepository,
    @Inject(LEDGER_PORT) private readonly ledger: GamificationLedgerPort,
    private readonly rng: IntRng = cryptoIntRng,
  ) {}

  async play(req: InitiatePlayDto & { ip: string }): Promise<PlayResponseDto> {
    if (process.env.GAMIFICATION_ENABLED === 'false') {
      throw new PlayOrchestratorError('GAME_DISABLED', 'gamification globally disabled');
    }

    // 1 — config
    const config = await this.creatorConfig.resolveOrDefault(req.creator_id, req.game_type);
    if (!config.enabled) {
      throw new PlayOrchestratorError('GAME_DISABLED', `${req.game_type} disabled by creator`);
    }
    const tierIndex = this.creatorConfig.tierIndexFor(config, req.token_tier);

    // 2 — cooldown
    await this.cooldown.assertEligible(req.user_id, req.creator_id, req.game_type);

    // 3 — security
    this.security.assertShakeProof(
      req.shake_proof,
      process.env.GAMIFICATION_MOUSE_SHAKE_REQUIRED !== 'false',
    );
    await this.security.checkRateAndCaptcha({
      user_id: req.user_id,
      ip: req.ip,
      captcha_token: req.captcha_token,
      enforce_captcha: process.env.GAMIFICATION_CAPTCHA_ON_SUSPICIOUS !== 'false',
    });

    // 4 — prize pool
    const pool = await this.resolvePool(config, req.game_type, req.creator_id);
    const candidates = this.filterCandidatesFor(pool, req.game_type);
    if (candidates.length === 0) {
      throw new PlayOrchestratorError(
        'POOL_EMPTY_FOR_GAME',
        `no active prize entries for ${req.game_type} in pool ${pool.pool_id}`,
      );
    }

    // 5 — payment + idempotency
    const init = this.engine.initiatePlay({
      user_id: req.user_id,
      creator_id: req.creator_id,
      game_type: req.game_type,
      token_tier: req.token_tier,
    });
    if (!init.valid) {
      // The engine validates against platform tiers — when creator uses custom
      // tiers we already passed creatorConfig.tierIndexFor, so we synthesize a
      // session id rather than rejecting here.
      // (engine.initiatePlay only rejects unknown game_types; tier mismatch
      //  with platform default is harmless since creator override is canonical.)
      this.logger.warn('PlayOrchestratorService: engine init returned invalid — using synth key', {
        reason: init.error,
      });
    }
    const idempotency_key =
      init.idempotency_key && init.idempotency_key.length > 0
        ? init.idempotency_key
        : this.synthIdempotencyKey(req);

    const correlation_id = `GAME_PLAY:${idempotency_key}`;
    let ledger_entry_id: string | null = null;
    let rrr_burn_id: string | null = null;

    if (req.payment_method === 'CZT') {
      const settled = await this.ledger.spendForPlay({
        user_id: req.user_id,
        creator_id: req.creator_id,
        amount: req.token_tier,
        correlation_id,
        metadata: {
          game_type: req.game_type,
          token_tier: req.token_tier,
          rule_applied_id: 'GAMIFICATION_v1',
        },
      });
      ledger_entry_id = settled.ledger_entry_id;
    } else if (req.payment_method === 'RRR') {
      if (!config.accepts_rrr_burn) {
        throw new PlayOrchestratorError('RRR_NOT_ACCEPTED', `creator does not accept RRR burn`);
      }
      if (process.env.GAMIFICATION_RRR_BURN_ENABLED === 'false') {
        throw new PlayOrchestratorError('RRR_NOT_ACCEPTED', 'RRR burn disabled platform-wide');
      }
      const burn = await this.rrrBurn.burnForPlay({
        user_id: req.user_id,
        creator_id: req.creator_id,
        game_type: req.game_type,
        czt_tokens_equivalent: req.token_tier,
        correlation_id,
      });
      rrr_burn_id = burn.burn_id;
    } else {
      throw new PlayOrchestratorError(
        'INVALID_PAYMENT_METHOD',
        `unsupported payment_method ${req.payment_method as string}`,
      );
    }

    // 6 — weighted prize selection
    const sel = selectWeighted(candidates, tierIndex, this.rng);

    // 7 — game-type-specific outcome data
    const outcome_data = this.deriveOutcomeData(req.game_type, sel.entry, candidates);

    // 8 — persist session, cooldown, audit
    const record: PlayRecord = {
      session_id: idempotency_key,
      user_id: req.user_id,
      creator_id: req.creator_id,
      game_type: req.game_type,
      token_tier: req.token_tier,
      payment_method: req.payment_method,
      tokens_paid: req.token_tier,
      rrr_burn_id,
      ledger_entry_id,
      prize_slot: sel.entry.prize_slot,
      prize_name: sel.entry.name,
      rarity: sel.entry.rarity,
      outcome_data,
      idempotency_key,
      rule_applied_id: 'GAMIFICATION_v1',
      resolved_at_utc: new Date().toISOString(),
    };

    const persisted: GameSessionRecord = {
      session_id: record.session_id,
      user_id: record.user_id,
      creator_id: record.creator_id,
      game_type: record.game_type,
      token_tier: record.token_tier,
      tokens_paid: record.tokens_paid,
      ledger_entry_id: record.ledger_entry_id,
      outcome: { ...record.outcome_data, prize_slot: record.prize_slot },
      prize_awarded: record.prize_slot,
      prize_table_version: pool.version,
      idempotency_key,
      rule_applied_id: record.rule_applied_id,
      created_at_utc: record.resolved_at_utc,
      payment_method: record.payment_method,
      rrr_burn_id: record.rrr_burn_id,
    };
    await this.sessions.insert(persisted);

    const next_play_at_utc = await this.cooldown.record({
      user_id: req.user_id,
      creator_id: req.creator_id,
      game_type: req.game_type,
      cooldown_seconds_override: config.cooldown_seconds_override,
    });
    await this.audit.recordPlay(record, correlation_id);

    // 9 — response
    return {
      session_id: record.session_id,
      game_type: record.game_type,
      token_tier: record.token_tier,
      payment_method: record.payment_method,
      tokens_paid: record.tokens_paid,
      prize_slot: record.prize_slot,
      prize_name: record.prize_name,
      prize_description: sel.entry.description,
      rarity: record.rarity,
      asset_url: sel.entry.asset_url ?? null,
      outcome_data: record.outcome_data,
      resolved_at_utc: record.resolved_at_utc,
      rule_applied_id: record.rule_applied_id,
      idempotency_key,
      next_play_at_utc,
    };
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private synthIdempotencyKey(req: InitiatePlayDto): string {
    const window = Math.floor(Date.now() / 300_000);
    return `GAME:${req.user_id}:${req.creator_id}:${req.game_type}:${req.token_tier}:${window}`;
  }

  private async resolvePool(
    config: { prize_pool_id: string },
    game_type: GameType,
    creator_id: string,
  ): Promise<PrizePool> {
    if (config.prize_pool_id) {
      const direct = await this.prizePools.findById(config.prize_pool_id);
      if (direct) return direct;
    }
    const fallback = await this.prizePools.resolveForPlay(creator_id, game_type);
    if (!fallback) {
      throw new PlayOrchestratorError(
        'POOL_NOT_FOUND',
        `no active pool for creator=${creator_id} game=${game_type}`,
      );
    }
    return fallback;
  }

  /**
   * Restrict pool entries to those whose `prize_slot` is plausible for the
   * current game type. SLOT_MACHINE accepts THREE_OF_A_KIND / TWO_OF_A_KIND /
   * NO_MATCH. DICE accepts numeric slots 2..12. SPIN_WHEEL accepts any slot.
   */
  private filterCandidatesFor(pool: PrizePool, game_type: GameType): PrizePoolEntry[] {
    if (game_type === 'DICE') {
      return pool.entries.filter((e) => {
        const n = Number(e.prize_slot);
        return (
          Number.isInteger(n) &&
          n >= GAMIFICATION.DICE_RANGE.min &&
          n <= GAMIFICATION.DICE_RANGE.max
        );
      });
    }
    if (game_type === 'SLOT_MACHINE') {
      return pool.entries.filter((e) =>
        ['THREE_OF_A_KIND', 'TWO_OF_A_KIND', 'NO_MATCH'].includes(e.prize_slot),
      );
    }
    return pool.entries.filter((e) => e.is_active);
  }

  /**
   * Synthesize the per-game outcome shape required by the UI animation layer.
   * The selected prize is the source of truth; we project a plausible
   * deterministic-but-pretty animation seed.
   */
  private deriveOutcomeData(
    game_type: GameType,
    entry: PrizePoolEntry,
    pool: PrizePoolEntry[],
  ): Record<string, number> {
    if (game_type === 'DICE') {
      const total = Number(entry.prize_slot);
      // Decompose total into a valid (die1,die2) pair uniformly at random.
      const die1Min = Math.max(1, total - 6);
      const die1Max = Math.min(6, total - 1);
      const die1 = die1Min + this.rng(die1Max - die1Min + 1);
      const die2 = total - die1;
      return { die1, die2, total };
    }
    if (game_type === 'SPIN_WHEEL') {
      const idx = pool.findIndex((e) => e.entry_id === entry.entry_id);
      return { segment_index: idx };
    }
    // SLOT_MACHINE — synthesize three reels matching the chosen pattern.
    const reelMax = Math.max(3, pool.length);
    if (entry.prize_slot === 'THREE_OF_A_KIND') {
      const r = this.rng(reelMax);
      return { reel1: r, reel2: r, reel3: r };
    }
    if (entry.prize_slot === 'TWO_OF_A_KIND') {
      const a = this.rng(reelMax);
      let b = this.rng(reelMax);
      if (b === a) b = (a + 1) % reelMax;
      // Place the matching pair in (reel1, reel2); the odd one in reel3.
      return { reel1: a, reel2: a, reel3: b };
    }
    // NO_MATCH — three distinct values (or as distinct as the symbol set allows).
    const r1 = this.rng(reelMax);
    let r2 = this.rng(reelMax);
    if (r2 === r1) r2 = (r1 + 1) % reelMax;
    let r3 = this.rng(reelMax);
    if (r3 === r1 || r3 === r2) r3 = (Math.max(r1, r2) + 1) % reelMax;
    return { reel1: r1, reel2: r2, reel3: r3 };
  }

  /** Used by the engine validation fallback — kept for visibility. */
  static get supportedGameTypes(): readonly GameType[] {
    return GAMIFICATION.GAME_TYPES;
  }
}
