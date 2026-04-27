// PAYLOAD 5+ — Cyrano Layer 4 enterprise contract surface
// Phase 3.11 + Layer 4 v1 — DTOs, error codes, and rule ids for the
// multi-tenant Whisper API. The Layer 4 controller, guard, services, and
// audit emitters all consume these types so the surface stays canonical.
//
// Canonical Corpus invariants honoured here:
//   • Append-only ledger (every API decision is hashed into the immutable
//     audit chain via cyrano-layer4-audit.service.ts).
//   • Every DB write carries correlation_id + reason_code.
//   • Real-time fabric is NATS-only; HTTP responses never replace events.
//   • DFSP™ security: API key hashes (never raw keys) leave the service.

import type { CyranoCategory, CyranoDomain } from './cyrano.types';
import type { CyranoTier } from './cyrano-prompt-templates';

/** Canonical rule id — every Layer 4 audit event carries this id. */
export const CYRANO_LAYER4_RULE_ID = 'CYRANO_LAYER_4_ENTERPRISE_v1';

/** SOC 2 / HIPAA-bearing compliance regimes a tenant may enrol in. */
export type CyranoLayer4ComplianceRegime =
  | 'SOC2'
  | 'HIPAA'
  | 'PIPEDA'
  | 'GDPR'
  | 'NONE';

/**
 * Content_mode flag isolates adult vs non-adult templates at the Layer 4
 * surface.  An ADULT_ENTERTAINMENT tenant is the only one allowed to use
 * `adult` mode; every other domain MUST resolve `non_adult` templates.
 */
export type CyranoLayer4ContentMode = 'adult' | 'non_adult';

/** Persisted shape of a Layer 4 enterprise tenant. */
export interface CyranoLayer4Tenant {
  tenant_id: string;
  display_name: string;
  domain: CyranoDomain;
  /** ISO-3166 two-letter country code (residency / sovereign-CAC routing). */
  country_code: string;
  /** Whether the tenant has signed the BAA / DPA / MSA package. */
  baa_signed: boolean;
  /** Compliance regime that gates which features the tenant may exercise. */
  compliance_regime: CyranoLayer4ComplianceRegime;
  /** Default content_mode. Adult tenants only. */
  content_mode: CyranoLayer4ContentMode;
  /** Per-second rate-limit ceiling applied to all keys for this tenant. */
  rate_limit_per_minute: number;
  /** Whether voice output is contractually allowed for this tenant. */
  voice_enabled: boolean;
  /** ISO-8601 UTC tenant creation timestamp. */
  created_at_utc: string;
  /** ISO-8601 UTC last-update timestamp. */
  updated_at_utc: string;
  /**
   * Audit shadow — correlation id of the tenant-create event in the
   * immutable audit ledger. Required for every persisted tenant row.
   */
  correlation_id: string;
  /** Reason code that materialised this tenant (e.g. ENTERPRISE_ONBOARDED). */
  reason_code: string;
  rule_applied_id: string;
}

/** Body accepted by `POST /cyrano/layer4/tenants`. */
export interface CyranoLayer4RegisterTenantRequest {
  tenant_id: string;
  display_name: string;
  domain: CyranoDomain;
  country_code: string;
  baa_signed?: boolean;
  compliance_regime?: CyranoLayer4ComplianceRegime;
  content_mode?: CyranoLayer4ContentMode;
  rate_limit_per_minute?: number;
  voice_enabled?: boolean;
  /** Optional correlation_id propagated from the upstream caller. */
  correlation_id?: string;
}

/** Body accepted by `POST /cyrano/layer4/prompt`. */
export interface CyranoLayer4PromptRequest {
  /**
   * Tenant id is also enforced via the auth guard / API key. The body field
   * is checked for equality so a stolen body cannot impersonate.
   */
  tenant_id: string;
  session_id: string;
  category: CyranoCategory;
  tier: CyranoTier;
  /** Persona tone override; defaults to `enterprise_neutral`. */
  tone?: string;
  /**
   * Optional content_mode override. The enterprise service rejects any
   * override that disagrees with the tenant's contractual content_mode.
   */
  content_mode?: CyranoLayer4ContentMode;
  /** Optional voice request — see voice bridge. */
  voice?: { enabled: boolean; voice_id?: string; locale?: string };
  /** Caller-provided correlation_id; generated if absent. */
  correlation_id?: string;
  /** Caller-provided consent receipt id (HIPAA / GDPR). */
  consent_receipt_id?: string;
  /**
   * Optional BCP-47 locale code for real-time text translation (Issue #15).
   * When present and the locale differs from the canonical en-US baseline,
   * the translation layer will populate `translated_copy` on the response.
   * Example: "fr-FR", "es-ES", "de-DE".
   */
  target_locale?: string;
}

