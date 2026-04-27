// CYR: CYR-SUB-001 — SubscriptionModule
// Wires StripeService, SubscriptionService, and StripeWebhookController.
// Imports PaymentsModule for WebhookHardeningService (FIZ replay/nonce guard).
import { Module } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { SubscriptionService } from './subscription.service';
import { StripeWebhookController } from './stripe-webhook.controller';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [PaymentsModule],
  controllers: [StripeWebhookController],
  providers: [StripeService, SubscriptionService],
  exports: [StripeService, SubscriptionService],
})
export class SubscriptionModule {}
