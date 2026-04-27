// services/fraud-prevention/src/fraud-prevention.module.ts
import { Module } from '@nestjs/common';
import { TokenExtensionTool } from './TokenExtensionTool';
import { GateGuardRiskService } from './gateguard/GateGuardRiskService';
import { RiskScoreMLInference } from './gateguard/RiskScoreMLInference';
import { AbuseDetector } from './AbuseDetector';
import { ServiceToSaleEmitter } from './events/ServiceToSaleEmitter';
import { ChargebackRepository } from './repositories/ChargebackRepository';
import { PrismaService } from '../../core-api/src/prisma.service';

@Module({
  providers: [
    PrismaService,
    TokenExtensionTool,
    GateGuardRiskService,
    RiskScoreMLInference,
    AbuseDetector,
    ServiceToSaleEmitter,
    ChargebackRepository,
  ],
  exports: [
    TokenExtensionTool,
    GateGuardRiskService,
  ],
})
export class FraudPreventionModule {}
