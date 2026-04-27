// PAYLOAD 5 — Cyrano Layer 1 shared types
// Business Plan B.3.5 — whisper copilot contract surface.

import type { FfsScore, FfsTier } from '../../creator-control/src/ffs.engine';

/** The eight canonical suggestion categories from Business Plan B.3.5. */
export type CyranoCategory =
  | 'CAT_SESSION_OPEN'
  | 'CAT_ENGAGEMENT'
  | 'CAT_ESCALATION'
  | 'CAT_NARRATIVE'
  | 'CAT_CALLBACK'
  | 'CAT_RECOVERY'
  | 'CAT_MONETIZATION'
  | 'CAT_SESSION_CLOSE';

export const CYRANO_CATEGORIES: readonly CyranoCategory[] = [
  'CAT_SESSION_OPEN',
  'CAT_ENGAGEMENT',
  'CAT_ESCALATION',
  'CAT_NARRATIVE',
  'CAT_CALLBACK',
  'CAT_RECOVERY',
  'CAT_MONETIZATION',
  'CAT_SESSION_CLOSE',
] as const;

/** Conversation lifecycle phase detected from session telemetry. */
export type SessionPhase = 'OPENING' | 'MID' | 'PEAK' | 'COOLDOWN' | 'CLOSING';

/** One durable fact Cyrano has observed about the guest. */
export interface MemoryFact {
  id: string;
  key: string;                    // e.g. 'guest.preferred_pronoun'
  value: string;                  // e.g. 'they/them'
  confidence: number;             // 0..1
  learned_at_utc: string;
}

/** A persona a creator can activate for a given session. */
export interface CreatorPersona {
  persona_id: string;
  creator_id: string;
  display_name: string;
  tone: string;                   // e.g. 'playful_dominant'
  style_notes: string;
  active: boolean;
}

/**
 * Domain for non-adult Cyrano prompt template routing.
 * Mirrors SenSyncDomain — kept as a local alias to avoid cross-service imports.
 */
export type CyranoDomain =
  | 'ADULT_ENTERTAINMENT'
  | 'TEACHING'
  | 'COACHING'
  | 'FIRST_RESPONDER'
  | 'FACTORY_SAFETY'
  | 'MEDICAL';

/** Telemetry frame Cyrano evaluates to produce suggestions. */
export interface CyranoInputFrame {
  session_id: string;
  creator_id: string;
  guest_id: string;
  phase: SessionPhase;
  heat: FfsScore;
  /** Seconds since the last guest message. */
  silence_seconds: number;
  /** Minutes since session start. */
  dwell_minutes: number;
  /** Whether the guest has tipped this session. */
  guest_has_tipped: boolean;
  /** Latest guest message (may be empty). */
  latest_guest_message: string;
  /** ISO-8601 UTC capture timestamp for determinism. */
  captured_at_utc: string;

  // ── Layer 1 hardening: FFS + SenSync extension fields ─────────────────────
  /**
   * FairPlay/FairPay Score at the time of the frame (0..100).
   * Sourced from the latest ffs.score.update NATS event for this creator.
   * Optional — absent when FFS data is unavailable or not yet emitted.
   */
  ffs_score?: number;
  /**
   * Normalized BPM from the guest's SenSync session (30..220).
   * Only present when the guest has an active SenSync consent.
   */
  sensync_bpm?: number;
  /**
   * Whether the guest currently has an active, non-revoked SenSync consent.
   * False or absent = SenSync data must not influence suggestions.
   */
  sensync_consent_active?: boolean;
  /**
   * Domain for prompt template routing (defaults to ADULT_ENTERTAINMENT).
   * Non-adult domains suppress adult escalation/monetization categories.
   */
  domain?: CyranoDomain;
}

/** A single whisper suggestion. Invisible to the guest. */
export interface CyranoSuggestion {
  suggestion_id: string;
  session_id: string;
  creator_id: string;
  guest_id: string;
  category: CyranoCategory;
  /** 0..100 priority score — higher = more urgent. */
  weight: number;
  tier_context: FfsTier;
  copy: string;
  reason_codes: string[];
  persona_id: string | null;
  /** Latency from input frame to emit, in milliseconds. */
  latency_ms: number;
  emitted_at_utc: string;
  rule_applied_id: string;
  /** FFS score carried through for downstream analytics. */
  ffs_score?: number;
  /** SenSync BPM at the time of suggestion (if consent active). */
  sensync_bpm?: number;
  /** Domain for prompt template routing. */
  domain?: CyranoDomain;
}

export interface CyranoDropReason {
  session_id: string;
  creator_id: string;
  category: CyranoCategory | 'UNKNOWN';
  reason_code: 'LATENCY_EXCEEDED' | 'NO_CATEGORY_MATCH' | 'PERSONA_INACTIVE' | 'DOMAIN_BLOCKED';
  latency_ms: number;
  rule_applied_id: string;
}
