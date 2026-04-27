// FIZ: MEMB-002 — MembershipService
// Manages MembershipSubscription lifecycle: tier resolution, creation,
// cancellation, and expiration. Source of truth for active membership tier.
import { Injectable, Logger, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NatsService } from '../nats/nats.service';
import { MEMBERSHIP } from '../config/governance.config';
import { NATS_TOPICS } from '../../../nats/topics.registry';
import { ZoneAccessTier } from '../config/governance.config';
import { BillingInterval, MembershipTier, SubscriptionStatus } from '@prisma/client';

export interface CreateSubscriptionInput {
  userId: string;
  tier: MembershipTier;
  billingInterval: BillingInterval;
  organizationId: string;
  tenantId: string;
}

@Injectable()
export class MembershipService {
  private readonly logger = new Logger(MembershipService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly natsService: NatsService,
  ) {}

  /**
   * Resolve the current membership tier for a user.
   * Returns GUEST if no ACTIVE subscription exists.
   */
  async getActiveTier(userId: string): Promise<ZoneAccessTier> {
    this.logger.log('MembershipService.getActiveTier', {
      user_id: userId,
      rule_applied_id: 'MEMB-002_GET_ACTIVE_TIER_v1',
    });

    const subscription = await this.prisma.membershipSubscription.findFirst({
      where: {
        user_id: userId,
        status: SubscriptionStatus.ACTIVE,
      },
    });

    if (!subscription) {
      this.logger.log(
        'MembershipService.getActiveTier: no active subscription — defaulting to GUEST',
        {
          user_id: userId,
          rule_applied_id: 'MEMB-002_GET_ACTIVE_TIER_v1',
        },
      );
      return 'GUEST';
    }

    const tier = subscription.tier as ZoneAccessTier;
    this.logger.log('MembershipService.getActiveTier: resolved tier', {
      user_id: userId,
      tier,
      subscription_id: subscription.id,
      rule_applied_id: 'MEMB-002_GET_ACTIVE_TIER_v1',
    });
    return tier;
  }

