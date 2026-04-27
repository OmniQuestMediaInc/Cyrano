// services/creator-onboarding/src/creator-onboarding.module.ts
// RBAC-STUDIO-001 — onboarding module.
// Imports StudioAffiliationModule to obtain StudioService for affiliation
// resolution; provides NotificationEngine directly (no Nest module wrapper
// upstream).
import { Module } from '@nestjs/common';
import { NotificationEngine } from '../../notification/src/notification.service';
import { StudioAffiliationModule } from '../../studio-affiliation/src/studio-affiliation.module';
import { CreatorOnboardingController } from './creator-onboarding.controller';
import { CreatorOnboardingService } from './creator-onboarding.service';

@Module({
  imports: [StudioAffiliationModule],
  controllers: [CreatorOnboardingController],
  providers: [CreatorOnboardingService, NotificationEngine],
  exports: [CreatorOnboardingService],
})
export class CreatorOnboardingModule {}
