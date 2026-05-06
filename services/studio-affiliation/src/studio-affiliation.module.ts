// services/studio-affiliation/src/studio-affiliation.module.ts
// RBAC-STUDIO-001 — StudioAffiliationModule (initial scaffold).
// Provides StudioService for creator-onboarding and any other consumer.
import { Module } from '@nestjs/common';
import { StudioService } from './studio.service';

@Module({
  providers: [StudioService],
  exports: [StudioService],
})
export class StudioAffiliationModule {}
