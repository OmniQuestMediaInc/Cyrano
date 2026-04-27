// services/ai-twin/src/ai-twin.types.ts
// CYR: AI Twin service — shared type definitions

export type TrainingStatus =
  | 'PENDING_UPLOAD'
  | 'UPLOAD_COMPLETE'
  | 'TRAINING_QUEUED'
  | 'TRAINING_IN_PROGRESS'
  | 'TRAINING_COMPLETE'
  | 'TRAINING_FAILED'
  | 'RETIRED';

export type TwinVisibility = 'PRIVATE' | 'PLATFORM_INTERNAL' | 'SUBSCRIBER';

export interface PhotoUploadResult {
  photo_id: string;
  storage_key: string;
  upload_at_utc: string;
}

export interface TrainingJobPayload {
  twin_id: string;
  creator_id: string;
  photo_storage_keys: string[];
  base_model: 'flux-1-dev' | 'flux-1-schnell';
  lora_rank: number;
  trigger_word: string;
  correlation_id: string;
}

export interface TrainingJobResult {
  job_id: string;
  twin_id: string;
  status: TrainingStatus;
  lora_weights_url?: string;
  error_message?: string;
  completed_at_utc?: string;
}

export interface CreateTwinRequest {
  creator_id: string;
  display_name: string;
  persona_prompt: string;
  trigger_word: string;
  visibility: TwinVisibility;
  is_house_model: boolean;
  correlation_id: string;
}

export interface TwinSummary {
  twin_id: string;
  creator_id: string;
  display_name: string;
  training_status: TrainingStatus;
  visibility: TwinVisibility;
  is_house_model: boolean;
  created_at_utc: string;
}
