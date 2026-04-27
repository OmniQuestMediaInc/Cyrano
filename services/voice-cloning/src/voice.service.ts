// services/voice-cloning/src/voice.service.ts
// CYR: Voice Cloning Service — ElevenLabs integration
//
// Responsibilities:
//   1. Accept voice sample uploads and record them in VoiceClone table
//   2. Call ElevenLabs Instant Voice Cloning API to create a voice clone
//   3. Synthesize speech for Cyrano character interactions (voice call feature)
//   4. Track character usage for billing / quota management
//   5. Emit NATS events for voice clone lifecycle

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core-api/src/prisma.module';
import { NatsService } from '../../core-api/src/nats/nats.service';
import {
  CreateVoiceCloneRequest,
  TextToSpeechRequest,
  TextToSpeechResult,
  VoiceCloneSummary,
  VoiceCloneStatus,
  VoiceModel,
} from './voice.types';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY ?? '';
const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';

const NATS_VOICE_CLONE_COMPLETE = 'cyrano.voice.clone.complete';
const NATS_VOICE_CLONE_FAILED = 'cyrano.voice.clone.failed';
const NATS_VOICE_TTS_GENERATED = 'cyrano.voice.tts.generated';

const MIN_SAMPLES = 3;

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly nats: NatsService,
  ) {}

  /** Create a VoiceClone record for a twin. Samples uploaded separately. */
  async createVoiceClone(req: CreateVoiceCloneRequest): Promise<VoiceCloneSummary> {
    const record = await this.prisma.voiceClone.create({
      data: {
        twin_id: req.twin_id,
        creator_id: req.creator_id,
        voice_name: req.voice_name,
        description: req.description ?? null,
        labels_json: req.labels ? JSON.stringify(req.labels) : null,
        status: 'PENDING_SAMPLES',
        correlation_id: req.correlation_id,
        reason_code: 'VOICE_CLONE_CREATE',
      },
    });

    return this.toSummary(record);
  }

  /** Record a voice sample upload. Transitions to SAMPLES_READY at MIN_SAMPLES. */
  async recordSample(
    voice_clone_id: string,
    sample_id: string,
    storage_key: string,
    duration_seconds: number,
  ) {
    await this.prisma.voiceCloneSample.create({
      data: {
        voice_clone_id,
        sample_id,
        storage_key,
        duration_seconds,
        correlation_id: `${voice_clone_id}:sample:${sample_id}`,
        reason_code: 'VOICE_SAMPLE_UPLOAD',
      },
    });

    const count = await this.prisma.voiceCloneSample.count({ where: { voice_clone_id } });
    if (count >= MIN_SAMPLES) {
      await this.prisma.voiceClone.update({
        where: { voice_clone_id },
        data: { status: 'SAMPLES_READY' },
      });
    }

    return { sample_id, storage_key, duration_seconds, uploaded_at_utc: new Date().toISOString() };
  }

  /**
   * Call ElevenLabs Instant Voice Cloning API.
   * Requires SAMPLES_READY status and stored sample audio URLs.
   */
  async startCloning(voice_clone_id: string): Promise<VoiceCloneSummary> {
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY not configured');
    }

    const clone = await this.prisma.voiceClone.findUniqueOrThrow({ where: { voice_clone_id } });
    if (clone.status !== 'SAMPLES_READY') {
      throw new Error(`VoiceClone ${voice_clone_id} not ready (status: ${clone.status})`);
    }

    await this.prisma.voiceClone.update({
      where: { voice_clone_id },
      data: { status: 'CLONING_IN_PROGRESS' },
    });

    try {
      const samples = await this.prisma.voiceCloneSample.findMany({ where: { voice_clone_id } });

      // ElevenLabs /voices/add expects multipart/form-data with audio file blobs.
      // We fetch each sample audio from its storage URL and append the raw blob.
      // NOTE: In production, sample storage_keys should be presigned S3 URLs.
      const formData = new FormData();
      formData.append('name', clone.voice_name);
      if (clone.description) formData.append('description', clone.description);
      for (const s of samples) {
        const audioRes = await fetch(s.storage_key);
        if (!audioRes.ok) {
          throw new Error(`Failed to fetch sample ${s.sample_id} from storage: ${audioRes.status}`);
        }
        const audioBlob = await audioRes.blob();
        formData.append('files', audioBlob, `sample-${s.sample_id}.mp3`);
      }

      const response = await fetch(`${ELEVENLABS_BASE}/voices/add`, {
        method: 'POST',
        headers: { 'xi-api-key': ELEVENLABS_API_KEY },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API ${response.status}: ${await response.text()}`);
      }

      const data = (await response.json()) as { voice_id: string };

      const updated = await this.prisma.voiceClone.update({
        where: { voice_clone_id },
        data: { status: 'CLONE_COMPLETE', elevenlabs_voice_id: data.voice_id, cloned_at: new Date() },
      });

      await this.nats.publish(NATS_VOICE_CLONE_COMPLETE, { voice_clone_id, twin_id: clone.twin_id });
      this.logger.log(`Voice clone complete: ${voice_clone_id} → EL voice ${data.voice_id}`);

      return this.toSummary(updated);
    } catch (err) {
      await this.prisma.voiceClone.update({
        where: { voice_clone_id },
        data: { status: 'CLONE_FAILED', clone_error: String(err) },
      });
      await this.nats.publish(NATS_VOICE_CLONE_FAILED, { voice_clone_id, error: String(err) });
      throw err;
    }
  }

  /**
   * Synthesize speech using the ElevenLabs cloned voice.
   * Used by the Voice Call feature in Cyrano character interactions.
   */
  async textToSpeech(req: TextToSpeechRequest): Promise<TextToSpeechResult> {
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY not configured');
    }

    const clone = await this.prisma.voiceClone.findUniqueOrThrow({
      where: { voice_clone_id: req.voice_clone_id },
    });

    if (!clone.elevenlabs_voice_id) {
      throw new Error(`VoiceClone ${req.voice_clone_id} has no ElevenLabs voice ID yet`);
    }

    const model: VoiceModel = req.model ?? 'eleven_multilingual_v2';

    const response = await fetch(
      `${ELEVENLABS_BASE}/text-to-speech/${clone.elevenlabs_voice_id}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: req.text,
          model_id: model,
          voice_settings: {
            stability: req.stability ?? 0.5,
            similarity_boost: req.similarity_boost ?? 0.75,
            style: req.style ?? 0.0,
            use_speaker_boost: req.use_speaker_boost ?? true,
          },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`ElevenLabs TTS ${response.status}: ${await response.text()}`);
    }

    // In production this buffer would be uploaded to S3 and a presigned URL returned.
    // For now we return a data-URI placeholder to unblock frontend integration.
    const audioBuffer = Buffer.from(await response.arrayBuffer());
    const audioUrl = `data:audio/mpeg;base64,${audioBuffer.toString('base64')}`;

    await this.nats.publish(NATS_VOICE_TTS_GENERATED, {
      voice_clone_id: req.voice_clone_id,
      characters_used: req.text.length,
    });

    return {
      audio_url: audioUrl,
      voice_clone_id: req.voice_clone_id,
      characters_used: req.text.length,
      model,
      generated_at_utc: new Date().toISOString(),
    };
  }

  /** List all voice clones for a twin. */
  async listForTwin(twin_id: string): Promise<VoiceCloneSummary[]> {
    const records = await this.prisma.voiceClone.findMany({
      where: { twin_id },
      orderBy: { created_at: 'desc' },
    });
    return records.map((r) => this.toSummary(r));
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private toSummary(r: {
    voice_clone_id: string;
    twin_id: string;
    creator_id: string;
    voice_name: string;
    elevenlabs_voice_id: string | null;
    status: string;
    created_at: Date;
  }): VoiceCloneSummary {
    return {
      voice_clone_id: r.voice_clone_id,
      twin_id: r.twin_id,
      creator_id: r.creator_id,
      voice_name: r.voice_name,
      elevenlabs_voice_id: r.elevenlabs_voice_id,
      status: r.status as VoiceCloneStatus,
      created_at_utc: r.created_at.toISOString(),
    };
  }
}
