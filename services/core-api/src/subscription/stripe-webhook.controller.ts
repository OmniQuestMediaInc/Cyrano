// CYR: CYR-SUB-001 + FIZ:
// REASON: Stripe webhook endpoint — validates signature then delegates to StripeService.
// IMPACT: Writes cyrano_subscriptions on checkout.session.completed.
// CORRELATION_ID: CYR-SUB-001
//
// Raw body access: NestJS must be bootstrapped with `rawBody: true` in
// NestFactory.create() so that req.rawBody is populated before JSON parsing.
// The Stripe signature check requires the byte-exact raw body.
//
// Signature verification is performed exclusively via stripe.webhooks.constructEvent()
// (Stripe SDK). This covers timestamp-drift replay prevention and HMAC-SHA256
// validation in a single call, so no secondary raw_body forwarding is needed.
// StripeService.handleWebhook() uses upsert for idempotent writes — safe under
// Stripe's at-least-once delivery guarantee.
import {
  Controller,
  Post,
  Headers,
  Req,
  Res,
  Logger,
  HttpCode,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { StripeService } from './stripe.service';

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

@Controller('stripe')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);
  private readonly RULE_ID = 'CYR-SUB-001_WEBHOOK_CTRL_v1';

  constructor(private readonly stripeService: StripeService) {}

  /**
   * POST /stripe/webhook
   *
   * Accepts Stripe webhook events. Validates the Stripe-signature header
   * using the byte-exact raw body via stripe.webhooks.constructEvent(), which
   * enforces HMAC-SHA256 verification and timestamp-drift replay prevention.
   *
   * Responds 400 on signature failure, 200 on success (Stripe requires a
   * 2xx response to consider the event delivered).
   */
  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Req() req: RawBodyRequest,
    @Res() res: Response,
    @Headers('stripe-signature') signature: string,
  ): Promise<void> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      this.logger.error('StripeWebhookController: STRIPE_WEBHOOK_SECRET not configured', {
        rule_applied_id: this.RULE_ID,
      });
      res.status(500).json({ error: 'WEBHOOK_SECRET_MISSING' });
      return;
    }

    if (!signature) {
      this.logger.warn('StripeWebhookController: missing stripe-signature header', {
        rule_applied_id: this.RULE_ID,
      });
      res.status(400).json({ error: 'SIGNATURE_MISSING' });
      return;
    }

    // Use raw body buffer for Stripe signature verification.
    // req.rawBody is populated when NestJS is bootstrapped with rawBody: true.
    const rawBody: Buffer | string = req.rawBody ?? req.body;

    const event = this.stripeService.constructEvent(rawBody, signature, webhookSecret);
    if (!event) {
      res.status(400).json({ error: 'SIGNATURE_INVALID' });
      return;
    }

    try {
      await this.stripeService.handleWebhook(event);
      res.status(200).json({ received: true });
    } catch (err) {
      this.logger.error('StripeWebhookController: handleWebhook threw', {
        event_id: event.id,
        event_type: event.type,
        error: String(err),
        rule_applied_id: this.RULE_ID,
      });
      res.status(500).json({ error: 'WEBHOOK_PROCESSING_FAILED' });
    }
  }
}
