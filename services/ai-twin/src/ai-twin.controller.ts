// services/ai-twin/src/ai-twin.controller.ts
// CYR: AI Twin REST controller — wizard upload/train endpoints

import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AiTwinService } from './ai-twin.service';
import { CreateTwinRequest, TrainingJobResult } from './ai-twin.types';

@Controller('cyrano/ai-twin')
export class AiTwinController {
  constructor(private readonly aiTwinService: AiTwinService) {}

  /** Create a new twin record (pre-training). */
  @Post()
  async create(@Body() req: CreateTwinRequest) {
    return this.aiTwinService.createTwin(req);
  }

  /** Record a photo upload completion event. */
  @Post(':twinId/photos')
  async recordPhoto(
    @Param('twinId') twinId: string,
    @Body() body: { photo_id: string; storage_key: string },
  ) {
    return this.aiTwinService.recordPhotoUpload(twinId, body.photo_id, body.storage_key);
  }

  /** Kick off LoRA training for a twin that has uploads complete. */
  @Post(':twinId/train')
  async train(
    @Param('twinId') twinId: string,
    @Body() body: { correlation_id: string },
  ) {
    return this.aiTwinService.startTraining(twinId, body.correlation_id);
  }

  /** Banana.dev webhook: training job result callback. */
  @Post('training-callback')
  async trainingCallback(@Body() result: TrainingJobResult) {
    await this.aiTwinService.handleTrainingResult(result);
    return { ok: true };
  }

  /** List all twins for a creator. */
  @Get('creator/:creatorId')
  async listForCreator(@Param('creatorId') creatorId: string) {
    return this.aiTwinService.listTwinsForCreator(creatorId);
  }

  /** List all house models (platform-internal, 100% revenue). */
  @Get('house-models')
  async listHouseModels() {
    return this.aiTwinService.listHouseModels();
  }
}
