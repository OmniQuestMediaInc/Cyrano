// NATS: optimization module
// Phase 2.9 — bundles the JetStream config, sharding helpers, batch
// publisher, and circuit breaker into a single NestJS module that other
// services can import when they need the high-performance publish surface.

import { Module } from '@nestjs/common';
import { NatsModule } from '../../core-api/src/nats/nats.module';
import { NatsBatchPublisher } from './batch-publisher.service';
import { NatsCircuitBreaker } from './circuit-breaker.service';

@Module({
  imports: [NatsModule],
  providers: [NatsBatchPublisher, NatsCircuitBreaker],
  exports: [NatsBatchPublisher, NatsCircuitBreaker],
})
export class NatsOptimModule {}
