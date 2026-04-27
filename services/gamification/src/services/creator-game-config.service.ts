// services/gamification/src/services/creator-game-config.service.ts
// Per-creator, per-game configuration: token price points (1–3), enable flag,
// optional cooldown override, and RRR burn opt-in. Append-only versioning.

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { GAMIFICATION } from '../../../core-api/src/config/governance.config';
import type {
  CreatorGameConfig,
  GameType,
} from '../types/gamification.types';
import type { UpsertCreatorGameConfigDto } from '../dto/gamification.dto';

/** Persistence contract for creator-game configs. */
export interface CreatorGameConfigRepository {
  insertConfig(config: CreatorGameConfig): Promise<void>;
  findActive(creator_id: string, game_type: GameType): Promise<CreatorGameConfig | null>;
  listActive(creator_id: string): Promise<CreatorGameConfig[]>;
}

export class CreatorGameConfigValidationError extends Error {
  constructor(reason: string) {
    super(`CREATOR_GAME_CONFIG_INVALID: ${reason}`);
    this.name = 'CreatorGameConfigValidationError';
  }
}

@Injectable()
export class CreatorGameConfigService {
  private readonly logger = new Logger(CreatorGameConfigService.name);
  private readonly RULE_ID = 'CREATOR_GAME_CONFIG_v1';

  constructor(private readonly repo: CreatorGameConfigRepository) {}

  async upsert(
    creator_id: string,
    dto: UpsertCreatorGameConfigDto,
  ): Promise<CreatorGameConfig> {
    this.validate(dto);
    const sortedTiers = [...dto.token_tiers].sort((a, b) => a - b);
    const config: CreatorGameConfig = {
      config_id: randomUUID(),
      creator_id,
      game_type: dto.game_type,
      token_tiers: sortedTiers,
      prize_pool_id: dto.prize_pool_id,
      cooldown_seconds_override: dto.cooldown_seconds_override ?? null,
      enabled: dto.enabled,
      accepts_rrr_burn: dto.accepts_rrr_burn,
      version: `v${Date.now()}`,
      rule_applied_id: this.RULE_ID,
      created_at_utc: new Date().toISOString(),
    };
    await this.repo.insertConfig(config);
    this.logger.log('CreatorGameConfigService: config upserted', {
      creator_id,
      game_type: dto.game_type,
      enabled: dto.enabled,
      tiers: sortedTiers,
    });
    return config;
  }

  /**
   * Resolve the active config for a play. Falls back to the platform default
   * (`GAMIFICATION.TOKEN_TIERS`) if the creator has not configured this game,
   * with `enabled: true` so first-time-creator UX is functional out of the box.
   */
  async resolveOrDefault(creator_id: string, game_type: GameType): Promise<CreatorGameConfig> {
    const found = await this.repo.findActive(creator_id, game_type);
    if (found) return found;
    return {
      config_id: 'platform-default',
      creator_id,
      game_type,
      token_tiers: [...GAMIFICATION.TOKEN_TIERS],
      prize_pool_id: '',                         // resolves to creator's shared pool
      cooldown_seconds_override: null,
      enabled: true,
      accepts_rrr_burn: false,
      version: 'v0-platform-default',
      rule_applied_id: this.RULE_ID,
      created_at_utc: new Date(0).toISOString(),
    };
  }

  async listActive(creator_id: string): Promise<CreatorGameConfig[]> {
    return this.repo.listActive(creator_id);
  }

  /**
   * Find the index of the chosen tier within the creator's configured tier
   * array. Returns 0 (low) … N-1 (high). Throws if the tier is not part of
   * the creator's allowed set.
   */
  tierIndexFor(config: CreatorGameConfig, token_tier: number): number {
    const idx = config.token_tiers.indexOf(token_tier);
    if (idx < 0) {
      throw new CreatorGameConfigValidationError(
        `token_tier ${token_tier} not allowed for game ${config.game_type} ` +
          `(allowed: ${config.token_tiers.join(', ')})`,
      );
    }
    return idx;
  }

  // ── validators ────────────────────────────────────────────────────────────

  private validate(dto: UpsertCreatorGameConfigDto): void {
    if (!GAMIFICATION.GAME_TYPES.includes(dto.game_type)) {
      throw new CreatorGameConfigValidationError(`invalid game_type ${dto.game_type}`);
    }
    if (!Array.isArray(dto.token_tiers) || dto.token_tiers.length < 1 || dto.token_tiers.length > 3) {
      throw new CreatorGameConfigValidationError(
        `token_tiers must contain 1–3 entries (got ${dto.token_tiers?.length ?? 0})`,
      );
    }
    const seen = new Set<number>();
    for (const t of dto.token_tiers) {
      if (!Number.isInteger(t) || t <= 0) {
        throw new CreatorGameConfigValidationError(`token_tier must be a positive integer (got ${t})`);
      }
      if (seen.has(t)) {
        throw new CreatorGameConfigValidationError(`duplicate token_tier ${t}`);
      }
      seen.add(t);
    }
    if (!dto.prize_pool_id || dto.prize_pool_id.trim().length === 0) {
      throw new CreatorGameConfigValidationError('prize_pool_id is required');
    }
    if (
      dto.cooldown_seconds_override !== undefined &&
      dto.cooldown_seconds_override !== null &&
      (!Number.isInteger(dto.cooldown_seconds_override) || dto.cooldown_seconds_override < 0)
    ) {
      throw new CreatorGameConfigValidationError(
        `cooldown_seconds_override must be a non-negative integer or null`,
      );
    }
  }
}
