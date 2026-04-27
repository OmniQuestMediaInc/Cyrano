// services/core-api/src/refund/refund-disclosure.service.ts
// Refund Policy Disclosure — non-refundable acknowledgment surface.
//
// Responsibilities:
//   • Serve the versioned refund-policy disclosure text at checkout.
//   • Record and publish RefundPolicyAcknowledgmentEvent on every
//     explicit guest acknowledgment (compliance audit trail).
//
// Doctrine:
//   - Disclosure text is immutable for a given policyVersion.
//   - Acknowledgment events are append-only; never mutated after emission.
//   - ipAddress in the acknowledgment payload MUST be SHA-256 hashed by
//     the caller before it reaches this service.

import { Injectable, Logger } from '@nestjs/common';
import { NatsService } from '../nats/nats.service';
import { NATS_TOPICS } from '../../../nats/topics.registry';
import {
  RefundPolicyAcknowledgmentEvent,
} from './refund-disclosure.types';

const RULE_ID = 'REFUND_DISCLOSURE_v1';

@Injectable()
export class RefundDisclosureService {
  private readonly logger = new Logger(RefundDisclosureService.name);
  private readonly CURRENT_POLICY_VERSION = 'v1.0';

  constructor(private readonly nats: NatsService) {}

  getDisclosure(guestId: string, transactionRef: string) {
    return {
      policyVersion: this.CURRENT_POLICY_VERSION,
      disclosureText:
        'All token purchases and membership fees are non-refundable. ' +
        'By completing this purchase you acknowledge and accept this policy.',
      guestId,
      transactionRef,
    };
  }

  /**
   * Records a guest's explicit acknowledgment of the refund policy and
   * publishes a REFUND_POLICY_ACKNOWLEDGED event to NATS.
   *
   * The caller must supply a SHA-256-hashed ipAddress — raw IPs must never
   * reach this method.
   */
  createAcknowledgment(
    data: Omit<RefundPolicyAcknowledgmentEvent, 'type' | 'acknowledgedAt'>,
  ): RefundPolicyAcknowledgmentEvent {
    const event: RefundPolicyAcknowledgmentEvent = {
      type: 'REFUND_POLICY_ACKNOWLEDGED',
      ...data,
      acknowledgedAt: new Date(),
    };

    this.nats.publish(NATS_TOPICS.REFUND_POLICY_ACKNOWLEDGED, {
      ...event,
      acknowledgedAt: event.acknowledgedAt.toISOString(),
    });

    this.logger.log('RefundDisclosureService: acknowledgment recorded', {
      guestId: data.guestId,
      transactionRef: data.transactionRef,
      policyVersion: data.policyVersion,
      rule_applied_id: RULE_ID,
    });

    return event;
  }
}
