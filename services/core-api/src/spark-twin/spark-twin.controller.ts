// services/core-api/src/spark-twin/spark-twin.controller.ts
// CYR: Spark Twin REST controller — free-tier provision + message tracking.

import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import { SparkTwinService, TrackMessageResult } from './spark-twin.service';

@Controller('cyrano/spark')
export class SparkTwinController {
  private readonly logger = new Logger(SparkTwinController.name);

  constructor(private readonly sparkTwinService: SparkTwinService) {}

  /**
   * POST /cyrano/spark/provision
   * Auto-provisions a free Spark Twin for a new user.
   * Called from the auth/signup flow after user creation.
   *
   * Headers (required):
   *   x-user-id   — UUID of the newly created user
   * Body:
   *   { portal: string }  — e.g. "MAIN" | "INK_AND_STEEL" | "LOTUS_BLOOM" | …
   */
  @Post('provision')
  @HttpCode(HttpStatus.OK)
  async provision(
    @Headers('x-user-id') userId: string | undefined,
    @Body() body: { portal?: string },
  ) {
    if (!userId) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'x-user-id header is required.',
        reason_code: 'NO_USER_CONTEXT',
      });
    }

    const portal = body?.portal ?? 'MAIN';

    return this.sparkTwinService.provisionFreeSparkTwin(userId, portal);
  }

  /**
   * POST /cyrano/spark/track-message
   * Increments the daily Spark message counter atomically and returns current
   * usage + an upgrade nudge when the user has crossed the nudge threshold.
   *
   * The service performs the limit check and increment inside a single
   * transaction, eliminating any TOCTOU window between callers.
   *
   * Returns 403 when the daily cap has been reached so the UI can gate
   * further sends.
   *
   * Headers (required):
   *   x-user-id — UUID of the active Spark user
   */
  @Post('track-message')
  @HttpCode(HttpStatus.OK)
  async trackMessage(
    @Headers('x-user-id') userId: string | undefined,
  ): Promise<TrackMessageResult> {
    if (!userId) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'x-user-id header is required.',
        reason_code: 'NO_USER_CONTEXT',
      });
    }

    const result = await this.sparkTwinService.trackMessage(userId);

    if (result.limit_reached && result.messages_sent >= 15) {
      this.logger.warn('SparkTwinController.trackMessage: daily cap reached', {
        user_id: userId,
        messages_sent: result.messages_sent,
      });
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Daily Spark message limit reached. Upgrade to Flame for unlimited messages.',
        reason_code: 'SPARK_DAILY_LIMIT_REACHED',
      });
    }

    return result;
  }
}
