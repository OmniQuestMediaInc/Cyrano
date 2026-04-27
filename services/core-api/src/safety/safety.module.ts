// WO: WO-036-KYC-VAULT-PUBLISH-GATE
// KYC: KYC-001 — added PublishGateService
// MOD: MOD-001 — added IncidentService
import { Module } from '@nestjs/common';
import { SafetyService } from './safety.service';
import { PublishGateService } from './publish-gate.service';
import { IncidentService } from './incident.service';

/**
 * WO-036-KYC-VAULT-PUBLISH-GATE: Safety Module
 * Provides the deterministic publish gate, vault access audit, and incident lifecycle services.
 */
@Module({
  providers: [SafetyService, PublishGateService, IncidentService],
  exports: [SafetyService, PublishGateService, IncidentService],
})
export class SafetyModule {}