  /**
   * Create a new ACTIVE subscription for a user.
   * Throws ConflictException if the user already has an ACTIVE subscription.
   * Calculates bonus_months per ADR-003 (MEMBERSHIP.DURATION_BONUS matrix).
   * Enforces application-level one-ACTIVE-per-user constraint.
   */
  async createSubscription(input: CreateSubscriptionInput): Promise<{ id: string }> {
    const { userId, tier, billingInterval, organizationId, tenantId } = input;
    const ruleAppliedId = 'MEMB-002_CREATE_SUBSCRIPTION_v1';

    this.logger.log('MembershipService.createSubscription', {
      user_id: userId,
      tier,
      billing_interval: billingInterval,
      rule_applied_id: ruleAppliedId,
    });

    // Application-level unique constraint: one ACTIVE subscription per user
    const existing = await this.prisma.membershipSubscription.findFirst({
      where: { user_id: userId, status: SubscriptionStatus.ACTIVE },
    });
    if (existing) {
      this.logger.warn(
        'MembershipService.createSubscription: user already has ACTIVE subscription',
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

    // Resolve bonus_months and commitment_months from ADR-003 matrix
    const { commitmentMonths, bonusMonths } = this.resolveBillingBonus(billingInterval);

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + commitmentMonths + bonusMonths);

    const subscription = await this.prisma.membershipSubscription.create({
      data: {
        user_id: userId,
        tier,
        status: SubscriptionStatus.ACTIVE,
        billing_interval: billingInterval,
        commitment_months: commitmentMonths,
        bonus_months: bonusMonths,
        current_period_start: now,
        current_period_end: periodEnd,
        organization_id: organizationId,
        tenant_id: tenantId,
      },
    });

    this.logger.log('MembershipService.createSubscription: created', {
      subscription_id: subscription.id,
      user_id: userId,
      tier,
      billing_interval: billingInterval,
      commitment_months: commitmentMonths,
      bonus_months: bonusMonths,
      rule_applied_id: ruleAppliedId,
    });

    this.natsService.publish(NATS_TOPICS.MEMBERSHIP_SUBSCRIPTION_CREATED, {
      subscription_id: subscription.id,
      user_id: userId,
      tier,
      billing_interval: billingInterval,
      commitment_months: commitmentMonths,
      bonus_months: bonusMonths,
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
   * Cancel the user's ACTIVE subscription.
   * Sets status to CANCELLED; access is retained until current_period_end.
   * Throws NotFoundException if no ACTIVE subscription exists.
   */
  async cancelSubscription(
    userId: string,
    organizationId: string,
    tenantId: string,
  ): Promise<void> {
    const ruleAppliedId = 'MEMB-002_CANCEL_SUBSCRIPTION_v1';

    this.logger.log('MembershipService.cancelSubscription', {
      user_id: userId,
      rule_applied_id: ruleAppliedId,
    });

    const subscription = await this.prisma.membershipSubscription.findFirst({
      where: { user_id: userId, status: SubscriptionStatus.ACTIVE },
    });
    if (!subscription) {
      this.logger.warn('MembershipService.cancelSubscription: no ACTIVE subscription found', {
        user_id: userId,
        rule_applied_id: ruleAppliedId,
      });
      throw new NotFoundException({
        message: 'No active subscription found for this user.',
        rule_applied_id: ruleAppliedId,
      });
    }

    const now = new Date();
    await this.prisma.membershipSubscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.CANCELLED,
        cancelled_at: now,
        organization_id: organizationId,
        tenant_id: tenantId,
      },
    });

    this.logger.log('MembershipService.cancelSubscription: cancelled', {
      subscription_id: subscription.id,
      user_id: userId,
      access_until: subscription.current_period_end.toISOString(),
      rule_applied_id: ruleAppliedId,
    });

    this.natsService.publish(NATS_TOPICS.MEMBERSHIP_SUBSCRIPTION_CANCELLED, {
      subscription_id: subscription.id,
      user_id: userId,
      tier: subscription.tier,
      cancelled_at: now.toISOString(),
      access_until: subscription.current_period_end.toISOString(),
      organization_id: organizationId,
      tenant_id: tenantId,
      rule_applied_id: ruleAppliedId,
      timestamp: now.toISOString(),
    });
  }

  /**
   * Expire a subscription by ID.
   * Sets status to EXPIRED; user tier downgrades to GUEST (resolved by getActiveTier).
   * Throws NotFoundException if the subscription does not exist.
   */
  async expireSubscription(
    subscriptionId: string,
    organizationId: string,
    tenantId: string,
  ): Promise<void> {
    const ruleAppliedId = 'MEMB-002_EXPIRE_SUBSCRIPTION_v1';

    this.logger.log('MembershipService.expireSubscription', {
      subscription_id: subscriptionId,
      rule_applied_id: ruleAppliedId,
    });

    const subscription = await this.prisma.membershipSubscription.findUnique({
      where: { id: subscriptionId },
    });
    if (!subscription) {
      this.logger.warn('MembershipService.expireSubscription: subscription not found', {
        subscription_id: subscriptionId,
        rule_applied_id: ruleAppliedId,
      });
      throw new NotFoundException({
        message: 'Subscription not found.',
        subscription_id: subscriptionId,
        rule_applied_id: ruleAppliedId,
      });
    }

    const now = new Date();
    await this.prisma.membershipSubscription.update({
      where: { id: subscriptionId },
      data: {
        status: SubscriptionStatus.EXPIRED,
        organization_id: organizationId,
        tenant_id: tenantId,
      },
    });

    this.logger.log('MembershipService.expireSubscription: expired — user downgrades to GUEST', {
      subscription_id: subscriptionId,
      user_id: subscription.user_id,
      tier: subscription.tier,
      rule_applied_id: ruleAppliedId,
    });

    this.natsService.publish(NATS_TOPICS.MEMBERSHIP_SUBSCRIPTION_EXPIRED, {
      subscription_id: subscriptionId,
      user_id: subscription.user_id,
      tier: subscription.tier,
      expired_at: now.toISOString(),
      organization_id: organizationId,
      tenant_id: tenantId,
      rule_applied_id: ruleAppliedId,
      timestamp: now.toISOString(),
    });
  }

  /**
   * Resolve commitment_months and bonus_months from GovernanceConfig ADR-003 matrix.
   * MONTHLY billing has no bonus. QUARTERLY/SEMI_ANNUAL/ANNUAL use DURATION_BONUS.
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
    // MONTHLY: 1 month commitment, no bonus
    return { commitmentMonths: 1, bonusMonths: 0 };
  }
}
