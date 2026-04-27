// services/ai-twin/src/ai-twin.service.ts
// CYR: AI Twin Service — photo upload + LoRA/Flux training pipeline
//
// Responsibilities:
//   1. Accept photo uploads from creator (presigned S3 URL flow)
//   2. Queue a LoRA fine-tuning job against Flux-1-dev or Flux-1-schnell
//   3. Persist training status in AiTwin table via Prisma
//   4. Emit NATS events for training lifecycle (queued, complete, failed)
//
// FIZ NOTE: Revenue share and payout touching paths are in the ledger service.
//           This service only owns training state — no balance mutations here.

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core-api/src/prisma.module';
import { NatsService } from '../../core-api/src/nats/nats.service';
import {
  CreateTwinRequest,
  PhotoUploadResult,
  TrainingJobPayload,
  TrainingJobResult,
  TrainingStatus,
  TwinSummary,
} from './ai-twin.types';

// NATS subject constants — all AI twin lifecycle events
const NATS_AI_TWIN_TRAINING_QUEUED = 'cyrano.ai-twin.training.queued';
const NATS_AI_TWIN_TRAINING_COMPLETE = 'cyrano.ai-twin.training.complete';
const NATS_AI_TWIN_TRAINING_FAILED = 'cyrano.ai-twin.training.failed';

// Training configuration defaults — override via environment
const LORA_RANK_DEFAULT = parseInt(process.env.AI_TWIN_LORA_RANK ?? '16', 10);
const BANANA_ENDPOINT = process.env.BANANA_API_ENDPOINT ?? '';
const BANANA_API_KEY = process.env.BANANA_API_KEY ?? '';

@Injectable()
export class AiTwinService {
  private readonly logger = new Logger(AiTwinService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly nats: NatsService,
  ) {}

  /**
   * Create a new AI twin record. Photos must be uploaded separately via
   * generateUploadUrl() before calling startTraining().
   */
  async createTwin(req: CreateTwinRequest): Promise<TwinSummary> {
    const twin = await this.prisma.aiTwin.create({
      data: {
        creator_id: req.creator_id,
        display_name: req.display_name,
        persona_prompt: req.persona_prompt,
        trigger_word: req.trigger_word,
        visibility: req.visibility,
        is_house_model: req.is_house_model,
        training_status: 'PENDING_UPLOAD',
        correlation_id: req.correlation_id,
        reason_code: 'TWIN_CREATE',
      },
    });

    this.logger.log(`AiTwin created: ${twin.twin_id} for creator ${req.creator_id}`);

    return {
      twin_id: twin.twin_id,
      creator_id: twin.creator_id,
      display_name: twin.display_name,
      training_status: twin.training_status as TrainingStatus,
      visibility: twin.visibility as 'PRIVATE' | 'PLATFORM_INTERNAL' | 'SUBSCRIBER',
      is_house_model: twin.is_house_model,
      created_at_utc: twin.created_at.toISOString(),
    };
  }

  /**
   * Record that a photo has been successfully uploaded to object storage.
   * Calling this for all uploaded photos transitions the twin to UPLOAD_COMPLETE
   * once the minimum photo count is satisfied.
   */
  async recordPhotoUpload(
    twin_id: string,
    photo_id: string,
    storage_key: string,
  ): Promise<PhotoUploadResult> {
    await this.prisma.aiTwinPhoto.create({
      data: {
        twin_id,
        photo_id,
        storage_key,
        correlation_id: `${twin_id}:photo:${photo_id}`,
        reason_code: 'PHOTO_UPLOAD',
      },
    });

    const photoCount = await this.prisma.aiTwinPhoto.count({ where: { twin_id } });
    const MIN_PHOTOS = 5;

    if (photoCount >= MIN_PHOTOS) {
      await this.prisma.aiTwin.update({
        where: { twin_id },
        data: { training_status: 'UPLOAD_COMPLETE' },
      });
    }

    return { photo_id, storage_key, upload_at_utc: new Date().toISOString() };
  }

