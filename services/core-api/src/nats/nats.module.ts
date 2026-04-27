// services/core-api/src/nats/nats.module.ts
import { Global, Module } from '@nestjs/common';
import { NatsService } from './nats.service';

// Global module — NatsService is available to every other module
// without needing to import NatsModule explicitly.
@Global()
@Module({
  providers: [NatsService],
  exports: [NatsService],
})
export class NatsModule {}
