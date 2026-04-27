// CYR: CYR-SUB-001 + FIZ:
// REASON: Implement Stripe Checkout + subscription webhook for Cyrano portal tiers.
// IMPACT: Creates/updates cyrano_subscriptions on successful Stripe checkout.
// CORRELATION_ID: CYR-SUB-001
//
// StripeService — Checkout session creation and webhook event processing.
// Signature verification is handled exclusively by stripe.webhooks.constructEvent()
// in the controller, covering HMAC-SHA256 + timestamp-drift replay prevention.
import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma.service';
import { NatsService } from '../nats/nats.service';
import { NATS_TOPICS } from '../../../nats/topics.registry';
import { SubscriptionTier, Portal, BillingCycle } from './subscription.types';

// Stripe price IDs per tier and billing cycle.
// Replace placeholder values with real Stripe Price IDs before go-live.
const STRIPE_PRICES: Record<Exclude<SubscriptionTier, never>, Record<BillingCycle, string>> = {
  SPARK:   { monthly: process.env.STRIPE_PRICE_SPARK_MONTHLY   ?? 'price_spark_monthly',   annual: process.env.STRIPE_PRICE_SPARK_ANNUAL   ?? 'price_spark_annual'   },
  FLAME:   { monthly: process.env.STRIPE_PRICE_FLAME_MONTHLY   ?? 'price_flame_monthly',   annual: process.env.STRIPE_PRICE_FLAME_ANNUAL   ?? 'price_flame_annual'   },
  INFERNO: { monthly: process.env.STRIPE_PRICE_INFERNO_MONTHLY ?? 'price_inferno_monthly', annual: process.env.STRIPE_PRICE_INFERNO_ANNUAL ?? 'price_inferno_annual' },
};

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(StripeService.name);
  private readonly RULE_ID = 'CYR-SUB-001_STRIPE_v1';

  constructor(
    private readonly prisma: PrismaService,
    private readonly nats: NatsService,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-01-27.acacia' as Stripe.LatestApiVersion,
    });
  }

  /**
   * Create a Stripe Checkout session for the given tier and portal.
   * The session embeds userId, tier, portalId, and cycle in metadata so the
   * webhook can write the subscription record on completion.
   */
  async createCheckoutSession(
    userId: string,
    tier: SubscriptionTier,
    portal: Portal,
    cycle: BillingCycle,
  ): Promise<Stripe.Checkout.Session> {
    this.logger.log('StripeService.createCheckoutSession', {
      user_id: userId,
      tier,
      portal,
      cycle,
      rule_applied_id: this.RULE_ID,
    });

    // User model does not carry email — pass undefined; Stripe will collect
    // it on the hosted checkout page.
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: STRIPE_PRICES[tier][cycle], quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing`,
      metadata: { userId, tier, portal, cycle },
    });

    this.logger.log('StripeService.createCheckoutSession: session created', {
      user_id: userId,
      session_id: session.id,
      rule_applied_id: this.RULE_ID,
    });

    return session;
  }

  /**
   * Handle an already-verified Stripe webhook event.
   * Only `checkout.session.completed` is acted upon at this stage.
   * Called by StripeWebhookController after signature validation.
   */
  async handleWebhook(event: Stripe.Event): Promise<void> {
    if (event.type !== 'checkout.session.completed') {
      return;
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const { userId, tier, portal, cycle } = session.metadata ?? {};

    if (!userId || !tier || !portal) {
      this.logger.warn('StripeService.handleWebhook: missing metadata', {
        session_id: session.id,
        rule_applied_id: this.RULE_ID,
      });
      return;
    }

    const correlationId = randomUUID();
    const now = new Date();

    await this.prisma.subscription.upsert({
      where: { user_id_portal: { user_id: userId, portal: portal as Portal } },
      update: {
        tier: tier as SubscriptionTier,
        status: 'ACTIVE',
        stripe_customer_id: session.customer as string | null,
        stripe_subscription_id: session.subscription as string | null,
        updated_at: now,
        reason_code: 'CYRANO_SUB_RENEWED',
      },
      create: {
        user_id: userId,
        tier: tier as SubscriptionTier,
        portal: portal as Portal,
        status: 'ACTIVE',
        stripe_customer_id: session.customer as string | null,
        stripe_subscription_id: session.subscription as string | null,
        start_date: now,
        correlation_id: correlationId,
        reason_code: 'CYRANO_SUB_CREATED',
      },
    });

    this.logger.log('StripeService.handleWebhook: subscription upserted', {
      user_id: userId,
      tier,
      portal,
      cycle,
      correlation_id: correlationId,
      rule_applied_id: this.RULE_ID,
    });

    this.nats.publish(NATS_TOPICS.MEMBERSHIP_SUBSCRIPTION_CREATED, {
      user_id: userId,
      tier,
      portal,
      cycle,
      stripe_session_id: session.id,
      correlation_id: correlationId,
      timestamp: now.toISOString(),
      rule_applied_id: this.RULE_ID,
    });
  }

  /**
   * Construct and verify a Stripe webhook event from the raw request body
   * and signature header. Returns null on verification failure.
   * This is the Stripe-native signature check; callers may additionally
   * run WebhookHardeningService for replay-window enforcement.
   */
  constructEvent(
    rawBody: Buffer | string,
    signature: string,
    webhookSecret: string,
  ): Stripe.Event | null {
    try {
      return this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      // Never log the raw body or secret.
      this.logger.warn('StripeService.constructEvent: verification failed', {
        error_class: err instanceof Error ? err.name : 'Unknown',
        rule_applied_id: this.RULE_ID,
      });
      return null;
    }
  }
}
