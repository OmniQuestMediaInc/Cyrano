// services/voice-cloning/src/voice.module.ts
// CYR: Voice Cloning NestJS module

import { Module } from '@nestjs/common';
import { VoiceService } from './voice.service';
import { VoiceController } from './voice.controller';

@Module({
  controllers: [VoiceController],
  providers: [VoiceService],
  exports: [VoiceService],
})
export class VoiceModule {}
