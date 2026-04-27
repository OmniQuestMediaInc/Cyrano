// CYR: PROMO-001 — Launch Promotion Engine
// Handles LAUNCH70 promo code validation and subscription creation with discount.
// FIZ: promo codes affect subscription pricing — FIZ rules apply.
// REASON: Launch promotion — 70% off first subscription period.
// IMPACT: Writes to membership_subscriptions and increments promo_codes.used_count.
// CORRELATION_ID: CNZ-WORK-001-PROMO-001
import {
  Injectable,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { BillingInterval, MembershipTier, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { NatsService } from '../nats/nats.service';
import { PROMOTION, MEMBERSHIP } from '../config/governance.config';
import { NATS_TOPICS } from '../../../nats/topics.registry';
import { v4 as uuidv4 } from 'uuid';

export interface ApplyLaunchPromoInput {
  userId: string;
  tier: MembershipTier;
  billingInterval: BillingInterval;
  organizationId: string;
  tenantId: string;
}

@Injectable()
export class PromotionService {
  private readonly logger = new Logger(PromotionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly natsService: NatsService,
  ) {}

  /**
   * Apply the LAUNCH70 promo code and create an ACTIVE subscription for the user.
   * Returns null if the promo code is missing, expired, or exhausted.
   * Throws ConflictException if the user already has an ACTIVE subscription.
   */
  async applyLaunchPromo(
    input: ApplyLaunchPromoInput,
  ): Promise<{ id: string } | null> {
    const { userId, tier, billingInterval, organizationId, tenantId } = input;
    const ruleAppliedId = 'PROMO-001_APPLY_LAUNCH70_v1';

    this.logger.log('PromotionService.applyLaunchPromo', {
      user_id: userId,
      tier,
      billing_interval: billingInterval,
      rule_applied_id: ruleAppliedId,
    });

    const promo = await this.prisma.promoCode.findUnique({
      where: { code: PROMOTION.LAUNCH70_CODE },
    });

    if (!promo) {
      this.logger.warn(
        'PromotionService.applyLaunchPromo: LAUNCH70 promo code not found',
        { rule_applied_id: ruleAppliedId },
      );
      return null;
    }

    const now = new Date();

    if (now > promo.expires_at) {
      this.logger.warn(
        'PromotionService.applyLaunchPromo: LAUNCH70 promo code is expired',
        {
          expires_at: promo.expires_at.toISOString(),
          rule_applied_id: ruleAppliedId,
        },
      );
      this.natsService.publish(NATS_TOPICS.PROMO_EXPIRED, {
        code: PROMOTION.LAUNCH70_CODE,
        user_id: userId,
        rule_applied_id: ruleAppliedId,
        timestamp: now.toISOString(),
      });
      return null;
    }

    if (promo.used_count >= promo.max_uses) {
      this.logger.warn(
        'PromotionService.applyLaunchPromo: LAUNCH70 promo code max uses reached',
        {
          used_count: promo.used_count,
          max_uses: promo.max_uses,
          rule_applied_id: ruleAppliedId,
        },
      );
      return null;
    }

    // One ACTIVE subscription per user — check before creating
    const existing = await this.prisma.membershipSubscription.findFirst({
      where: { user_id: userId, status: SubscriptionStatus.ACTIVE },
    });
    if (existing) {
      this.logger.warn(
        'PromotionService.applyLaunchPromo: user already has ACTIVE subscription',
        {
          user_id: userId,
          existing_subscription_id: existing.id,
          rule_applied_id: ruleAppliedId,
        },
      );
      throw new ConflictException({
        message: 'User already has an active membership subscription.',
        rule_applied_id: ruleAppliedId,
        existing_subscription_id: existing.id,
      });
    }

    const promoMonths = this.resolvePromoMonths(billingInterval);
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + promoMonths);

    // Derive commitment_months and bonus_months from the standard ADR-003 matrix
    const { commitmentMonths, bonusMonths } = this.resolveBillingBonus(billingInterval);

    // Increment used_count in the same logical operation
    const [subscription] = await this.prisma.$transaction([
      this.prisma.membershipSubscription.create({
        data: {
          user_id: userId,
          tier,
          status: SubscriptionStatus.ACTIVE,
          billing_interval: billingInterval,
          commitment_months: commitmentMonths,
          bonus_months: bonusMonths,
          current_period_start: now,
          current_period_end: periodEnd,
          promo_code: PROMOTION.LAUNCH70_CODE,
          organization_id: organizationId,
          tenant_id: tenantId,
        },
      }),
      this.prisma.promoCode.update({
        where: { id: promo.id },
        data: { used_count: { increment: 1 } },
      }),
    ]);

    this.logger.log('PromotionService.applyLaunchPromo: promo applied', {
      subscription_id: subscription.id,
      user_id: userId,
      tier,
      billing_interval: billingInterval,
      promo_months: promoMonths,
      discount_pct: PROMOTION.LAUNCH70_DISCOUNT_PCT,
      rule_applied_id: ruleAppliedId,
    });

    this.natsService.publish(NATS_TOPICS.PROMO_APPLIED, {
      correlation_id: uuidv4(),
      subscription_id: subscription.id,
      user_id: userId,
      tier,
      billing_interval: billingInterval,
      promo_code: PROMOTION.LAUNCH70_CODE,
      discount_pct: PROMOTION.LAUNCH70_DISCOUNT_PCT,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      organization_id: organizationId,
      tenant_id: tenantId,
      rule_applied_id: ruleAppliedId,
      timestamp: now.toISOString(),
    });

    return { id: subscription.id };
  }

  /**
   * Validate and retrieve a promo code. Returns null if not found, expired, or exhausted.
   */
  async validatePromoCode(code: string): Promise<boolean> {
    const promo = await this.prisma.promoCode.findUnique({
      where: { code },
    });
    if (!promo) return false;
    if (new Date() > promo.expires_at) return false;
    if (promo.used_count >= promo.max_uses) return false;
    return true;
  }

  /**
   * Promo months for the LAUNCH70 period:
   * ANNUAL billing → 12 months; all other intervals → 1 month.
   */
  private resolvePromoMonths(billingInterval: BillingInterval): number {
    return billingInterval === BillingInterval.ANNUAL
      ? PROMOTION.LAUNCH70_ANNUAL_MONTHS
      : PROMOTION.LAUNCH70_STANDARD_MONTHS;
  }

  /**
   * Resolve commitment_months and bonus_months from ADR-003 matrix.
   */
  private resolveBillingBonus(billingInterval: BillingInterval): {
    commitmentMonths: number;
    bonusMonths: number;
  } {
    if (billingInterval === BillingInterval.QUARTERLY) {
      return {
        commitmentMonths: MEMBERSHIP.DURATION_BONUS.QUARTERLY.commitment_months,
        bonusMonths: MEMBERSHIP.DURATION_BONUS.QUARTERLY.bonus_months,
      };
    }
    if (billingInterval === BillingInterval.SEMI_ANNUAL) {
      return {
        commitmentMonths: MEMBERSHIP.DURATION_BONUS.SEMI_ANNUAL.commitment_months,
        bonusMonths: MEMBERSHIP.DURATION_BONUS.SEMI_ANNUAL.bonus_months,
      };
    }
    if (billingInterval === BillingInterval.ANNUAL) {
      return {
        commitmentMonths: MEMBERSHIP.DURATION_BONUS.ANNUAL.commitment_months,
        bonusMonths: MEMBERSHIP.DURATION_BONUS.ANNUAL.bonus_months,
      };
    }
    return { commitmentMonths: 1, bonusMonths: 0 };
  }
}
