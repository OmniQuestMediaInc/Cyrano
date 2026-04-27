// services/voice-cloning/src/voice.types.ts
// CYR: Voice Cloning — ElevenLabs integration type definitions

export type VoiceCloneStatus =
  | 'PENDING_SAMPLES'
  | 'SAMPLES_READY'
  | 'CLONING_IN_PROGRESS'
  | 'CLONE_COMPLETE'
  | 'CLONE_FAILED'
  | 'RETIRED';

export type VoiceModel = 'eleven_multilingual_v2' | 'eleven_turbo_v2' | 'eleven_monolingual_v1';

export interface VoiceSampleUpload {
  sample_id: string;
  storage_key: string;
  duration_seconds: number;
  uploaded_at_utc: string;
}

export interface CreateVoiceCloneRequest {
  twin_id: string;
  creator_id: string;
  voice_name: string;
  description?: string;
  labels?: Record<string, string>;
  correlation_id: string;
}

export interface VoiceCloneSummary {
  voice_clone_id: string;
  twin_id: string;
  creator_id: string;
  voice_name: string;
  elevenlabs_voice_id: string | null;
  status: VoiceCloneStatus;
  created_at_utc: string;
}

export interface TextToSpeechRequest {
  voice_clone_id: string;
  text: string;
  model?: VoiceModel;
  /** Stability 0–1: higher = more stable/consistent */
  stability?: number;
  /** Similarity boost 0–1: higher = closer to original voice */
  similarity_boost?: number;
  /** Style 0–1: exaggeration of style */
  style?: number;
  use_speaker_boost?: boolean;
  correlation_id: string;
}

export interface TextToSpeechResult {
  audio_url: string;
  voice_clone_id: string;
  characters_used: number;
  model: VoiceModel;
  generated_at_utc: string;
}
