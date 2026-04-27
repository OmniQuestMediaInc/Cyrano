// WO: WO-037, WO-038, GWP-001
import { Module } from '@nestjs/common';
import { ReferralRewardService } from './referral-reward.service';
import { GuardedNotificationService } from './guarded-notification.service';
import { GwpService } from './gwp.service';
import { GovernanceConfigService } from '../config/governance.config';

/**
 * GrowthModule — Phase 3 Growth Primitives
 * Provides:
 *   - ReferralRewardService (WO-037: Creator-Led Attribution Engine)
 *   - GuardedNotificationService (WO-038: Consent-Aware Notification Service)
 *   - GwpService (GWP-001: Gift With Purchase)
 */
@Module({
  providers: [
    ReferralRewardService,
    GuardedNotificationService,
    GwpService,
    GovernanceConfigService,
  ],
  exports: [ReferralRewardService, GuardedNotificationService, GwpService],
})
export class GrowthModule {}
