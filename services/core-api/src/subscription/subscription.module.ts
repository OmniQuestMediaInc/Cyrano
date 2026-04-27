// CYR: CYR-SUB-001 — SubscriptionModule
// Wires StripeService, SubscriptionService, and StripeWebhookController.
import { Module } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { SubscriptionService } from './subscription.service';
import { StripeWebhookController } from './stripe-webhook.controller';

@Module({
  controllers: [StripeWebhookController],
  providers: [StripeService, SubscriptionService],
  exports: [StripeService, SubscriptionService],
})
export class SubscriptionModule {}
