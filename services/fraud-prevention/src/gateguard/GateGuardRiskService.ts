// services/fraud-prevention/src/gateguard/GateGuardRiskService.ts
import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { RiskScoreMLInference } from './RiskScoreMLInference';
import { ChargebackRepository } from '../repositories/ChargebackRepository';
import { RiskFeatures } from '../interfaces/shared';

@Injectable()
export class GateGuardRiskService {
  private readonly logger = new Logger(GateGuardRiskService.name);

  constructor(
    private readonly mlInference: RiskScoreMLInference,
    private readonly repository: ChargebackRepository,
  ) {}

  async checkActionAllowed(guestId: string, actionType: string, valueCZT?: number): Promise<void> {
    const features = await this.extractFeatures(guestId);
    const prediction = await this.mlInference.predict(features);

    this.logger.debug('GateGuard risk check', {
      guestId,
      actionType,
      valueCZT,
      riskScore: prediction.riskScore,
      tier: prediction.tier,
    });

    if (prediction.tier === 'RED') {
      throw new ForbiddenException({
        code: 'GATEGUARD_BLOCKED',
        message: 'High risk profile - action denied by GateGuard Sentinel™',
        riskScore: prediction.riskScore,
        confidence: prediction.confidence,
      });
    }
  }

  private async extractFeatures(guestId: string): Promise<RiskFeatures> {
    const extensionActionCount30d = await this.repository.getExtensionActionCount30d(guestId);

    return {
      friendlyFraudScore: 15,
      chargebackCount30d: extensionActionCount30d,
      extensionAbuseCount: 1,
      lowUsageAfterPurchase: 25,
      rapidPurchaseVelocity: 2,
      paymentDeclineRate: 0.05,
      sessionActivityScore: 78,
    };
  }
}
