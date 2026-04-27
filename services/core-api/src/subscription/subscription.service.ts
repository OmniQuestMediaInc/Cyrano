// CYR: CYR-SUB-001 — SubscriptionService
// Resolves tier benefits for the authenticated guest.
// Source of truth for Cyrano portal subscription state.
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TierBenefits, TIER_BENEFITS, SubscriptionTier } from './subscription.types';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Return the benefit limits for the guest's active Cyrano subscription.
   * Defaults to SPARK limits when no active subscription exists.
   */
  async getBenefits(userId: string): Promise<TierBenefits> {
    this.logger.log('SubscriptionService.getBenefits', {
      user_id: userId,
      rule_applied_id: 'CYR-SUB-001_GET_BENEFITS_v1',
    });

    const subscription = await this.prisma.subscription.findFirst({
      where: { user_id: userId, status: 'ACTIVE' },
    });

    const tier: SubscriptionTier = (subscription?.tier as SubscriptionTier) ?? 'SPARK';
    return TIER_BENEFITS[tier];
  }
}
