// services/gamification/src/services/redroom-rewards-burn.service.ts
// RedRoom Rewards (RRR) burn integration. The burn endpoint contract follows
// the cross-system convention from Payload #13 (`/api/v1/burn/gift`) but the
// reason is "play" rather than "gift". Network call is delegated to an
// injected client so the service is testable.

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  GIFT_TOKEN_USD_VALUE,
  RRR_GIFT_COMMISSION_PCT,
  RRR_POINT_USD_VALUE,
} from '../../../core-api/src/config/governance.config';
import type { GameType } from '../types/gamification.types';

/**
 * Compute the RRR-points price equivalent to a given CZT token amount.
 * Uses the same formula as `rrrPointsPriceFor` in governance.config but
 * accepts an arbitrary token count (a play tier rather than a gift).
 */
export function rrrPointsForTokens(tokens: number): number {
  const tokenUsd = tokens * GIFT_TOKEN_USD_VALUE;
  const baseRrrPoints = tokenUsd / RRR_POINT_USD_VALUE;
  return Math.ceil(baseRrrPoints * (1 + RRR_GIFT_COMMISSION_PCT));
}

export interface BurnRecord {
  burn_id: string;
  user_id: string;
  creator_id: string;
  game_type: GameType;
  rrr_points_burned: number;
  czt_tokens_equivalent: number;
  correlation_id: string;
  reason_code: 'GAME_PLAY';
  burned_at_utc: string;
}

export interface RrrBurnRepository {
  insert(record: BurnRecord): Promise<void>;
  findByCorrelationId(correlation_id: string): Promise<BurnRecord | null>;
}

/** Network adapter to RRR. Production wiring lives in services/integration-hub. */
export interface RrrBurnClient {
  burnPoints(args: {
    user_id: string;
    points: number;
    reason: 'play';
    correlation_id: string;
  }): Promise<{ ok: boolean; remote_burn_id: string }>;
}

export class RrrBurnError extends Error {
  constructor(reason: string) {
    super(`RRR_BURN_FAILED: ${reason}`);
    this.name = 'RrrBurnError';
  }
}

@Injectable()
export class RedRoomRewardsBurnService {
  private readonly logger = new Logger(RedRoomRewardsBurnService.name);

  constructor(
    private readonly repo: RrrBurnRepository,
    private readonly client: RrrBurnClient,
  ) {}

  /**
   * Idempotent: a replay with the same `correlation_id` returns the prior
   * burn record. On first call we ship the burn to RRR and persist locally.
   */
  async burnForPlay(args: {
    user_id: string;
    creator_id: string;
    game_type: GameType;
    czt_tokens_equivalent: number;
    correlation_id: string;
  }): Promise<BurnRecord> {
    const existing = await this.repo.findByCorrelationId(args.correlation_id);
    if (existing) return existing;

    const points = rrrPointsForTokens(args.czt_tokens_equivalent);
    const remote = await this.client.burnPoints({
      user_id: args.user_id,
      points,
      reason: 'play',
      correlation_id: args.correlation_id,
    });
    if (!remote.ok) throw new RrrBurnError('remote burn rejected');

    const record: BurnRecord = {
      burn_id: randomUUID(),
      user_id: args.user_id,
      creator_id: args.creator_id,
      game_type: args.game_type,
      rrr_points_burned: points,
      czt_tokens_equivalent: args.czt_tokens_equivalent,
      correlation_id: args.correlation_id,
      reason_code: 'GAME_PLAY',
      burned_at_utc: new Date().toISOString(),
    };
    await this.repo.insert(record);
    this.logger.log('RedRoomRewardsBurnService: burn settled', {
      burn_id: record.burn_id,
      user_id: args.user_id,
      points,
      czt_tokens_equivalent: args.czt_tokens_equivalent,
    });
    return record;
  }
}
