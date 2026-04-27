// services/image-generation/src/image.types.ts
// CYR: Image Generation — type definitions for Flux 2 Pro + Nano Banana service

export type ImageModel = 'flux-pro' | 'flux-schnell' | 'flux-dev';

export type ImageAspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

export type ImageStatus = 'PENDING' | 'GENERATING' | 'COMPLETE' | 'FAILED' | 'CACHED';

export type ContentRating = 'SFW' | 'SUGGESTIVE' | 'ADULT';

export interface PhotorealismPromptConfig {
  /** Trigger word for the LoRA — e.g. "ohwx woman" */
  lora_trigger_word: string;
  /** Subject description appended after trigger word */
  subject_description: string;
  /** Scene / environment description */
  scene_description: string;
  /** Photorealism enhancers automatically appended */
  enhance_with_photorealism: boolean;
  /** Content rating gate — determines NSFW suffix injection */
  content_rating: ContentRating;
}

export interface GenerateImageRequest {
  twin_id: string;
  creator_id: string;
  user_id: string;
  model: ImageModel;
  aspect_ratio: ImageAspectRatio;
  prompt_config: PhotorealismPromptConfig;
  /** Width override; defaults from aspect_ratio if omitted */
  width?: number;
  /** Height override */
  height?: number;
  num_inference_steps?: number;
  guidance_scale?: number;
  correlation_id: string;
}

export interface GenerateImageResult {
  image_cache_id: string;
  twin_id: string;
  storage_url: string;
  prompt_used: string;
  model: ImageModel;
  generated_at_utc: string;
  from_cache: boolean;
}

// ─── Photorealism prompt building blocks ──────────────────────────────────────

/** Appended to every SFW / suggestive generation for photorealism. */
export const PHOTOREALISM_POSITIVE_SUFFIX =
  'ultra-realistic, photorealistic, 85mm lens, f/1.8 aperture, ' +
  'natural skin texture, visible pores, subsurface scattering, ' +
  'soft rim lighting, freckles, fine hair strands, cinematic depth of field, ' +
  '8K resolution, RAW photo, Leica Q2, award-winning photography';

/** Hard-negative prompt appended to every generation to suppress AI artefacts. */
export const PHOTOREALISM_NEGATIVE_PROMPT =
  'cartoon, anime, illustration, painting, drawing, sketch, cgi, ' +
  '3d render, plastic, doll, unrealistic, blurry, low quality, ' +
  'watermark, text, oversaturated, overexposed, underexposed';