  /**
   * Enqueue a LoRA training job for the twin. Requires UPLOAD_COMPLETE status.
   * Publishes NATS event so the Banana.dev worker can pick up the job.
   */
  async startTraining(twin_id: string, correlation_id: string): Promise<TrainingJobPayload> {
    const twin = await this.prisma.aiTwin.findUniqueOrThrow({ where: { twin_id } });

    if (twin.training_status !== 'UPLOAD_COMPLETE') {
      throw new Error(
        `Twin ${twin_id} is not ready for training (status: ${twin.training_status})`,
      );
    }

    const photos = await this.prisma.aiTwinPhoto.findMany({ where: { twin_id } });
    const storageKeys = photos.map((p) => p.storage_key);

    const payload: TrainingJobPayload = {
      twin_id,
      creator_id: twin.creator_id,
      photo_storage_keys: storageKeys,
      base_model: 'flux-1-dev',
      lora_rank: LORA_RANK_DEFAULT,
      trigger_word: twin.trigger_word,
      correlation_id,
    };

    await this.prisma.aiTwin.update({
      where: { twin_id },
      data: { training_status: 'TRAINING_QUEUED' },
    });

    await this.nats.publish(NATS_AI_TWIN_TRAINING_QUEUED, payload);
    this.logger.log(`Training job queued for twin ${twin_id}`);

    return payload;
  }

  /**
   * Handle training completion callback from the Banana.dev worker.
   * Updates AiTwin record and emits NATS completion event.
   */
  async handleTrainingResult(result: TrainingJobResult): Promise<void> {
    const status: TrainingStatus =
      result.status === 'TRAINING_COMPLETE' ? 'TRAINING_COMPLETE' : 'TRAINING_FAILED';

    await this.prisma.aiTwin.update({
      where: { twin_id: result.twin_id },
      data: {
        training_status: status,
        lora_weights_url: result.lora_weights_url ?? null,
        training_error: result.error_message ?? null,
        trained_at: status === 'TRAINING_COMPLETE' ? new Date() : null,
      },
    });

    const subject =
      status === 'TRAINING_COMPLETE'
        ? NATS_AI_TWIN_TRAINING_COMPLETE
        : NATS_AI_TWIN_TRAINING_FAILED;

    await this.nats.publish(subject, result);
    this.logger.log(`Training ${status} for twin ${result.twin_id}`);
  }

  /**
   * Retrieve all twins for a creator. Used by the AI Twin Creator wizard.
   */
  async listTwinsForCreator(creator_id: string): Promise<TwinSummary[]> {
    const twins = await this.prisma.aiTwin.findMany({
      where: { creator_id },
      orderBy: { created_at: 'desc' },
    });

    return twins.map((t) => ({
      twin_id: t.twin_id,
      creator_id: t.creator_id,
      display_name: t.display_name,
      training_status: t.training_status as TrainingStatus,
      visibility: t.visibility as 'PRIVATE' | 'PLATFORM_INTERNAL' | 'SUBSCRIBER',
      is_house_model: t.is_house_model,
      created_at_utc: t.created_at.toISOString(),
    }));
  }

  /**
   * List all house-model twins (platform-owned, 100% revenue to platform).
   */
  async listHouseModels(): Promise<TwinSummary[]> {
    const twins = await this.prisma.aiTwin.findMany({
      where: { is_house_model: true, training_status: 'TRAINING_COMPLETE' },
      orderBy: { created_at: 'desc' },
    });

    return twins.map((t) => ({
      twin_id: t.twin_id,
      creator_id: t.creator_id,
      display_name: t.display_name,
      training_status: t.training_status as TrainingStatus,
      visibility: t.visibility as 'PRIVATE' | 'PLATFORM_INTERNAL' | 'SUBSCRIBER',
      is_house_model: t.is_house_model,
      created_at_utc: t.created_at.toISOString(),
    }));
  }

  /** Expose Banana.dev endpoint config for the worker (read-only). */
  getBananaConfig(): { endpoint: string; apiKeyPresent: boolean } {
    return {
      endpoint: BANANA_ENDPOINT,
      apiKeyPresent: BANANA_API_KEY.length > 0,
    };
  }
}
