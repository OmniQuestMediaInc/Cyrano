// DFSP Module 15 — Universal Checkout Confirmation (All Tiers)
// Spec: DFSP Engineering Spec v1.0, Module 15
// Three individual checkboxes — cannot be pre-checked or combined.
// Each timestamped independently. Email/SMS delivery stubbed — wired in v6.
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NatsService } from '../nats/nats.service';
import { NATS_TOPICS } from '../../../nats/topics.registry';

export interface CheckoutConfirmationInput {
  transaction_id: string;
  account_id: string;
  checkbox_age_confirmed: boolean;
  checkbox_no_refund_confirmed: boolean;
  checkbox_authorization_confirmed: boolean;
  session_ip?: string;
  session_fingerprint?: string;
  organization_id: string;
  tenant_id: string;
}

export interface CheckoutConfirmationResult {
  confirmation_id: string;
  transaction_id: string;
  all_confirmed: boolean;
  confirmed_at_utc: string;
  rule_applied_id: string;
}

@Injectable()
export class CheckoutConfirmationService {
  private readonly logger = new Logger(CheckoutConfirmationService.name);
  private readonly RULE_ID = 'CHECKOUT_CONFIRMATION_v1';

  constructor(
    private readonly prisma: PrismaService,
    private readonly nats: NatsService,
  ) {}

  /**
   * Records three mandatory checkout checkboxes. All must be true.
   * Partial confirmation throws — purchase cannot proceed.
   * Email receipt and SMS notification published to NATS (delivery wired in v6).
   */
  async recordConfirmations(input: CheckoutConfirmationInput): Promise<CheckoutConfirmationResult> {
    if (
      !input.checkbox_age_confirmed ||
      !input.checkbox_no_refund_confirmed ||
      !input.checkbox_authorization_confirmed
    ) {
      throw new Error(
        'CHECKOUT_INCOMPLETE: All three checkboxes must be confirmed before recording.',
      );
    }

    const now = new Date();
    const record = await this.prisma.checkoutConfirmation.create({
      data: {
        transaction_id: input.transaction_id,
        account_id: input.account_id,
        checkbox_age_confirmed: input.checkbox_age_confirmed,
        checkbox_age_confirmed_at: now,
        checkbox_no_refund_confirmed: input.checkbox_no_refund_confirmed,
        checkbox_no_refund_confirmed_at: now,
        checkbox_authorization_confirmed: input.checkbox_authorization_confirmed,
        checkbox_authorization_confirmed_at: now,
        session_ip: input.session_ip ?? null,
        session_fingerprint: input.session_fingerprint ?? null,
        organization_id: input.organization_id,
        tenant_id: input.tenant_id,
      },
    });

    this.logger.log('CheckoutConfirmationService: confirmations recorded', {
      confirmation_id: record.id,
      transaction_id: input.transaction_id,
      rule_applied_id: this.RULE_ID,
    });

    this.nats.publish(NATS_TOPICS.CHECKOUT_CONFIRMED, {
      confirmation_id: record.id,
      transaction_id: input.transaction_id,
      account_id: input.account_id,
      confirmed_at_utc: now.toISOString(),
      rule_applied_id: this.RULE_ID,
    });

    // Delivery stubs — v6 wires actual email/SMS providers
    this.nats.publish(NATS_TOPICS.CHECKOUT_EMAIL_RECEIPT_REQUESTED, {
      transaction_id: input.transaction_id,
      account_id: input.account_id,
      rule_applied_id: this.RULE_ID,
    });
    this.nats.publish(NATS_TOPICS.CHECKOUT_SMS_NOTIFICATION_REQUESTED, {
      transaction_id: input.transaction_id,
      account_id: input.account_id,
      rule_applied_id: this.RULE_ID,
    });

    return {
      confirmation_id: record.id,
      transaction_id: input.transaction_id,
      all_confirmed: true,
      confirmed_at_utc: now.toISOString(),
      rule_applied_id: this.RULE_ID,
    };
  }
}
