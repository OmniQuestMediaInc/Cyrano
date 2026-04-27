// WO-003 — Flicker n'Flame Scoring (FFS): controller
// REST surface for the Flicker n'Flame Scoring service.
// All endpoints are advisory / read-oriented; no ledger mutations here.
import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import type { LeaderboardCategory } from './types/ffs.types';
import type { FfsLeaderboard, FfsScore } from './types/ffs.types';
import { IngestFfsDto, TipEventDto } from './dto/ffs.dto';
import { FfsService } from './ffs.service';

@Controller('ffs')
export class FfsController {
  private readonly logger = new Logger(FfsController.name);

  constructor(private readonly ffsService: FfsService) {}

  /**
   * GET /ffs/leaderboard?category=all|standard|dual_flame|hot_and_ready|new_flames
   */
  @Get('leaderboard')
  getLeaderboard(
    @Query('category') category?: string,
  ): FfsLeaderboard {
    const validCategories: LeaderboardCategory[] = [
      'all',
      'standard',
      'dual_flame',
      'hot_and_ready',
      'new_flames',
    ];
    const cat: LeaderboardCategory = validCategories.includes(
      category as LeaderboardCategory,
    )
      ? (category as LeaderboardCategory)
      : 'all';

    this.logger.log('FfsController.getLeaderboard', { category: cat });
    return this.ffsService.getLeaderboard(cat);
  }

  /**
   * GET /ffs/session/:sessionId
   */
  @Get('session/:sessionId')
  getSessionScore(
    @Param('sessionId') sessionId: string,
  ): FfsScore {
    const score = this.ffsService.getSessionScore(sessionId);
    if (!score) {
      throw new NotFoundException(`Session not found or not yet active: ${sessionId}`);
    }
    return score;
  }

  /**
   * POST /ffs/ingest
   */
  @Post('ingest')
  ingestSample(@Body() dto: IngestFfsDto): FfsScore {
    this.logger.log('FfsController.ingestSample', {
      session_id: dto.session_id,
      creator_id: dto.creator_id,
    });
    return this.ffsService.ingest(dto);
  }

  /**
   * POST /ffs/session/:sessionId/start
   */
  @Post('session/:sessionId/start')
  startSession(
    @Param('sessionId') sessionId: string,
    @Body() body: { creator_id: string; is_dual_flame?: boolean },
  ): { session_id: string; started: boolean } {
    this.ffsService.startSession(
      sessionId,
      body.creator_id,
      body.is_dual_flame ?? false,
    );
    return { session_id: sessionId, started: true };
  }

  /**
   * DELETE /ffs/session/:sessionId
   */
  @Delete('session/:sessionId')
  endSession(
    @Param('sessionId') sessionId: string,
  ): { session_id: string; ended: boolean } {
    this.ffsService.endSession(sessionId);
    return { session_id: sessionId, ended: true };
  }

  /**
   * POST /ffs/tip-event — trigger adaptive weight learning from a tip.
   */
  @Post('tip-event')
  recordTipEvent(@Body() dto: TipEventDto): { learned: boolean } {
    this.logger.log('FfsController.recordTipEvent', {
      session_id: dto.session_id,
      creator_id: dto.creator_id,
      tokens:     dto.tokens,
    });
    this.ffsService.learnFromTipEvent(dto.ffs_context);
    return { learned: true };
  }

  /**
   * GET /ffs/adaptive-weights/:creatorId
   */
  @Get('adaptive-weights/:creatorId')
  getAdaptiveWeights(
    @Param('creatorId') creatorId: string,
  ) {
    return this.ffsService.getAdaptiveWeightsPublic(creatorId);
  }
}
