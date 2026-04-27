// CYR: SubscriptionService — Issue 3 boilerplate.
// Resolves fan-facing CyranoTier limits (FREE / SPARK / FLAME / INFERNO)
// and enforces per-action usage caps via BenefitUsage records.
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CyranoTier } from '@prisma/client';

export interface BenefitLimits {
  twins: number;
  images: number;
  voiceMin: number;
  messagesPerDay: number;
  groupSize: number;
}

export interface BenefitsResult {
  tier: CyranoTier;
  limits: BenefitLimits;
}

const TIER_LIMITS: Record<CyranoTier, BenefitLimits> = {
  FREE:    { twins: 1,  images: 0,   voiceMin: 0,  messagesPerDay: 15, groupSize: 1 },
  SPARK:   { twins: 3,  images: 40,  voiceMin: 30, messagesPerDay: -1, groupSize: 2 },
  FLAME:   { twins: -1, images: 200, voiceMin: -1, messagesPerDay: -1, groupSize: 3 },
  INFERNO: { twins: -1, images: -1,  voiceMin: -1, messagesPerDay: -1, groupSize: 3 },
};

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getBenefits(userId: string): Promise<BenefitsResult> {
    this.logger.log('SubscriptionService.getBenefits', { user_id: userId });

    const sub = await this.prisma.subscription.findUnique({
      where: { user_id: userId },
    });
    const tier: CyranoTier = sub?.tier ?? CyranoTier.FREE;

    return { tier, limits: TIER_LIMITS[tier] };
  }

  async enforceUsage(
    userId: string,
    action: 'image' | 'voice' | 'message',
  ): Promise<void> {
    // Implement middleware check using BenefitUsage + tier limits
  }
}
