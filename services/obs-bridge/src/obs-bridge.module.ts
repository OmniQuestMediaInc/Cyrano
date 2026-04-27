// OBS: OBS-001 — OBSBridgeModule
// Provides OBSBridgeService, ChatAggregatorService, and PersonaEngineService.
import { Module } from '@nestjs/common';
import { OBSBridgeService } from './obs-bridge.service';
import { ChatAggregatorService } from './chat-aggregator.service';
import { PersonaEngineService } from './persona-engine.service';

@Module({
  providers: [OBSBridgeService, ChatAggregatorService, PersonaEngineService],
  exports: [OBSBridgeService, ChatAggregatorService, PersonaEngineService],
})
export class OBSBridgeModule {}
