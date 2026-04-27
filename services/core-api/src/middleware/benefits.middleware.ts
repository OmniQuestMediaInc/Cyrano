// CYR: CYR-SUB-002 — BenefitsMiddleware
// Enforces per-guest monthly usage limits based on active Cyrano subscription tier.
// Runs after authentication middleware; expects `req.user.id` to be set.
import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma.service';
import { SubscriptionService } from '../subscription/subscription.service';

/** Format the current month as "YYYY-MM" for BenefitUsage lookup. */
function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

interface AuthedRequest extends Request {
  user?: { id: string };
}

@Injectable()
export class BenefitsMiddleware implements NestMiddleware {
  private readonly logger = new Logger(BenefitsMiddleware.name);
  private readonly RULE_ID = 'CYR-SUB-002_BENEFITS_MW_v1';

  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly prisma: PrismaService,
  ) {}

  async use(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      next();
      return;
    }

    const benefits = await this.subscriptionService.getBenefits(userId);
    const month = getCurrentMonth();

    const usage = await this.prisma.benefitUsage.findUnique({
      where: { userId_month: { user_id: userId, month } },
    });

    // Image generation limit check
    if (req.path.includes('/image') && benefits.limits.images !== -1) {
      const used = usage?.images_used ?? 0;
      if (used >= benefits.limits.images) {
        this.logger.log('BenefitsMiddleware: image limit reached', {
          user_id: userId,
          images_used: used,
          limit: benefits.limits.images,
          rule_applied_id: this.RULE_ID,
        });
        res.status(429).json({
          error: 'BENEFIT_LIMIT_REACHED',
          message: 'Monthly image limit reached. Upgrade or wait until next month.',
          tier: benefits.tier,
          limit: benefits.limits.images,
          used,
          rule_applied_id: this.RULE_ID,
        });
        return;
      }
    }

    // Message limit check
    if (req.path.includes('/chat') && benefits.limits.messages !== -1) {
      const used = usage?.messages_used ?? 0;
      if (used >= benefits.limits.messages) {
        this.logger.log('BenefitsMiddleware: message limit reached', {
          user_id: userId,
          messages_used: used,
          limit: benefits.limits.messages,
          rule_applied_id: this.RULE_ID,
        });
        res.status(429).json({
          error: 'BENEFIT_LIMIT_REACHED',
          message: 'Monthly message limit reached. Upgrade or wait until next month.',
          tier: benefits.tier,
          limit: benefits.limits.messages,
          used,
          rule_applied_id: this.RULE_ID,
        });
        return;
      }
    }

    // Video limit check
    if (req.path.includes('/video') && benefits.limits.videos !== -1) {
      const used = usage?.videos_used ?? 0;
      if (used >= benefits.limits.videos) {
        this.logger.log('BenefitsMiddleware: video limit reached', {
          user_id: userId,
          videos_used: used,
          limit: benefits.limits.videos,
          rule_applied_id: this.RULE_ID,
        });
        res.status(429).json({
          error: 'BENEFIT_LIMIT_REACHED',
          message: 'Monthly video limit reached. Upgrade or wait until next month.',
          tier: benefits.tier,
          limit: benefits.limits.videos,
          used,
          rule_applied_id: this.RULE_ID,
        });
        return;
      }
    }

    next();
  }

  /**
   * Increment a usage counter for the guest in the current month.
   * Creates the BenefitUsage row if it does not exist.
   * Call this from route handlers after a successful action (image/chat/video).
   */
  async incrementUsage(
    userId: string,
    type: 'images' | 'messages' | 'videos',
  ): Promise<void> {
    const month = getCurrentMonth();
    const field =
      type === 'images' ? 'images_used' : type === 'messages' ? 'messages_used' : 'videos_used';

    await this.prisma.benefitUsage.upsert({
      where: { userId_month: { user_id: userId, month } },
      update: {
        [field]: { increment: 1 },
        reason_code: `BENEFIT_${type.toUpperCase()}_INCREMENT`,
      },
      create: {
        user_id: userId,
        month,
        images_used: type === 'images' ? 1 : 0,
        messages_used: type === 'messages' ? 1 : 0,
        videos_used: type === 'videos' ? 1 : 0,
        correlation_id: randomUUID(),
        reason_code: `BENEFIT_${type.toUpperCase()}_INIT`,
      },
    });
  }
}
