// HZ: SenSync™ biometric layer — shared types
// Business Plan §HZ — Diamond-tier biometric BPM pipeline with full consent
// lifecycle, Quebec Law 25 / PIPEDA / GDPR compliance, and non-adult
// extension points (teaching, coaching, first-responder, factory safety, medical).
//
// Contract:
//   • Accepts raw BPM samples from Lovense SDK, generic WebUSB, or WebBluetooth.
//   • Diamond-tier only for hardware features; lower tiers receive TIER_DISABLED.
//   • Consent is persisted to Postgres (SenSyncConsent) — not in-memory only.
//   • Normalized BPM is published to NATS sensync.biometric.data for FFS scoring.
//   • Purge on deletion request satisfies Law 25 §28 / GDPR Art 17.

/** Domains that SenSync™ serves (adult vs non-adult verticals). */
export type SenSyncDomain =
  | 'ADULT_ENTERTAINMENT'
  | 'TEACHING'
  | 'COACHING'
  | 'FIRST_RESPONDER'
  | 'FACTORY_SAFETY'
  | 'MEDICAL';

/** Hardware bridge backends. */
export type SenSyncHardwareBridge =
  | 'LOVENSE'        // Lovense SDK
  | 'WEB_USB'        // Generic WebUSB device
  | 'WEB_BLUETOOTH'  // Generic Web Bluetooth / GATT 0x180D
  | 'PHONE_HAPTIC';  // Mobile fallback (no hardware BPM; phone only)

/** Membership tiers (canonical six-value enum per DOMAIN_GLOSSARY.md). */
export type MembershipTier =
  | 'GUEST'
  | 'VIP'
  | 'VIP_SILVER'
  | 'VIP_GOLD'
  | 'VIP_PLATINUM'
  | 'VIP_DIAMOND';

/** Consent basis codes — Law 25 / GDPR / PIPEDA. */
export type SenSyncConsentBasis =
  | 'EXPLICIT_OPT_IN'  // guest explicitly accepted via one-tap UI
  | 'PARTIALLY_REVOKED' // at least one scope revoked but at least one remains
  | 'REVOKED';         // guest withdrew consent (all scopes)

/**
 * Phase 5.3 — granular consent scopes.
 *
 * `BPM_TO_FFS`     — feed normalised BPM into FFS scoring (heart-rate component
 *                    + +10–25 quality boost).
 * `BPM_TO_HAPTIC`  — relay BPM into the partner's haptic device.
 * `BPM_TO_CYRANO`  — surface BPM as a Cyrano™ prompt-template signal.
 * `BPM_TO_PARTNER` — share BPM number with the broadcast partner UI.
 *
 * The default consent grant covers all four scopes; the guest may revoke any
 * single scope without revoking the others.
 */
export type SenSyncConsentScope =
  | 'BPM_TO_FFS'
  | 'BPM_TO_HAPTIC'
  | 'BPM_TO_CYRANO'
  | 'BPM_TO_PARTNER';

export const SENSYNC_DEFAULT_CONSENT_SCOPES: readonly SenSyncConsentScope[] = [
  'BPM_TO_FFS',
  'BPM_TO_HAPTIC',
  'BPM_TO_CYRANO',
  'BPM_TO_PARTNER',
] as const;

/** Phase 5.3 — default ephemerality TTL: 24 hours from grant. */
export const SENSYNC_DEFAULT_CONSENT_TTL_SECONDS = 24 * 60 * 60;
/** Phase 5.3 — minimum allowed TTL: 60 seconds. */
export const SENSYNC_MIN_CONSENT_TTL_SECONDS = 60;
/** Phase 5.3 — maximum allowed TTL: 7 days (Law 25 spirit-of-minimization). */
export const SENSYNC_MAX_CONSENT_TTL_SECONDS = 7 * 24 * 60 * 60;

/** A single raw BPM sample from a hardware bridge. */
export interface SenSyncSample {
  sample_id: string;
  session_id: string;
  creator_id: string;
  guest_id: string;
  /** Hardware bridge that supplied this sample. */
  bridge: SenSyncHardwareBridge;
  bpm_raw: number;
  /** Millisecond epoch timestamp from the device clock. */
  captured_device_ms: number;
  /** Server-side ISO-8601 UTC receipt timestamp. */
  received_at_utc: string;
  tier: MembershipTier;
  domain: SenSyncDomain;
}

/** A BPM sample that has passed the plausibility filter. */
export interface SenSyncValidSample extends SenSyncSample {
  /** Plausibility-passed BPM; same value as raw, confirmed in [30..220]. */
  bpm_normalized: number;
}

/**
 * NATS payload published to sensync.biometric.data.
 * Consumed by FFS scoring (opt-in only).
 */
export interface SenSyncBiometricPayload {
  event_id: string;
  session_id: string;
  creator_id: string;
  guest_id: string;
  bpm_normalized: number;
  bridge: SenSyncHardwareBridge;
  domain: SenSyncDomain;
  consent_version: string;
  /** Phase 5.3 — scopes that authorise downstream consumers. */
  consent_scopes: SenSyncConsentScope[];
  /**
   * Phase 3 — FFS integration. Composite quality score in [0,1] derived from
   * adapter `sample_quality_1m`. FFS multiplies this by SENSYNC_FFS_BOOST_RANGE
   * to add 10–25 bonus points to the composite score (heart_rate component is
   * separate and unrelated).
   */
  quality_score: number;
  /** Phase 3 — explicit precomputed bonus in [10..25]. */
  quality_boost_points: number;
  emitted_at_utc: string;
  rule_applied_id: string;
}

