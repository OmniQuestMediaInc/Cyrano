// PAYLOAD 5+ — Cyrano Layer 4 enterprise orchestrator service
// Phase 3.11 (Phase 0 of Layer 4 v1) — Layer 4 exposes domain-specific
// Cyrano flows to enterprise tenants (teaching, coaching, first-responder,
// factory-safety, medical) plus a contractual ADULT_ENTERTAINMENT lane.
// Tenants resolve to a domain at sign-up; every prompt request is routed
// through the shared template engine, the rate limiter, and the audit
// emitter so every emission carries correlation_id + reason_code.
//
// This service is the orchestration seam between the controller layer and
// the underlying capability services (tenant store, rate limiter, voice
// bridge, audit log). It owns NONE of the storage; it composes the
// behaviour described in CYRANO_LAYER_4_ENTERPRISE_v1.

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { NATS_TOPICS } from '../../nats/topics.registry';
import { CyranoLayer4AuditService } from './cyrano-layer4-audit.service';
import { CyranoLayer4RateLimiterService } from './cyrano-layer4-rate-limiter.service';
import { CyranoLayer4TenantStore } from './cyrano-layer4-tenant.store';
import { CyranoLayer4VoiceBridge } from './cyrano-layer4-voice.bridge';
import { resolveLayer4PromptTemplate } from './cyrano-prompt-templates';
import {
  CYRANO_LAYER4_RULE_ID,
  type CyranoLayer4ContentMode,
  type CyranoLayer4PromptRequest,
  type CyranoLayer4PromptResponse,
  type CyranoLayer4ReasonCode,
  type CyranoLayer4Tenant,
  type CyranoLayer4TranslationEnvelope,
  type CyranoLayer4VoiceEnvelope,
} from './cyrano-layer4.types';
import { CyranoTranslationService } from './cyrano-translation.service';

export { CYRANO_LAYER4_RULE_ID };

/** Internal request shape — controller injects api_key_id from the guard. */
export interface ResolvePromptInput extends CyranoLayer4PromptRequest {
  api_key_id?: string;
}

@Injectable()
export class CyranoLayer4EnterpriseService {
  private readonly logger = new Logger(CyranoLayer4EnterpriseService.name);

  constructor(
    private readonly nats: NatsService,
    private readonly tenantStore: CyranoLayer4TenantStore,
    private readonly rateLimiter: CyranoLayer4RateLimiterService,
    private readonly audit: CyranoLayer4AuditService,
    private readonly voice: CyranoLayer4VoiceBridge,
    private readonly translation: CyranoTranslationService,
  ) {}

