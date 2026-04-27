// PAYLOAD 5 — CreatorControl.Zone module
import { Module } from '@nestjs/common';
import { NatsModule } from '../../core-api/src/nats/nats.module';
import { BroadcastTimingCopilot } from './broadcast-timing.copilot';
import { CreatorControlService } from './creator-control.service';
import { FlickerNFlameScoringEngine } from './ffs.engine';
import { SessionMonitoringCopilot } from './session-monitoring.copilot';

@Module({
  imports: [NatsModule],
  providers: [
    FlickerNFlameScoringEngine,
    BroadcastTimingCopilot,
    SessionMonitoringCopilot,
    CreatorControlService,
  ],
  exports: [
    FlickerNFlameScoringEngine,
    BroadcastTimingCopilot,
    SessionMonitoringCopilot,
    CreatorControlService,
  ],
})
export class CreatorControlModule {}