/**
 * Phase 3 — FFS BPM-update event published to `sensync.bpm.update`.
 * The FFS service subscribes to this topic to fold the live BPM into its
 * input frame. The shape is intentionally narrower than
 * `SenSyncBiometricPayload` — no scopes, no quality numbers — because FFS only
 * needs the BPM and session identity. Scopes are enforced at the publish gate
 * (the service refuses to publish here unless `BPM_TO_FFS` is active).
 */
export interface SenSyncBpmUpdatePayload {
  session_id: string;
  creator_id: string;
  guest_id: string;
  bpm: number;
  bridge: SenSyncHardwareBridge;
  consent_version: string;
  emitted_at_utc: string;
  rule_applied_id: string;
}

/**
 * Phase 5.3 — audit log emission shape.
 * Consumed by the platform ImmutableAuditService through NATS.
 */
export interface SenSyncAuditEvent {
  audit_id: string;
  event_type:
    | 'CONSENT_GRANTED'
    | 'CONSENT_REVOKED'
    | 'CONSENT_SCOPE_REVOKED'
    | 'CONSENT_EXPIRED'
    | 'PURGE_REQUESTED'
    | 'PURGE_COMPLETED';
  session_id?: string;
  guest_id: string;
  creator_id?: string;
  scope?: SenSyncConsentScope;
  domain: SenSyncDomain;
  correlation_id: string;
  reason_code: string;
  occurred_at_utc: string;
  rule_applied_id: string;
}

/**
 * Phase 3 — FFS boost range. The FFS service consumes
 * `quality_boost_points ∈ [SENSYNC_FFS_BOOST_MIN..SENSYNC_FFS_BOOST_MAX]`
 * directly without further scaling.
 */
export const SENSYNC_FFS_BOOST_MIN = 10;
export const SENSYNC_FFS_BOOST_MAX = 25;

/** Persisted consent record (mirrors the SenSyncConsent Prisma model). */
export interface SenSyncConsentRecord {
  consent_id: string;
  session_id: string;
  creator_id: string;
  guest_id: string;
  consent_version: string;
  basis: SenSyncConsentBasis;
  consent_granted_at: string;
  consent_revoked_at?: string;
  /** Phase 5.3 — granular scopes still active on this row. */
  consent_scopes: SenSyncConsentScope[];
  /** Phase 5.3 — UTC timestamp at which the row auto-expires (ephemerality). */
  consent_expires_at?: string;
  ip_hash?: string;             // SHA-256 of guest IP — never raw IP
  device_fingerprint?: string;
  domain: SenSyncDomain;
  correlation_id: string;
  reason_code: string;
  rule_applied_id: string;
}

/** Plausibility rejection audit record. */
export interface SenSyncPlausibilityRejection {
  rejection_id: string;
  session_id: string;
  guest_id: string;
  bpm_raw: number;
  reason_code: 'BPM_BELOW_MIN' | 'BPM_ABOVE_MAX';
  rejected_at_utc: string;
  rule_applied_id: string;
}

/** Tier-disabled audit record — emitted when a non-Diamond tier requests hardware. */
export interface SenSyncTierDisabledEvent {
  event_id: string;
  session_id: string;
  guest_id: string;
  tier: MembershipTier;
  reason_code: 'TIER_SENSYNC_HARDWARE_DISABLED';
  occurred_at_utc: string;
  rule_applied_id: string;
}

/** Law 25 / GDPR deletion purge request. */
export interface SenSyncPurgeRequest {
  purge_id: string;
  guest_id: string;
  requested_by: string;          // actor_id initiating the purge
  requested_at_utc: string;
  correlation_id: string;
  reason_code: string;
  rule_applied_id: string;
}

/** Purge completion confirmation. */
export interface SenSyncPurgeCompleted {
  purge_id: string;
  guest_id: string;
  rows_affected: number;
  completed_at_utc: string;
  rule_applied_id: string;
}

/** Hardware connection lifecycle event. */
export interface SenSyncHardwareEvent {
  event_id: string;
  session_id: string;
  creator_id: string;
  guest_id: string;
  bridge: SenSyncHardwareBridge;
  event_type: 'CONNECTED' | 'DISCONNECTED';
  occurred_at_utc: string;
  rule_applied_id: string;
}

/** Ephemeral in-session state (cleared on closeSession). */
export interface SenSyncSessionState {
  session_id: string;
  creator_id: string;
  guest_id: string;
  tier: MembershipTier;
  domain: SenSyncDomain;
  bridge: SenSyncHardwareBridge;
  consent_granted: boolean;
  /** Phase 5.3 — set of scopes active for the current consent. */
  consent_scopes: Set<SenSyncConsentScope>;
  /** Phase 5.3 — UTC ms epoch at which the consent expires (ephemerality). */
  consent_expires_at_ms?: number;
  last_bpm?: number;
  last_sample_at_utc?: string;
}

/** BPM plausibility bounds — governance constant. */
export const SENSYNC_BPM_MIN = 30;
export const SENSYNC_BPM_MAX = 220;

/** Tiers permitted to use hardware biometric features. */
export const SENSYNC_HARDWARE_TIERS: readonly MembershipTier[] = [
  'VIP_DIAMOND',
] as const;

/** Current consent version string (bumped when consent language changes). */
export const SENSYNC_CONSENT_VERSION = 'SENSYNC_CONSENT_v1';

export const SENSYNC_RULE_ID = 'SENSYNC_v1';
