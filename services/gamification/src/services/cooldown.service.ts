// services/gamification/src/services/cooldown.service.ts
// Per-user-per-game cooldown enforcement. Append-only cooldown log: each play
// inserts a row with the next-eligible timestamp; reads compute the maximum
// next_play_at across recent rows.

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { GameType } from '../types/gamification.types';

/** Platform default — overridable per creator-game config. */
export const PLATFORM_DEFAULT_COOLDOWN_SECONDS = 45;

export interface CooldownLogRow {
  log_id: string;
  user_id: string;
  creator_id: string;
  game_type: GameType;
  played_at_utc: string;
  next_play_at_utc: string;
}

export interface CooldownRepository {
  insert(row: CooldownLogRow): Promise<void>;
  /** Returns the latest row for (user, creator, game) or null. */
  latestFor(user_id: string, creator_id: string, game_type: GameType): Promise<CooldownLogRow | null>;
}

export class CooldownViolationError extends Error {
  public readonly retry_after_seconds: number;
  public readonly next_play_at_utc: string;
  constructor(retry_after_seconds: number, next_play_at_utc: string) {
    super(
      `COOLDOWN_ACTIVE: retry in ${retry_after_seconds}s (next eligible at ${next_play_at_utc})`,
    );
    this.name = 'CooldownViolationError';
    this.retry_after_seconds = retry_after_seconds;
    this.next_play_at_utc = next_play_at_utc;
  }
}

@Injectable()
export class CooldownService {
  private readonly logger = new Logger(CooldownService.name);

  constructor(private readonly repo: CooldownRepository) {}

  /**
   * Throws CooldownViolationError if the user is still cooling down for this
   * (creator, game). Otherwise returns silently.
   */
  async assertEligible(
    user_id: string,
    creator_id: string,
    game_type: GameType,
    clock: () => Date = () => new Date(),
  ): Promise<void> {
    const latest = await this.repo.latestFor(user_id, creator_id, game_type);
    if (!latest) return;
    const now = clock().getTime();
    const next = new Date(latest.next_play_at_utc).getTime();
    if (now < next) {
      throw new CooldownViolationError(Math.ceil((next - now) / 1000), latest.next_play_at_utc);
    }
  }

  /**
   * Record a successful play. The cooldown duration is `override ?? default`.
   * Returns the next-eligible timestamp for the UI to render.
   */
  async record(args: {
    user_id: string;
    creator_id: string;
    game_type: GameType;
    cooldown_seconds_override: number | null;
    clock?: () => Date;
  }): Promise<string> {
    const clock = args.clock ?? (() => new Date());
    const now = clock();
    const seconds = args.cooldown_seconds_override ?? PLATFORM_DEFAULT_COOLDOWN_SECONDS;
    const next = new Date(now.getTime() + seconds * 1000).toISOString();
    const row: CooldownLogRow = {
      log_id: randomUUID(),
      user_id: args.user_id,
      creator_id: args.creator_id,
      game_type: args.game_type,
      played_at_utc: now.toISOString(),
      next_play_at_utc: next,
    };
    await this.repo.insert(row);
    this.logger.debug('CooldownService: cooldown recorded', {
      user_id: args.user_id,
      game_type: args.game_type,
      seconds,
      next,
    });
    return next;
  }
}