  /**
   * Resolve a prompt for a tenant + category + tier. Returns a blocked
   * response when:
   *   • the tenant is unknown,
   *   • the BAA has not been signed (HIPAA-bearing tenants only),
   *   • the (category, domain) is not defined in the template engine,
   *   • the rate limit has been exceeded,
   *   • content_mode disagrees with the tenant's contracted mode,
   *   • a HIPAA tenant request is missing a consent receipt.
   *
   * Every outcome — allow or deny — is appended to the audit log with the
   * caller's correlation_id and a canonical reason_code.
   */
  resolvePrompt(req: ResolvePromptInput): CyranoLayer4PromptResponse {
    const correlation_id = req.correlation_id ?? randomUUID();
    const tenant = this.tenantStore.getTenant(req.tenant_id);
    if (!tenant) {
      return this.deny(req, 'TENANT_NOT_FOUND', null, correlation_id);
    }

    // HIPAA gate: BAA must be signed for MEDICAL tenants. Non-medical
    // tenants ignore the BAA bit (other regimes have their own gates).
    if (tenant.domain === 'MEDICAL' && !tenant.baa_signed) {
      return this.deny(req, 'BAA_NOT_SIGNED', tenant, correlation_id);
    }

    // Consent receipt gate: HIPAA / GDPR tenants must attach a receipt id.
    if (
      (tenant.compliance_regime === 'HIPAA' || tenant.compliance_regime === 'GDPR') &&
      !req.consent_receipt_id
    ) {
      return this.deny(req, 'CONSENT_RECEIPT_MISSING', tenant, correlation_id);
    }

    // Content mode enforcement.
    const requested_mode: CyranoLayer4ContentMode = req.content_mode ?? tenant.content_mode;
    if (requested_mode === 'adult' && tenant.content_mode !== 'adult') {
      return this.deny(req, 'CONTENT_MODE_FORBIDDEN', tenant, correlation_id);
    }
    if (requested_mode !== tenant.content_mode) {
      return this.deny(req, 'CONTENT_MODE_MISMATCH', tenant, correlation_id);
    }

    // Per-tenant rate limit check (per minute) plus per-API-key burst.
    const rl = this.rateLimiter.consume({
      tenant_id: tenant.tenant_id,
      limit_per_minute: tenant.rate_limit_per_minute,
      api_key_id: req.api_key_id ?? null,
    });
    if (!rl.allowed) {
      return this.deny(req, 'RATE_LIMIT_EXCEEDED', tenant, correlation_id);
    }

    // Resolve the template via the shared engine, content-mode aware.
    const template = resolveLayer4PromptTemplate({
      category: req.category,
      domain: tenant.domain,
      tier: req.tier,
      content_mode: requested_mode,
    });
    if (!template) {
      return this.deny(req, 'TEMPLATE_UNAVAILABLE', tenant, correlation_id);
    }

    const copy = template({ tone: req.tone ?? 'enterprise_neutral', tier: req.tier });

    // Optional voice synthesis. Tenant must have voice_enabled, and the
    // request must opt-in via voice.enabled. Otherwise we explicitly emit
    // a skip envelope so downstream callers can render UI accordingly.
    let voice_envelope: CyranoLayer4VoiceEnvelope | null = null;
    if (req.voice?.enabled) {
      voice_envelope = this.voice.synthesise({
        tenant,
        copy,
        voice_id: req.voice.voice_id,
        locale: req.voice.locale,
        correlation_id,
        consent_receipt_id: req.consent_receipt_id ?? null,
      });
    }

    // Optional real-time text translation (Issue #15 — Phase 4).
    // When target_locale is provided the translation service is called
    // and the envelope is attached to the response alongside the original copy.
    let translation_envelope: CyranoLayer4TranslationEnvelope | null = null;
    if (req.target_locale) {
      translation_envelope = this.translation.translate({
        tenant_id: tenant.tenant_id,
        source_copy: copy,
        target_locale: req.target_locale,
        correlation_id,
      });
    }

    const response: CyranoLayer4PromptResponse = {
      request_id: randomUUID(),
      tenant_id: tenant.tenant_id,
      domain: tenant.domain,
      category: req.category,
      tier: req.tier,
      content_mode: requested_mode,
      copy,
      blocked: false,
      reason_code: 'PROMPT_OK',
      rule_applied_id: CYRANO_LAYER4_RULE_ID,
      voice: voice_envelope,
      translation: translation_envelope,
      correlation_id,
      emitted_at_utc: new Date().toISOString(),
    };

    this.audit.recordDecision({
      tenant_id: tenant.tenant_id,
      api_key_id: req.api_key_id ?? null,
      endpoint: '/cyrano/layer4/prompt',
      reason_code: 'PROMPT_OK',
      outcome: 'ALLOW',
      correlation_id,
      payload: {
        category: req.category,
        tier: req.tier,
        content_mode: requested_mode,
        domain: tenant.domain,
        voice_requested: Boolean(req.voice?.enabled),
        voice_emitted: Boolean(voice_envelope?.voice_uri),
        translation_requested: Boolean(req.target_locale),
        target_locale: req.target_locale ?? null,
      },
    });

    this.nats.publish(NATS_TOPICS.CYRANO_LAYER4_PROMPT_GRANTED, {
      request_id: response.request_id,
      tenant_id: response.tenant_id,
      domain: response.domain,
      category: response.category,
      tier: response.tier,
      content_mode: response.content_mode,
      api_key_id: req.api_key_id ?? null,
      correlation_id,
      reason_code: 'PROMPT_OK',
      rule_applied_id: CYRANO_LAYER4_RULE_ID,
      emitted_at_utc: response.emitted_at_utc,
    });

    return response;
  }

  private deny(
    req: ResolvePromptInput,
    reason_code: CyranoLayer4ReasonCode,
    tenant: CyranoLayer4Tenant | null,
    correlation_id: string,
  ): CyranoLayer4PromptResponse {
    const emitted_at_utc = new Date().toISOString();
    const response: CyranoLayer4PromptResponse = {
      request_id: randomUUID(),
      tenant_id: req.tenant_id,
      domain: tenant?.domain ?? 'ADULT_ENTERTAINMENT',
      category: req.category,
      tier: req.tier,
      content_mode: tenant?.content_mode ?? 'non_adult',
      copy: '',
      blocked: true,
      reason_code,
      rule_applied_id: CYRANO_LAYER4_RULE_ID,
      voice: null,
      correlation_id,
      emitted_at_utc,
    };

    this.audit.recordDecision({
      tenant_id: req.tenant_id,
      api_key_id: req.api_key_id ?? null,
      endpoint: '/cyrano/layer4/prompt',
      reason_code,
      outcome: 'DENY',
      correlation_id,
      payload: {
        category: req.category,
        tier: req.tier,
        content_mode: req.content_mode ?? null,
      },
    });

    this.nats.publish(NATS_TOPICS.CYRANO_LAYER4_PROMPT_DENIED, {
      request_id: response.request_id,
      tenant_id: response.tenant_id,
      api_key_id: req.api_key_id ?? null,
      reason_code,
      correlation_id,
      rule_applied_id: CYRANO_LAYER4_RULE_ID,
      emitted_at_utc,
    });

    return response;
  }
}
