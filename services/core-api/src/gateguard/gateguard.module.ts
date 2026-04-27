// services/core-api/src/gateguard/gateguard.module.ts
// PAYLOAD 3: GateGuard Sentinel Pre-Processor module.
// PrismaModule and NatsModule are both @Global(), so no explicit imports
// are required — their providers are injected directly.
import { Module } from '@nestjs/common';
import { GateGuardService } from './gateguard.service';
import { GateGuardMiddleware } from './gateguard.middleware';

@Module({
  providers: [GateGuardService, GateGuardMiddleware],
  exports: [GateGuardService, GateGuardMiddleware],
})
export class GateGuardModule {}
