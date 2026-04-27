// CYR: CYR-SUB-001 + FIZ:
// REASON: Stripe webhook endpoint — validates signature then delegates to StripeService.
// IMPACT: Writes cyrano_subscriptions on checkout.session.completed.
// CORRELATION_ID: CYR-SUB-001
//
// Raw body access: NestJS must be bootstrapped with `rawBody: true` in
// NestFactory.create() so that req.rawBody is populated before JSON parsing.
// The Stripe signature check requires the byte-exact raw body.
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
import { WebhookHardeningService } from '../payments/webhook-hardening.service';

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

@Controller('stripe')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);
  private readonly RULE_ID = 'CYR-SUB-001_WEBHOOK_CTRL_v1';

  constructor(
    private readonly stripeService: StripeService,
    private readonly webhookHardening: WebhookHardeningService,
  ) {}

  /**
   * POST /stripe/webhook
   *
   * Accepts Stripe webhook events. Validates the Stripe signature using the
   * byte-exact raw body, then runs WebhookHardeningService replay/nonce
   * checks before delegating to StripeService.handleWebhook().
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
    const rawBody: Buffer | string = req.rawBody ?? req.body;

    const event = this.stripeService.constructEvent(rawBody, signature, webhookSecret);
    if (!event) {
      res.status(400).json({ error: 'SIGNATURE_INVALID' });
      return;
    }

    // Secondary: replay-window and event_id idempotency via WebhookHardeningService.
    // Extract timestamp from Stripe signature header (t=<unix_sec>,v1=<sig>).
    const timestampMatch = /t=(\d+)/.exec(signature);
    const timestampSeconds = timestampMatch ? parseInt(timestampMatch[1], 10) : 0;

    const hardeningResult = this.webhookHardening.validate({
      processor_id: 'stripe',
      event_id: event.id,
      timestamp_seconds: timestampSeconds,
      signature,
      signing_secret: webhookSecret,
      raw_body: typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'),
    });

    if (!hardeningResult.valid) {
      this.logger.warn('StripeWebhookController: hardening rejected', {
        failure_reason: hardeningResult.failure_reason,
        event_id: event.id,
        rule_applied_id: this.RULE_ID,
      });
      // Respond 200 to prevent Stripe from retrying idempotent duplicates;
      // respond 400 for genuine replay/signature failures.
      const status = hardeningResult.failure_reason === 'EVENT_ID_DUPLICATE' ? 200 : 400;
      res.status(status).json({ error: hardeningResult.failure_reason });
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
