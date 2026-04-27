// services/core-api/src/refund/extension.service.ts
// CS Extension surface — expiry extension, goodwill credit, service-to-sale
// trigger, and friendly-fraud / guest-risk-profile assessment.
//
// Authority model:
//   TIER_2 agents may grant up to TIER_2_MAX_EXTENSION_DAYS days extension
//   and up to TIER_2_MAX_GOODWILL_CZT CZT goodwill credit without review.
//   TIER_3 agents may grant up to TIER_3_MAX_EXTENSION_DAYS days and
//   TIER_3_MAX_GOODWILL_CZT CZT.  Actions that breach CEO_REVIEW thresholds
//   are recorded with ceoReviewFlagged = true and require human sign-off
//   before the actual credit or extension is applied downstream.
//
// Doctrine:
//   - All extension records are append-only (no update after creation).
//   - ServiceToSaleTrigger is published on every successful extension action.
//   - FriendlyFraudSignal is published whenever a non-empty trigger list is
//     scored above FRAUD_THRESHOLDS.MONITOR.

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NatsService } from '../nats/nats.service';
import { NATS_TOPICS } from '../../../nats/topics.registry';
import {
  ExtensionAuthority,
  ExtensionRequest,
  ExtensionActionRecord,
  ServiceToSaleTrigger,
  FriendlyFraudSignal,
  GuestRiskProfile,
} from './refund-disclosure.types';
import { RECOVERY_ENGINE } from '../config/governance.config';

const RULE_ID = 'EXTENSION_SERVICE_v1';

/**
 * Authority thresholds — revisions require a GOV: commit + CEO sign-off.
 * EXTENSION_GRANT_DAYS ceiling is derived from the RECOVERY_ENGINE constant
 * so that the two surfaces stay aligned.
 */
export const EXTENSION_LIMITS = {
  TIER_2_MAX_EXTENSION_DAYS: Math.floor(RECOVERY_ENGINE.EXTENSION_GRANT_DAYS / 2),
  TIER_2_MAX_GOODWILL_CZT:   50,
  TIER_3_MAX_EXTENSION_DAYS: RECOVERY_ENGINE.EXTENSION_GRANT_DAYS,
  TIER_3_MAX_GOODWILL_CZT:   500,

  // Actions above these values are flagged for CEO review regardless of tier.
  CEO_REVIEW_GOODWILL_CZT_THRESHOLD:       100,
  CEO_REVIEW_EXTENSION_DAYS_THRESHOLD:     RECOVERY_ENGINE.EXTENSION_GRANT_DAYS,
} as const;

/**
 * Friendly-fraud score → recommendation band mapping.
 * Revisions require a GOV: commit.
 */
export const FRAUD_THRESHOLDS = {
  MONITOR:            25,
  BLOCK_HIGH_VALUE:   50,
  FLAG_HCZ:           75,
  CRITICAL:           90,
} as const;

@Injectable()
export class ExtensionService {
  private readonly logger = new Logger(ExtensionService.name);

  constructor(private readonly nats: NatsService) {}

  // ── Extension action processing ──────────────────────────────────────────

  /**
   * Validates the agent's tier authority, records the extension action, and
   * publishes both an EXTENSION_EXECUTED event and a SERVICE_TO_SALE trigger.
   *
   * Throws if the request is structurally invalid (missing required field for
   * the chosen action, or value exceeds the agent tier's hard ceiling). Actions
   * above CEO_REVIEW thresholds are recorded but flagged — the downstream
   * credit/extension must not be applied until a human clears the flag.
   */
  processExtension(request: ExtensionRequest): ExtensionActionRecord {
    this.validateRequest(request);

    const ceoReviewFlagged = this.requiresCeoReview(request);
    const record: ExtensionActionRecord = {
      actionId: randomUUID(),
      guestId: request.guestId,
      agentId: request.agentId,
      agentTier: request.agentTier,
      action: request.action,
      expiryExtensionDays: request.expiryExtensionDays ?? null,
      goodwillCreditCZT: request.goodwillCreditCZT ?? null,
      interactionRef: request.interactionRef,
      reason: request.reason,
      executedAt: new Date(),
      ceoReviewFlagged,
    };

    this.nats.publish(NATS_TOPICS.REFUND_EXTENSION_EXECUTED, {
      ...record,
      executedAt: record.executedAt.toISOString(),
      rule_applied_id: RULE_ID,
    });

    const trigger: ServiceToSaleTrigger = {
      type: 'SERVICE_TO_SALE',
      guestId: request.guestId,
      triggerReason: request.action,
      agentId: request.agentId,
      interactionRef: request.interactionRef,
      triggeredAt: record.executedAt,
    };

    this.nats.publish(NATS_TOPICS.SERVICE_TO_SALE_TRIGGERED, {
      ...trigger,
      triggeredAt: trigger.triggeredAt.toISOString(),
      rule_applied_id: RULE_ID,
    });

    this.logger.log('ExtensionService: extension action recorded', {
      actionId: record.actionId,
      guestId: record.guestId,
      agentId: record.agentId,
      action: record.action,
      ceoReviewFlagged,
      rule_applied_id: RULE_ID,
    });

    return record;
  }

  // ── Friendly fraud signal evaluation ─────────────────────────────────────

