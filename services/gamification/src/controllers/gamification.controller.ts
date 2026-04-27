// services/gamification/src/controllers/gamification.controller.ts
// REST surface for the gamification module. Mounted at /gamification by the
// CoreApiModule. Reuses ZoneAccessGuard at BIJOU level (same as legacy
// GamesController) — gameplay is a wallet-debiting action and must enforce
// zone gating.

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ZoneAccessGuard, ZoneGate } from '../../../core-api/src/zone-access/zone-access.guard';
import type {
  AnalyticsSummaryDto,
  ExportPrizePoolDto,
  ImportPrizePoolDto,
  InitiatePlayDto,
  PlayResponseDto,
  UpsertCreatorGameConfigDto,
  UpsertPrizePoolDto,
} from '../dto/gamification.dto';
import type { CreatorGameConfig, PrizePool } from '../types/gamification.types';
import { CreatorGameConfigService } from '../services/creator-game-config.service';
import { GameAnalyticsService } from '../services/analytics.service';
import { PlayOrchestratorService } from '../services/play-orchestrator.service';
import { PrizePoolService } from '../services/prize-pool.service';

@Controller('gamification')
@UseGuards(ZoneAccessGuard)
@ZoneGate('BIJOU')
export class GamificationController {
  private readonly logger = new Logger(GamificationController.name);

  constructor(
    private readonly orchestrator: PlayOrchestratorService,
    private readonly prizePools: PrizePoolService,
    private readonly creatorConfig: CreatorGameConfigService,
    private readonly analytics: GameAnalyticsService,
  ) {}

  // ── Player surface ────────────────────────────────────────────────────────

  @Post('play')
  @HttpCode(HttpStatus.OK)
  async play(@Body() body: InitiatePlayDto, @Req() req: Request): Promise<PlayResponseDto> {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    return this.orchestrator.play({ ...body, ip });
  }

  // ── Creator config surface ────────────────────────────────────────────────

  @Post('creator/:creator_id/prize-pools')
  @HttpCode(HttpStatus.CREATED)
  async upsertPool(
    @Param('creator_id') creator_id: string,
    @Body() dto: UpsertPrizePoolDto,
  ): Promise<PrizePool> {
    return this.prizePools.upsert(creator_id, dto);
  }

  @Post('creator/:creator_id/prize-pools/:pool_id/deactivate')
  @HttpCode(HttpStatus.OK)
  async deactivatePool(
    @Param('creator_id') creator_id: string,
    @Param('pool_id') pool_id: string,
  ): Promise<{ ok: true }> {
    await this.prizePools.deactivate(creator_id, pool_id);
    return { ok: true };
  }

  @Get('creator/:creator_id/prize-pools/:pool_id/export')
  async exportPool(
    @Param('creator_id') creator_id: string,
    @Param('pool_id') pool_id: string,
  ): Promise<ExportPrizePoolDto> {
    const pool = await this.prizePools.findById(pool_id);
    if (!pool || pool.creator_id !== creator_id) {
      throw new Error(`PRIZE_POOL_NOT_FOUND: ${pool_id} for creator ${creator_id}`);
    }
    return {
      format: 'JSON_V1',
      pool: {
        pool_id: pool.pool_id,
        name: pool.name,
        scoped_game_type: pool.scoped_game_type,
        entries: pool.entries
          .filter((e) => e.is_active)
          .map((e) => ({
            prize_slot: e.prize_slot,
            name: e.name,
            description: e.description,
            rarity: e.rarity,
            base_weight: e.base_weight,
            asset_url: e.asset_url,
          })),
        exported_at_utc: new Date().toISOString(),
      },
    };
  }

  @Post('creator/:creator_id/prize-pools/import')
  @HttpCode(HttpStatus.CREATED)
  async importPool(
    @Param('creator_id') creator_id: string,
    @Body() dto: ImportPrizePoolDto,
  ): Promise<PrizePool> {
    if (dto.format !== 'JSON_V1') {
      throw new Error(`PRIZE_POOL_IMPORT_UNSUPPORTED_FORMAT: ${dto.format}`);
    }
    return this.prizePools.upsert(creator_id, dto.pool);
  }

  @Post('creator/:creator_id/game-configs')
  @HttpCode(HttpStatus.CREATED)
  async upsertGameConfig(
    @Param('creator_id') creator_id: string,
    @Body() dto: UpsertCreatorGameConfigDto,
  ): Promise<CreatorGameConfig> {
    return this.creatorConfig.upsert(creator_id, dto);
  }

  @Get('creator/:creator_id/game-configs')
  async listGameConfigs(@Param('creator_id') creator_id: string): Promise<CreatorGameConfig[]> {
    return this.creatorConfig.listActive(creator_id);
  }

  // ── Analytics surface ─────────────────────────────────────────────────────

  @Get('creator/:creator_id/analytics')
  async analyticsSummary(
    @Param('creator_id') creator_id: string,
    @Query('window_days') window_days?: string,
  ): Promise<AnalyticsSummaryDto> {
    const window = window_days ? Number.parseInt(window_days, 10) : 30;
    return this.analytics.summaryForCreator(creator_id, window);
  }
}
