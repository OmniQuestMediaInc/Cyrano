// PAYLOAD 5+ — Cyrano module
// Phase 1.6 + 3.10 + 3.11 — Layer 1 (whisper copilot) is the production
// surface today; Layer 3 (HCZ consumer) is a scaffolded provider; Layer 4
// (enterprise multi-tenant API) is the new v1 surface added by this PR.
// Layer 2 lives in apps/cyrano-standalone/.
import { Module } from '@nestjs/common';
import { NatsModule } from '../../core-api/src/nats/nats.module';
import { CyranoLayer3HczService } from './cyrano-layer3-hcz.service';
import { CyranoLayer4ApiKeyService } from './cyrano-layer4-api-key.service';
import { CyranoLayer4AuditService } from './cyrano-layer4-audit.service';
import { CyranoLayer4Controller } from './cyrano-layer4.controller';
import { CyranoLayer4EnterpriseService } from './cyrano-layer4-enterprise.service';
import { CyranoLayer4Guard } from './cyrano-layer4.guard';
import { CyranoLayer4RateLimiterService } from './cyrano-layer4-rate-limiter.service';
import { CyranoLayer4TenantStore } from './cyrano-layer4-tenant.store';
import { CyranoLayer4VoiceBridge } from './cyrano-layer4-voice.bridge';
import { CyranoService } from './cyrano.service';
import { PersonaManager } from './persona.manager';
import { SessionMemoryStore } from './session-memory.store';

@Module({
  imports: [NatsModule],
  controllers: [CyranoLayer4Controller],
  providers: [
    SessionMemoryStore,
    PersonaManager,
    CyranoService,
    CyranoLayer3HczService,
    // Layer 4 v1
    CyranoLayer4TenantStore,
    CyranoLayer4ApiKeyService,
    CyranoLayer4RateLimiterService,
    CyranoLayer4AuditService,
    CyranoLayer4VoiceBridge,
    CyranoLayer4EnterpriseService,
    CyranoLayer4Guard,
  ],
  exports: [
    SessionMemoryStore,
    PersonaManager,
    CyranoService,
    CyranoLayer3HczService,
    CyranoLayer4TenantStore,
    CyranoLayer4ApiKeyService,
    CyranoLayer4RateLimiterService,
    CyranoLayer4AuditService,
    CyranoLayer4VoiceBridge,
    CyranoLayer4EnterpriseService,
    CyranoLayer4Guard,
  ],
})
export class CyranoModule {}
