// VelocityZone — REST controller
// Admin-gated event management + tip-time rate evaluation endpoint.
import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
} from '@nestjs/common';
import { VelocityZoneService } from './velocityzone.service';

@Controller('velocityzone')
export class VelocityZoneController {
  private readonly logger = new Logger(VelocityZoneController.name);

  constructor(private readonly velocityZoneService: VelocityZoneService) {}

  /**
   * POST /velocityzone/rate
   * Evaluate the locked payout rate for a tip at current FFS score.
   */
  @Post('rate')
  async evaluateRate(
    @Body()
    body: {
      creator_id: string;
      ffs_score: number;
      session_id: string;
    },
  ) {
    this.logger.log('VelocityZoneController.evaluateRate', {
      creator_id: body.creator_id,
      ffs_score:  body.ffs_score,
    });
    return this.velocityZoneService.evaluateRate(
      body.creator_id,
      body.ffs_score,
      body.session_id,
    );
  }

  /**
   * POST /velocityzone/creator/:creatorId/seed-rate
   * Seed the creator_rate_tier table during onboarding. Admin only.
   */
  @Post('creator/:creatorId/seed-rate')
  async seedCreatorRate(
    @Param('creatorId') creatorId: string,
    @Body() body: { is_founding: boolean; correlation_id: string },
  ) {
    this.logger.log('VelocityZoneController.seedCreatorRate', {
      creator_id:  creatorId,
      is_founding: body.is_founding,
    });
    return this.velocityZoneService.seedCreatorRateTier(
      creatorId,
      body.is_founding,
      body.correlation_id,
    );
  }

  /**
   * POST /velocityzone/day61-promotion
   * Trigger Day-61 rate promotion (called by scheduler). Admin only.
   */
  @Post('day61-promotion')
  async day61Promotion(@Body() body: { correlation_id: string }) {
    this.logger.log('VelocityZoneController.day61Promotion');
    return this.velocityZoneService.promoteDay61Rates(body.correlation_id);
  }

  /**
   * GET /velocityzone/health
   */
  @Get('health')
  health() {
    return { status: 'ok', service: 'velocityzone' };
  }
}
