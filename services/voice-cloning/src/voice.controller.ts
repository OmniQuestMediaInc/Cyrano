// services/voice-cloning/src/voice.controller.ts
// CYR: Voice Cloning REST controller
// CYR-CORE-001: Added class-validator DTOs + @nestjs/throttler rate limiting

import { Body, Controller, Get, Param, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsString, IsNotEmpty, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { VoiceService } from './voice.service';
import { CreateVoiceCloneRequest, TextToSpeechRequest } from './voice.types';

class RecordSampleDto {
  @IsString()
  @IsNotEmpty()
  sample_id: string;

  @IsString()
  @IsNotEmpty()
  storage_key: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  duration_seconds: number;
}

@Controller('cyrano/voice')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class VoiceController {
  constructor(private readonly voiceService: VoiceService) {}

  /** Create a new voice clone record. */
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async create(@Body() req: CreateVoiceCloneRequest) {
    return this.voiceService.createVoiceClone(req);
  }

  /** Record a voice sample upload. */
  @Post(':voiceCloneId/samples')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async recordSample(@Param('voiceCloneId') voiceCloneId: string, @Body() body: RecordSampleDto) {
    return this.voiceService.recordSample(
      voiceCloneId,
      body.sample_id,
      body.storage_key,
      body.duration_seconds,
    );
  }

  /** Start the ElevenLabs cloning process. */
  @Post(':voiceCloneId/clone')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async clone(@Param('voiceCloneId') voiceCloneId: string) {
    return this.voiceService.startCloning(voiceCloneId);
  }

  /** Synthesize speech for a character interaction. */
  @Post('tts')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async tts(@Body() req: TextToSpeechRequest) {
    return this.voiceService.textToSpeech(req);
  }

  /** List all voice clones for a twin. */
  @Get('twin/:twinId')
  async listForTwin(@Param('twinId') twinId: string) {
    return this.voiceService.listForTwin(twinId);
  }
}