/** Layer 4 prompt response envelope. */
export interface CyranoLayer4PromptResponse {
  request_id: string;
  tenant_id: string;
  domain: CyranoDomain;
  category: CyranoCategory;
  tier: CyranoTier;
  content_mode: CyranoLayer4ContentMode;
  copy: string;
  blocked: boolean;
  reason_code: CyranoLayer4ReasonCode;
  rule_applied_id: string;
  /** Voice synthesis envelope (voice_uri populated when synthesis succeeded). */
  voice?: CyranoLayer4VoiceEnvelope | null;
  /** Translation envelope — populated when target_locale was requested. */
  translation?: CyranoLayer4TranslationEnvelope | null;
  correlation_id: string;
  emitted_at_utc: string;
}

/** Translation envelope returned alongside a prompt response (Issue #15). */
export interface CyranoLayer4TranslationEnvelope {
  /** BCP-47 source locale (always en-US for Cyrano's baseline templates). */
  source_locale: string;
  /** BCP-47 target locale requested by the caller. */
  target_locale: string;
  /** Translated copy — empty string when translation was skipped. */
  translated_copy: string;
  /** Reason translation was skipped, when applicable. */
  skipped_reason_code?: CyranoLayer4TranslationSkipReason;
  rule_applied_id: string;
}

/** Voice envelope returned alongside a prompt response. */
export interface CyranoLayer4VoiceEnvelope {
  voice_id: string;
  locale: string;
  /** URI of the synthesised audio object — empty when synthesis was skipped. */
  voice_uri: string;
  /** Reason synthesis was skipped, when applicable. */
  skipped_reason_code?: CyranoLayer4ReasonCode;
  rule_applied_id: string;
}

/** Reason codes for translation skips (Issue #15). */
export type CyranoLayer4TranslationSkipReason =
  | 'TRANSLATION_LOCALE_SAME_AS_SOURCE'
  | 'TRANSLATION_LOCALE_NOT_SUPPORTED'
  | 'TRANSLATION_DISABLED_BY_TENANT'
  | 'TRANSLATION_INPUT_EMPTY';

/** Closed enum of every Layer 4 reason code emitted on success or refusal. */
export type CyranoLayer4ReasonCode =
  | 'TENANT_AUTHORIZED'
  | 'TENANT_NOT_FOUND'
  | 'TENANT_DISABLED'
  | 'API_KEY_MISSING'
  | 'API_KEY_INVALID'
  | 'API_KEY_REVOKED'
  | 'TENANT_MISMATCH'
  | 'BAA_NOT_SIGNED'
  | 'TEMPLATE_UNAVAILABLE'
  | 'CONTENT_MODE_FORBIDDEN'
  | 'CONTENT_MODE_MISMATCH'
  | 'RATE_LIMIT_EXCEEDED'
  | 'VOICE_NOT_PERMITTED'
  | 'VOICE_SYNTHESIS_FAILED'
  | 'VOICE_DISABLED_BY_REQUEST'
  | 'CONSENT_RECEIPT_MISSING'
  | 'PROMPT_OK';

/** Result envelope of an internal Layer 4 audit emission. */
export interface CyranoLayer4AuditRecord {
  audit_id: string;
  tenant_id: string;
  api_key_id: string | null;
  endpoint: string;
  reason_code: CyranoLayer4ReasonCode;
  outcome: 'ALLOW' | 'DENY';
  correlation_id: string;
  payload_hash: string;
  rule_applied_id: string;
  emitted_at_utc: string;
}

/** Hashed API key record. The plaintext key is returned ONCE on creation. */
export interface CyranoLayer4ApiKey {
  api_key_id: string;
  tenant_id: string;
  /** Argon2/bcrypt-style hash of the raw key. Raw key is never persisted. */
  key_hash: string;
  /** First eight characters of the raw key — safe to log/display. */
  key_prefix: string;
  /** Optional human label ("ops-prod-2026-04"). */
  label: string;
  active: boolean;
  /** ISO-8601 UTC. */
  created_at_utc: string;
  /** ISO-8601 UTC of last successful auth — null until first use. */
  last_used_at_utc: string | null;
  correlation_id: string;
  reason_code: string;
  rule_applied_id: string;
}

/** Returned exactly once on creation — caller must persist the raw key. */
export interface CyranoLayer4ApiKeyMint {
  api_key_id: string;
  tenant_id: string;
  raw_key: string;
  key_prefix: string;
  created_at_utc: string;
  rule_applied_id: string;
}

/** Headers expected by the Layer 4 guard. */
export const CYRANO_LAYER4_HEADERS = {
  TENANT: 'x-cyrano-tenant-id',
  API_KEY: 'x-cyrano-api-key',
  CORRELATION: 'x-correlation-id',
  CONSENT_RECEIPT: 'x-consent-receipt-id',
} as const;
