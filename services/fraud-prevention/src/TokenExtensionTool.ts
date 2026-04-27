// services/fraud-prevention/src/TokenExtensionTool.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ExtensionAuthority, ExtensionRequest, ExtensionActionRecord } from './interfaces/shared';
import { AbuseDetector } from './AbuseDetector';
import { ServiceToSaleEmitter } from './events/ServiceToSaleEmitter';
import { GateGuardRiskService } from './gateguard/GateGuardRiskService';
import { ChargebackRepository } from './repositories/ChargebackRepository';

interface TierAuthority {
  maxExpiryExtensionDays: number;
  maxGoodwillCreditCZT: number;
}

@Injectable()
export class TokenExtensionTool {
  private readonly logger = new Logger(TokenExtensionTool.name);

  constructor(
    private readonly abuseDetector: AbuseDetector,
    private readonly serviceToSaleEmitter: ServiceToSaleEmitter,
    private readonly gateGuard: GateGuardRiskService,
    private readonly repository: ChargebackRepository,
  ) {}

  async executeExtension(request: ExtensionRequest): Promise<ExtensionActionRecord & { createdAt: Date }> {
    await this.gateGuard.checkActionAllowed(
      request.guestId,
      'TOKEN_EXTENSION',
      request.goodwillCreditCZT ?? request.expiryExtensionDays,
    );

    const authority: TierAuthority =
      request.agentTier === ExtensionAuthority.TIER_2
        ? { maxExpiryExtensionDays: 30, maxGoodwillCreditCZT: 500 }
        : { maxExpiryExtensionDays: 90, maxGoodwillCreditCZT: 2000 };

    if (!this.isWithinAuthority(request, authority)) {
      throw new BadRequestException('EXCEEDS_TIER_AUTHORITY');
    }

    const record: Omit<ExtensionActionRecord, 'actionId'> = {
      guestId: request.guestId,
      agentId: request.agentId,
      agentTier: request.agentTier,
      action: request.action,
      expiryExtensionDays: request.action === 'EXPIRY_EXTENSION' ? (request.expiryExtensionDays ?? null) : null,
      goodwillCreditCZT: request.action === 'GOODWILL_CREDIT' ? (request.goodwillCreditCZT ?? null) : null,
      interactionRef: request.interactionRef,
      reason: request.reason,
      executedAt: new Date(),
      ceoReviewFlagged:
        request.agentTier === ExtensionAuthority.TIER_3 &&
        ((request.goodwillCreditCZT ?? 0) > 1500 || (request.expiryExtensionDays ?? 0) > 60),
    };

    const saved = await this.repository.createExtensionAction(record);
    await this.serviceToSaleEmitter.emit({ type: 'SERVICE_TO_SALE', ...request });

    this.logger.log('Token extension executed', { actionId: saved.actionId });
    return saved;
  }

  private isWithinAuthority(req: ExtensionRequest, auth: TierAuthority): boolean {
    if (req.action === 'EXPIRY_EXTENSION' && (req.expiryExtensionDays ?? 0) > auth.maxExpiryExtensionDays) return false;
    if (req.action === 'GOODWILL_CREDIT' && (req.goodwillCreditCZT ?? 0) > auth.maxGoodwillCreditCZT) return false;
    return true;
  }
}
