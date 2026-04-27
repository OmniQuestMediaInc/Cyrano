// Cyrano Layer 2 — auth/session DTOs
// Phase 0 scaffolding for the standalone role-play platform at
// apps/cyrano-standalone/. Surface contract for the gate that enforces
// "OmniPass+ or Diamond" tier access on the standalone runtime.
//
// "OmniPass+" is the pass-product name for the VIP_PLATINUM membership tier
// (see services/core-api/src/config/governance.config.ts MEMBERSHIP.TIERS
// comment). Spec: VIP_PLATINUM and VIP_DIAMOND only.

import type { ZoneAccessTier } from '../config/governance.config';

/** Tiers accepted by the Cyrano Layer 2 gate. Tuple-typed for narrow inference. */
export const CYRANO_LAYER2_ALLOWED_TIERS = ['VIP_PLATINUM', 'VIP_DIAMOND'] as const;

/** Compile-time check that every allowed tier is a valid ZoneAccessTier. */
export type CyranoLayer2Tier = (typeof CYRANO_LAYER2_ALLOWED_TIERS)[number];
const _assertCyranoTiersAreZoneTiers: readonly ZoneAccessTier[] = CYRANO_LAYER2_ALLOWED_TIERS;
void _assertCyranoTiersAreZoneTiers;

/** Display labels for the two accepted pass products. */
export const CYRANO_LAYER2_TIER_DISPLAY: Record<CyranoLayer2Tier, string> = {
  VIP_PLATINUM: 'OmniPass+',
  VIP_DIAMOND: 'Diamond',
};

/**
 * Content mode for the Cyrano Layer 2 narrative engine.
 * 'adult' is the default surface today. 'narrative' is the non-adult skin
 * the platform must support without engine changes (see spec §7).
 */
export type CyranoLayer2ContentMode = 'adult' | 'narrative';

export interface EstablishCyranoLayer2SessionInput {
  /** Authenticated platform user_id (resolved from the request, never trusted from body). */
  user_id: string;
  organization_id: string;
  tenant_id: string;
  /** Optional content_mode hint from the standalone app; defaults to 'adult'. */
  content_mode?: CyranoLayer2ContentMode;
  /** Optional correlation_id propagated from the upstream request for trace linking. */
  correlation_id?: string;
}

export interface CyranoLayer2SessionGranted {
  result: 'GRANTED';
  session_id: string;
  user_id: string;
  resolved_tier: CyranoLayer2Tier;
  tier_display: string;
  content_mode: CyranoLayer2ContentMode;
  /** ISO-8601 UTC. The standalone app should re-establish on/after this. */
  expires_at_utc: string;
  correlation_id: string;
  reason_code: 'TIER_AUTHORIZED';
  rule_applied_id: string;
}

export interface CyranoLayer2SessionDenied {
  result: 'DENIED';
  user_id: string;
  resolved_tier: ZoneAccessTier;
  correlation_id: string;
  reason_code: 'TIER_INSUFFICIENT' | 'NO_USER_CONTEXT';
  rule_applied_id: string;
}

export type CyranoLayer2SessionDecision =
  | CyranoLayer2SessionGranted
  | CyranoLayer2SessionDenied;

/** Canonical rule id for every Cyrano Layer 2 gate decision. */
export const CYRANO_LAYER2_RULE_APPLIED_ID = 'CYRANO_LAYER2_GATE_v1';

/** TTL for an established session before the standalone app must re-establish. */
export const CYRANO_LAYER2_SESSION_TTL_SECONDS = 60 * 60; // 1 hour
