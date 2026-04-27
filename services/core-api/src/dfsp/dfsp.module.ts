// services/core-api/src/dfsp/dfsp.module.ts
// FIZ: PV-001 — DFSP Foundation Layer
// Diamond Financial Security Platform™ — OmniQuest Media Inc.
import { Module } from '@nestjs/common';
import { PurchaseHoursGateService } from './purchase-hours-gate.service';
import { RiskScoringService } from './risk-scoring.service';
import { IntegrityHoldService } from './integrity-hold.service';
import { CheckoutConfirmationService } from './checkout-confirmation.service';
import { VoiceSampleService } from './voice-sample.service';
import { PlatformOtpService } from './platform-otp.service';
import { AccountRecoveryHoldService } from './account-recovery-hold.service';

@Module({
  providers: [
    PurchaseHoursGateService,
    RiskScoringService,
    IntegrityHoldService,
    CheckoutConfirmationService,
    VoiceSampleService,
    PlatformOtpService,
    AccountRecoveryHoldService,
  ],
  exports: [
    PurchaseHoursGateService,
    RiskScoringService,
    IntegrityHoldService,
    CheckoutConfirmationService,
    VoiceSampleService,
    PlatformOtpService,
    AccountRecoveryHoldService,
  ],
})
export class DfspModule {}
