// services/gamification/src/services/prize-pool.service.ts
// Manages creator prize pools. Append-only versioning: any "edit" produces a
// new row with a bumped version. Resolves the active pool for a given
// (creator, game) combination, applying scoped > shared precedence.

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  RARITY_TIERS,
  type GameType,
  type PrizePool,
  type PrizePoolEntry,
  type RarityTier,
} from '../types/gamification.types';
import type { UpsertPrizePoolDto } from '../dto/gamification.dto';

/**
 * Persistence contract. Implementations live in a database adapter; in tests
 * an in-memory implementation is supplied. The orchestrator never instantiates
 * the repository directly — it is wired via DI in `GamificationModule`.
 */
export interface PrizePoolRepository {
  insertPool(pool: PrizePool): Promise<void>;
  findPoolById(pool_id: string): Promise<PrizePool | null>;
  /** Returns active pools belonging to a creator, newest first. */
  listActiveByCreator(creator_id: string): Promise<PrizePool[]>;
  /** Soft-deactivate by inserting a tombstone row with is_active=false. */
  deactivatePool(creator_id: string, pool_id: string, version: string): Promise<void>;
}

/** Token thrown for invalid prize pool input. */
export class PrizePoolValidationError extends Error {
  constructor(reason: string) {
    super(`PRIZE_POOL_INVALID: ${reason}`);
    this.name = 'PrizePoolValidationError';
  }
}

@Injectable()
export class PrizePoolService {
  private readonly logger = new Logger(PrizePoolService.name);
  private readonly RULE_ID = 'PRIZE_POOL_v1';

  constructor(private readonly repo: PrizePoolRepository) {}

  /** Create-or-revise a prize pool. Each call inserts a fresh version. */
  async upsert(creator_id: string, dto: UpsertPrizePoolDto): Promise<PrizePool> {
    this.validate(dto);
    const pool_id = dto.pool_id ?? randomUUID();
    const now = new Date().toISOString();
    const version = `v${Date.now()}`;
    const entries: PrizePoolEntry[] = dto.entries.map((e) => ({
      entry_id: randomUUID(),
      pool_id,
      prize_slot: e.prize_slot,
      name: e.name,
      description: e.description,
      rarity: e.rarity,
      base_weight: e.base_weight,
      asset_url: e.asset_url,
      created_at_utc: now,
      is_active: true,
    }));
    const pool: PrizePool = {
      pool_id,
      creator_id,
      name: dto.name,
      scoped_game_type: dto.scoped_game_type,
      version,
      rule_applied_id: this.RULE_ID,
      created_at_utc: now,
      is_active: true,
      entries,
    };
    await this.repo.insertPool(pool);
    this.logger.log('PrizePoolService: pool upserted', {
      creator_id,
      pool_id,
      version,
      entry_count: entries.length,
      scoped_game_type: dto.scoped_game_type,
    });
    return pool;
  }

  /**
   * Resolve the prize pool that should drive a play. Precedence:
   *   1. The creator's per-game-config-referenced pool (if any).
   *   2. The newest scoped pool matching `game_type`.
   *   3. The newest shared pool (`scoped_game_type=null`).
   * Returns null if nothing is configured.
   */
  async resolveForPlay(creator_id: string, game_type: GameType): Promise<PrizePool | null> {
    const all = await this.repo.listActiveByCreator(creator_id);
    if (all.length === 0) return null;
    const scoped = all.find((p) => p.scoped_game_type === game_type);
    if (scoped) return scoped;
    const shared = all.find((p) => p.scoped_game_type === null);
    return shared ?? null;
  }

  async findById(pool_id: string): Promise<PrizePool | null> {
    return this.repo.findPoolById(pool_id);
  }

  /** Mark a pool as no-longer-active (append-only tombstone). */
  async deactivate(creator_id: string, pool_id: string): Promise<void> {
    const version = `v${Date.now()}-deactivated`;
    await this.repo.deactivatePool(creator_id, pool_id, version);
    this.logger.log('PrizePoolService: pool deactivated', { creator_id, pool_id, version });
  }

  // ── validators ────────────────────────────────────────────────────────────

  private validate(dto: UpsertPrizePoolDto): void {
    if (!dto.name || dto.name.trim().length === 0) {
      throw new PrizePoolValidationError('name is required');
    }
    if (!Array.isArray(dto.entries) || dto.entries.length === 0) {
      throw new PrizePoolValidationError('at least one prize entry is required');
    }
    if (dto.entries.length > 100) {
      throw new PrizePoolValidationError('max 100 prize entries per pool');
    }
    const slots = new Set<string>();
    for (const e of dto.entries) {
      if (!e.prize_slot) throw new PrizePoolValidationError('prize_slot is required');
      if (slots.has(e.prize_slot)) {
        throw new PrizePoolValidationError(`duplicate prize_slot ${e.prize_slot}`);
      }
      slots.add(e.prize_slot);
      if (!RARITY_TIERS.includes(e.rarity as RarityTier)) {
        throw new PrizePoolValidationError(`invalid rarity ${e.rarity}`);
      }
      if (!Number.isFinite(e.base_weight) || e.base_weight <= 0) {
        throw new PrizePoolValidationError(`base_weight must be > 0 (got ${e.base_weight})`);
      }
    }
  }
}
