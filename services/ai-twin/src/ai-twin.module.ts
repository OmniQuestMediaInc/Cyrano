// services/ai-twin/src/ai-twin.module.ts
// CYR: AI Twin NestJS module registration

import { Module } from '@nestjs/common';
import { AiTwinService } from './ai-twin.service';
import { AiTwinController } from './ai-twin.controller';

@Module({
  controllers: [AiTwinController],
  providers: [AiTwinService],
  exports: [AiTwinService],
})
export class AiTwinModule {}
