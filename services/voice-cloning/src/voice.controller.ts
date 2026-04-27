// services/voice-cloning/src/voice.controller.ts
// CYR: Voice Cloning REST controller

import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { VoiceService } from './voice.service';
import { CreateVoiceCloneRequest, TextToSpeechRequest } from './voice.types';

@Controller('cyrano/voice')
export class VoiceController {
  constructor(private readonly voiceService: VoiceService) {}

  /** Create a new voice clone record. */
  @Post()
  async create(@Body() req: CreateVoiceCloneRequest) {
    return this.voiceService.createVoiceClone(req);
  }

  /** Record a voice sample upload. */
  @Post(':voiceCloneId/samples')
  async recordSample(
    @Param('voiceCloneId') voiceCloneId: string,
    @Body() body: { sample_id: string; storage_key: string; duration_seconds: number },
  ) {
    return this.voiceService.recordSample(
      voiceCloneId,
      body.sample_id,
      body.storage_key,
      body.duration_seconds,
    );
  }

  /** Start the ElevenLabs cloning process. */
  @Post(':voiceCloneId/clone')
  async clone(@Param('voiceCloneId') voiceCloneId: string) {
    return this.voiceService.startCloning(voiceCloneId);
  }

  /** Synthesize speech for a character interaction. */
  @Post('tts')
  async tts(@Body() req: TextToSpeechRequest) {
    return this.voiceService.textToSpeech(req);
  }

  /** List all voice clones for a twin. */
  @Get('twin/:twinId')
  async listForTwin(@Param('twinId') twinId: string) {
    return this.voiceService.listForTwin(twinId);
  }
}
