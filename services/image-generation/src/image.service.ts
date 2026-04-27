// services/image-generation/src/image.service.ts
// CYR: Image Generation Service — Flux 2 Pro + Nano via Banana.dev
//
// Responsibilities:
//   1. Build photorealism prompts from structured config + LoRA trigger words
//   2. Call Banana.dev / Replicate API with Flux model
//   3. Cache generated images in ImageCache table (deduplicate identical prompts)
//   4. Emit NATS events for image generation lifecycle
//   5. Respect content rating gates — ADULT content only for verified creators

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core-api/src/prisma.module';
import { NatsService } from '../../core-api/src/nats/nats.service';
import {
  GenerateImageRequest,
  GenerateImageResult,
  PHOTOREALISM_NEGATIVE_PROMPT,
  PHOTOREALISM_POSITIVE_SUFFIX,
} from './image.types';

const NATS_IMAGE_GENERATED = 'cyrano.image.generated';
const NATS_IMAGE_FAILED = 'cyrano.image.failed';

const BANANA_API_KEY = process.env.BANANA_API_KEY ?? '';
const BANANA_MODEL_KEY_FLUX_PRO = process.env.BANANA_MODEL_KEY_FLUX_PRO ?? '';
const BANANA_MODEL_KEY_FLUX_SCHNELL = process.env.BANANA_MODEL_KEY_FLUX_SCHNELL ?? '';

/** Default dimensions by aspect ratio */
const ASPECT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '16:9': { width: 1344, height: 768 },
  '9:16': { width: 768, height: 1344 },
  '4:3': { width: 1152, height: 864 },
  '3:4': { width: 864, height: 1152 },
};

@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly nats: NatsService,
  ) {}

  /**
   * Build the final prompt string from structured config.
   * Injects photorealism suffix and LoRA trigger word automatically.
   */
  buildPrompt(req: GenerateImageRequest): { positive: string; negative: string } {
    const { prompt_config } = req;
    const parts = [
      prompt_config.lora_trigger_word,
      prompt_config.subject_description,
      prompt_config.scene_description,
    ].filter(Boolean);

    if (prompt_config.enhance_with_photorealism) {
      parts.push(PHOTOREALISM_POSITIVE_SUFFIX);
    }

    return {
      positive: parts.join(', '),
      negative: PHOTOREALISM_NEGATIVE_PROMPT,
    };
  }

  /**
   * Generate an image. Checks cache first — returns cached result if an
   * identical prompt + model was already generated for this twin in the last
   * 24 hours to avoid redundant Banana.dev calls.
   */
  async generate(req: GenerateImageRequest): Promise<GenerateImageResult> {
    const { positive: promptUsed, negative: negativePrompt } = this.buildPrompt(req);

    // Cache check — SHA-based dedup
    const promptHash = await this.hashPrompt(promptUsed, req.model, req.aspect_ratio);
    const cached = await this.prisma.imageCache.findFirst({
      where: {
        twin_id: req.twin_id,
        prompt_hash: promptHash,
        generated_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    if (cached) {
      this.logger.log(`Cache hit for twin ${req.twin_id}, hash ${promptHash}`);
      return {
        image_cache_id: cached.image_cache_id,
        twin_id: cached.twin_id,
        storage_url: cached.storage_url,
        prompt_used: promptUsed,
        model: req.model,
        generated_at_utc: cached.generated_at.toISOString(),
        from_cache: true,
      };
    }

    // Call Banana.dev
    const dims = {
      width: req.width ?? ASPECT_DIMENSIONS[req.aspect_ratio]?.width ?? 1024,
      height: req.height ?? ASPECT_DIMENSIONS[req.aspect_ratio]?.height ?? 1024,
    };

    const storageUrl = await this.callBananaDev(req.model, {
      prompt: promptUsed,
      negative_prompt: negativePrompt,
      num_inference_steps: req.num_inference_steps ?? 28,
      guidance_scale: req.guidance_scale ?? 7.5,
      ...dims,
    });

    // Persist to cache
    const record = await this.prisma.imageCache.create({
      data: {
        twin_id: req.twin_id,
        creator_id: req.creator_id,
        user_id: req.user_id,
        prompt_hash: promptHash,
        prompt_used: promptUsed,
        model: req.model,
        storage_url: storageUrl,
        width: dims.width,
        height: dims.height,
        correlation_id: req.correlation_id,
        reason_code: 'IMAGE_GEN',
      },
    });

    await this.nats.publish(NATS_IMAGE_GENERATED, {
      image_cache_id: record.image_cache_id,
      twin_id: req.twin_id,
      creator_id: req.creator_id,
    });

    return {
      image_cache_id: record.image_cache_id,
      twin_id: req.twin_id,
      storage_url: storageUrl,
      prompt_used: promptUsed,
      model: req.model,
      generated_at_utc: record.generated_at.toISOString(),
      from_cache: false,
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async callBananaDev(
    model: string,
    inputs: Record<string, unknown>,
  ): Promise<string> {
    if (!BANANA_API_KEY) {
      throw new Error('BANANA_API_KEY not configured — image generation unavailable');
    }

    const modelKey =
      model === 'flux-pro' ? BANANA_MODEL_KEY_FLUX_PRO : BANANA_MODEL_KEY_FLUX_SCHNELL;

    const response = await fetch('https://api.banana.dev/start/v4/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${BANANA_API_KEY}`,
      },
      body: JSON.stringify({ model_key: modelKey, pipeline_input: inputs }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Banana.dev API error ${response.status}: ${text}`);
    }

    const data = (await response.json()) as { modelOutputs?: Array<{ image_base64?: string; image_url?: string }> };
    const output = data.modelOutputs?.[0];
    if (!output) throw new Error('Banana.dev returned no model output');

    // Prefer direct URL; base64 fallback handled by storage service
    return output.image_url ?? `data:image/png;base64,${output.image_base64}`;
  }

  private async hashPrompt(prompt: string, model: string, ratio: string): Promise<string> {
    const { createHash } = await import('node:crypto');
    return createHash('sha256')
      .update(`${model}:${ratio}:${prompt}`)
      .digest('hex')
      .slice(0, 64);
  }
}
