// services/fraud-prevention/src/interfaces/shared.ts

export enum ExtensionAuthority {
  TIER_2 = 'TIER_2',
  TIER_3 = 'TIER_3',
}

export interface ExtensionRequest {
  guestId: string;
  agentId: string;
  agentTier: ExtensionAuthority;
  action: 'EXPIRY_EXTENSION' | 'GOODWILL_CREDIT';
  expiryExtensionDays?: number;
  goodwillCreditCZT?: number;
  interactionRef: string;
  reason: string;
}

export interface ExtensionActionRecord {
  actionId: string;
  guestId: string;
  agentId: string;
  agentTier: string;
  action: string;
  expiryExtensionDays: number | null;
  goodwillCreditCZT: number | null;
  interactionRef: string;
  reason: string;
  executedAt: Date;
  ceoReviewFlagged: boolean;
}

export interface RiskPrediction {
  riskScore: number;
  tier: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';
  confidence: number;
  modelVersion: string;
}

export interface RiskFeatures {
  friendlyFraudScore: number;
  chargebackCount30d: number;
  extensionAbuseCount: number;
  lowUsageAfterPurchase: number;
  rapidPurchaseVelocity: number;
  paymentDeclineRate: number;
  sessionActivityScore: number;
}