  /**
   * Scores a set of fraud triggers for a guest and emits a
   * FRIENDLY_FRAUD_SIGNAL_RAISED event when the score exceeds MONITOR.
   *
   * Each trigger contributes equally. The score is the ratio of active
   * triggers to the total trigger set, mapped to the 0–100 band.
   * Callers should pass all known signal strings; the scorer weights presence,
   * not severity of individual triggers.
   */
  evaluateFriendlyFraudSignal(
    guestId: string,
    triggers: string[],
  ): FriendlyFraudSignal {
    const uniqueTriggers = [...new Set(triggers)];
    const score = uniqueTriggers.length === 0
      ? 0
      : Math.min(100, Math.round((uniqueTriggers.length / 10) * 100));

    const recommendation = this.resolveRecommendation(score);

    const signal: FriendlyFraudSignal = {
      type: 'FRIENDLY_FRAUD_SIGNAL',
      guestId,
      score,
      triggers: uniqueTriggers,
      detectedAt: new Date(),
      recommendation,
    };

    if (score >= FRAUD_THRESHOLDS.MONITOR) {
      this.nats.publish(NATS_TOPICS.FRIENDLY_FRAUD_SIGNAL_RAISED, {
        ...signal,
        detectedAt: signal.detectedAt.toISOString(),
        rule_applied_id: RULE_ID,
      });

      this.logger.warn('ExtensionService: friendly-fraud signal raised', {
        guestId,
        score,
        recommendation,
        rule_applied_id: RULE_ID,
      });
    }

    return signal;
  }

  // ── Guest risk profile ────────────────────────────────────────────────────

  /**
   * Derives a deterministic GuestRiskProfile from a numeric risk score and
   * the caller-supplied list of active signal strings.
   *
   * Tier and recommended action are fully determined by riskScore — the
   * activeSignals list is carried through for display and audit purposes only.
   */
  buildGuestRiskProfile(
    guestId: string,
    riskScore: number,
    activeSignals: string[],
  ): GuestRiskProfile {
    const clamped = Math.max(0, Math.min(100, riskScore));
    const { tier, recommendedAction } = this.resolveRiskTier(clamped);

    return {
      guestId,
      riskScore: clamped,
      tier,
      lastUpdated: new Date(),
      activeSignals: [...activeSignals],
      recommendedAction,
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private validateRequest(request: ExtensionRequest): void {
    const { agentTier, action } = request;

    if (action === 'EXPIRY_EXTENSION') {
      const days = request.expiryExtensionDays;
      if (days === undefined || days <= 0) {
        throw new Error(
          'EXTENSION_INVALID: expiryExtensionDays must be a positive integer for EXPIRY_EXTENSION',
        );
      }
      const maxDays =
        agentTier === ExtensionAuthority.TIER_3
          ? EXTENSION_LIMITS.TIER_3_MAX_EXTENSION_DAYS
          : EXTENSION_LIMITS.TIER_2_MAX_EXTENSION_DAYS;
      if (days > maxDays) {
        throw new Error(
          `EXTENSION_AUTHORITY_EXCEEDED: ${agentTier} may not grant more than ${maxDays} days extension`,
        );
      }
    }

    if (action === 'GOODWILL_CREDIT') {
      const czt = request.goodwillCreditCZT;
      if (czt === undefined || czt <= 0) {
        throw new Error(
          'EXTENSION_INVALID: goodwillCreditCZT must be a positive number for GOODWILL_CREDIT',
        );
      }
      const maxCzt =
        agentTier === ExtensionAuthority.TIER_3
          ? EXTENSION_LIMITS.TIER_3_MAX_GOODWILL_CZT
          : EXTENSION_LIMITS.TIER_2_MAX_GOODWILL_CZT;
      if (czt > maxCzt) {
        throw new Error(
          `EXTENSION_AUTHORITY_EXCEEDED: ${agentTier} may not grant more than ${maxCzt} CZT goodwill credit`,
        );
      }
    }
  }

  private requiresCeoReview(request: ExtensionRequest): boolean {
    if (
      request.action === 'GOODWILL_CREDIT' &&
      (request.goodwillCreditCZT ?? 0) > EXTENSION_LIMITS.CEO_REVIEW_GOODWILL_CZT_THRESHOLD
    ) {
      return true;
    }
    if (
      request.action === 'EXPIRY_EXTENSION' &&
      (request.expiryExtensionDays ?? 0) >= EXTENSION_LIMITS.CEO_REVIEW_EXTENSION_DAYS_THRESHOLD
    ) {
      return true;
    }
    return false;
  }

  private resolveRecommendation(
    score: number,
  ): FriendlyFraudSignal['recommendation'] {
    if (score >= FRAUD_THRESHOLDS.CRITICAL) return 'CRITICAL';
    if (score >= FRAUD_THRESHOLDS.FLAG_HCZ) return 'FLAG_HCZ';
    if (score >= FRAUD_THRESHOLDS.BLOCK_HIGH_VALUE) return 'BLOCK_HIGH_VALUE_PURCHASES';
    return 'MONITOR';
  }

  private resolveRiskTier(
    score: number,
  ): { tier: GuestRiskProfile['tier']; recommendedAction: GuestRiskProfile['recommendedAction'] } {
    if (score >= FRAUD_THRESHOLDS.FLAG_HCZ) {
      return { tier: 'RED', recommendedAction: 'BLOCK' };
    }
    if (score >= FRAUD_THRESHOLDS.BLOCK_HIGH_VALUE) {
      return { tier: 'ORANGE', recommendedAction: 'REVIEW' };
    }
    if (score >= FRAUD_THRESHOLDS.MONITOR) {
      return { tier: 'YELLOW', recommendedAction: 'LIMITED' };
    }
    return { tier: 'GREEN', recommendedAction: 'ALLOW' };
  }
}
