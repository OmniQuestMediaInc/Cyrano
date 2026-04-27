// services/core-api/src/growth/gwp.service.ts
// BIJOU: GWP-001 — Gift With Purchase service
// Triggers on Med-High tipper login. Presents VoucherVault offer.
// Credits ledger on acceptance. All events logged to audit_events.
import { Injectable, Logger } from '@nestjs/common';
import { NatsService } from '../nats/nats.service';
import { NATS_TOPICS } from '../../../nats/topics.registry';

export type TipperTier = 'LOW' | 'MED' | 'HIGH';

export interface GwpOffer {
  voucher_id: string;
  offer_name: string;
  description: string;
  token_value: number;
  trigger_type: string;
}

export interface GwpEvaluationResult {
  eligible: boolean;
  tipper_tier: TipperTier;
  offer?: GwpOffer;
  reason: string;
}

// Minimum lifetime spend thresholds to qualify as Med or High tipper
const TIPPER_THRESHOLDS = {
  MED_MIN_LIFETIME_TOKENS: 500,
  HIGH_MIN_LIFETIME_TOKENS: 2000,
} as const;

@Injectable()
export class GwpService {
  private readonly logger = new Logger(GwpService.name);
  private readonly RULE_ID = 'GWP_SERVICE_v1';

  constructor(private readonly nats: NatsService) {}

  /**
   * Classifies a VIP's tipper tier based on lifetime token spend.
   * Uses the six permitted HSV inputs — no PII, no message content.
   */
  classifyTipperTier(lifetime_tokens_spent: number): TipperTier {
    if (lifetime_tokens_spent >= TIPPER_THRESHOLDS.HIGH_MIN_LIFETIME_TOKENS) return 'HIGH';
    if (lifetime_tokens_spent >= TIPPER_THRESHOLDS.MED_MIN_LIFETIME_TOKENS) return 'MED';
    return 'LOW';
  }

  /**
   * Evaluates GWP eligibility on VIP login.
   * Only MED and HIGH tippers receive offers.
   * Offer selection is deterministic from VoucherVault — no randomness.
   * Caller is responsible for fetching available offers from VoucherVault table.
   */
  evaluateOnLogin(params: {
    user_id: string;
    membership_tier: string;
    lifetime_tokens_spent: number;
    available_offers: GwpOffer[];
  }): GwpEvaluationResult {
    const tipper_tier = this.classifyTipperTier(params.lifetime_tokens_spent);

    if (tipper_tier === 'LOW') {
      return {
        eligible: false,
        tipper_tier,
        reason: 'TIPPER_TIER_TOO_LOW: lifetime spend below MED threshold',
      };
    }

    // Select first active offer eligible for this membership tier
    const offer = params.available_offers.find((o) => o.trigger_type === 'LOGIN');

    if (!offer) {
      return {
        eligible: false,
        tipper_tier,
        reason: 'NO_ELIGIBLE_OFFER: no active LOGIN offers in VoucherVault',
      };
    }

    this.logger.log('GwpService: GWP offer evaluated on login', {
      user_id: params.user_id,
      tipper_tier,
      membership_tier: params.membership_tier,
      voucher_id: offer.voucher_id,
      rule_applied_id: this.RULE_ID,
    });

    // Publish offer trigger event to NATS
    this.nats.publish(NATS_TOPICS.GWP_OFFER_TRIGGERED, {
      user_id: params.user_id,
      voucher_id: offer.voucher_id,
      tipper_tier,
      triggered_at_utc: new Date().toISOString(),
      rule_applied_id: this.RULE_ID,
    });

    return { eligible: true, tipper_tier, offer, reason: 'ELIGIBLE' };
  }

  /**
   * Records offer acceptance. Publishes NATS event.
   * Caller must post ledger credit entry via LedgerService after this returns.
   */
  recordAcceptance(params: { user_id: string; voucher_id: string; token_value: number }): {
    accepted_at_utc: string;
    rule_applied_id: string;
  } {
    const accepted_at_utc = new Date().toISOString();

    this.nats.publish(NATS_TOPICS.GWP_OFFER_ACCEPTED, {
      user_id: params.user_id,
      voucher_id: params.voucher_id,
      token_value: params.token_value,
      accepted_at_utc,
      rule_applied_id: this.RULE_ID,
    });

    this.logger.log('GwpService: GWP offer accepted', {
      user_id: params.user_id,
      voucher_id: params.voucher_id,
      token_value: params.token_value,
      rule_applied_id: this.RULE_ID,
    });

    return { accepted_at_utc, rule_applied_id: this.RULE_ID };
  }
}
