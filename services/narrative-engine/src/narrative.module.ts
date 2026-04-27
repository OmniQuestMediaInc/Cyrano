// services/narrative-engine/src/narrative.module.ts
// CYR: Narrative Engine NestJS module

import { Module } from '@nestjs/common';
import { NarrativeService } from './narrative.service';
import { NarrativeController } from './narrative.controller';

@Module({
  controllers: [NarrativeController],
  providers: [NarrativeService],
  exports: [NarrativeService],
})
export class NarrativeModule {}
