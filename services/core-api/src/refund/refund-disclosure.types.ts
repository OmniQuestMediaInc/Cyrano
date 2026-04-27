// services/core-api/src/refund/refund-disclosure.types.ts
// Canonical types for the Refund Policy Disclosure + CS Extension surface.
// Business Plan: non-refundable policy acknowledgment, CS extension authority,
// service-to-sale triggers, and friendly-fraud risk profiling.

/**
 * CS agent authority tiers for extension actions.
 * TIER_2 agents have a narrower authority band; TIER_3 agents unlock higher
 * limits. Both tiers are subject to CEO-review flagging above set thresholds.
 */
export enum ExtensionAuthority {
  TIER_2 = 'TIER_2',
  TIER_3 = 'TIER_3',
}

/**
 * Discrete actions a CS agent may execute against a guest account.
 * EXPIRY_EXTENSION pushes the token-expiry horizon forward.
 * GOODWILL_CREDIT mints a CZT goodwill balance to the guest wallet.
 */
export type ExtensionAction = 'EXPIRY_EXTENSION' | 'GOODWILL_CREDIT';

/**
 * Compliance event emitted when a guest explicitly acknowledges the
 * non-refundable purchase policy. The ipAddress field must be SHA-256
 * hashed by the caller before passing to the service.
 */
export interface RefundPolicyAcknowledgmentEvent {
  type: 'REFUND_POLICY_ACKNOWLEDGED';
  guestId: string;
  transactionRef: string;
  policyVersion: string;
  acknowledgedAt: Date;
  sessionId: string;
  ipAddress: string; // SHA-256 hashed
}

/**
 * Input submitted by a CS agent requesting an extension action.
 * Either expiryExtensionDays (for EXPIRY_EXTENSION) or goodwillCreditCZT
 * (for GOODWILL_CREDIT) must be supplied to match the chosen action.
 */
export interface ExtensionRequest {
  guestId: string;
  agentId: string;
  agentTier: ExtensionAuthority;
  action: ExtensionAction;
  expiryExtensionDays?: number;
  goodwillCreditCZT?: number;
  interactionRef: string;
  reason: string;
}

/**
 * Append-only record of an executed extension action.
 * ceoReviewFlagged is set when the action exceeds the tier's authority band
 * and requires human sign-off before the credit is applied.
 */
export interface ExtensionActionRecord {
  actionId: string;
  guestId: string;
  agentId: string;
  agentTier: ExtensionAuthority;
  action: ExtensionAction;
  expiryExtensionDays: number | null;
  goodwillCreditCZT: number | null;
  interactionRef: string;
  reason: string;
  executedAt: Date;
  ceoReviewFlagged: boolean;
}

/**
 * NATS event emitted after every extension action to prompt the sales team
 * to follow up with an upsell conversation.
 */
export interface ServiceToSaleTrigger {
  type: 'SERVICE_TO_SALE';
  guestId: string;
  triggerReason: 'EXPIRY_EXTENSION' | 'GOODWILL_CREDIT';
  agentId: string;
  interactionRef: string;
  triggeredAt: Date;
}

/**
 * Fraud signal emitted when a guest's behaviour pattern indicates a
 * potential friendly-fraud attempt (purchase followed by refund demand).
 */
export interface FriendlyFraudSignal {
  type: 'FRIENDLY_FRAUD_SIGNAL';
  guestId: string;
  score: number;
  triggers: string[];
  detectedAt: Date;
  recommendation: 'FLAG_HCZ' | 'BLOCK_HIGH_VALUE_PURCHASES' | 'MONITOR' | 'CRITICAL';
}

/**
 * Composite risk profile for a guest, derived from fraud and welfare signals.
 */
export interface GuestRiskProfile {
  guestId: string;
  riskScore: number;
  tier: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';
  lastUpdated: Date;
  activeSignals: string[];
  recommendedAction: 'ALLOW' | 'LIMITED' | 'REVIEW' | 'BLOCK';
}
