// CYR: AI Twin Creator Dashboard — UI view model contracts.
// These types mirror but do not import the service-layer ai-twin.types.ts;
// the presenter layer is responsible for translation.

export type TwinTrainingStatus =
  | 'PENDING_UPLOAD'
  | 'UPLOAD_COMPLETE'
  | 'TRAINING_QUEUED'
  | 'TRAINING_IN_PROGRESS'
  | 'TRAINING_COMPLETE'
  | 'TRAINING_FAILED'
  | 'RETIRED';

/** Wizard step index (0-based), maps to the four stepper labels. */
export type WizardStep = 0 | 1 | 2 | 3; // Photos | Train LoRA | Test Generate | Publish

export type TwinSessionState =
  | 'GRANTED'      // Minutes available; session may start
  | 'ACTIVE'       // Session in progress — minutes decrementing
  | 'EXPIRED'      // Zero minutes remaining
  | 'TOP_UP';      // User has been prompted to purchase more minutes

export type TwinVisibility = 'PRIVATE' | 'PLATFORM_INTERNAL' | 'SUBSCRIBER';

/** Bill 149 compliance prefix required on every generated output. */
export interface Bill149ComplianceTag {
  prefix: string;          // e.g. "AI-GENERATED:"
  required: boolean;
  reason_code: string;
}

/** GateGuard AV compliance state surfaced to the creator UI. */
export interface GateGuardAvStatus {
  av_required: boolean;
  av_cleared: boolean;
  clearance_id: string | null;
}

export interface TwinPhotoUploadRow {
  photo_id: string;
  storage_key: string;
  uploaded_at_utc: string;
}

export interface TwinMemorySummaryEntry {
  memory_type: 'FACT' | 'PREFERENCE' | 'EMOTION' | 'STORY_BEAT' | 'RELATIONSHIP' | 'SECRET';
  content_preview: string; // truncated, safe for UI display
  importance_score: number;
}

export interface VoiceCloneCtaState {
  voice_clone_ready: boolean;
  cta_label: string;
  cta_disabled: boolean;
}

export interface ChatPreviewMessage {
  role: 'twin' | 'user';
  content: string;
  timestamp_utc: string;
}

/** Top-level view model consumed by renderAiTwinCreatorDashboard(). */
export interface AiTwinCreatorDashboardView {
  twin_id: string;
  creator_id: string;
  display_name: string;
  training_status: TwinTrainingStatus;
  visibility: TwinVisibility;
  is_house_model: boolean;
  current_wizard_step: WizardStep;
  session_state: TwinSessionState;
  session_minutes_remaining: number;
  photos: TwinPhotoUploadRow[];
  photos_required_min: number;
  memory_summary: TwinMemorySummaryEntry[];
  voice_clone: VoiceCloneCtaState;
  chat_preview: ChatPreviewMessage[];
  compliance: {
    bill_149: Bill149ComplianceTag;
    gateguard_av: GateGuardAvStatus;
  };
  generated_at_utc: string;
  rule_applied_id: string;
}

/** Input shape accepted by renderAiTwinCreatorDashboard(). */
export interface AiTwinCreatorDashboardInputs {
  twin_id: string;
  creator_id: string;
  display_name: string;
  training_status: TwinTrainingStatus;
  visibility: TwinVisibility;
  is_house_model: boolean;
  session_minutes_remaining: number;
  photos: TwinPhotoUploadRow[];
  photos_required_min?: number;
  memory_summary?: TwinMemorySummaryEntry[];
  voice_clone_ready?: boolean;
  chat_preview?: ChatPreviewMessage[];
  av_required?: boolean;
  av_cleared?: boolean;
  clearance_id?: string | null;
}
