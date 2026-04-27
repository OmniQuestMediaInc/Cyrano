// PAYLOAD 5 — Integration Hub module
import { Module } from '@nestjs/common';
import { NatsModule } from '../../core-api/src/nats/nats.module';
import { CreatorControlModule } from '../../creator-control/src/creator-control.module';
import { CyranoModule } from '../../cyrano/src/cyrano.module';
import { IntegrationHubService } from './hub.service';

@Module({
  imports: [NatsModule, CreatorControlModule, CyranoModule],
  providers: [IntegrationHubService],
  exports: [IntegrationHubService],
})
export class IntegrationHubModule {}
