// PAYLOAD 5+ — Cyrano Layer 4 enterprise service tests
// End-to-end coverage of the Layer 4 v1 surface:
//   • Tenant isolation
//   • API key mint / verify / revoke
//   • Rate limiting (per-tenant + per-key burst)
//   • Hash-chained audit log + idempotency on correlation_id
//   • Voice envelope (allow / skip with reason codes)
//   • Domain-specific prompt routing + content_mode enforcement

import { NatsService } from '../../core-api/src/nats/nats.service';
import { CyranoLayer4ApiKeyService } from './cyrano-layer4-api-key.service';
import { CyranoLayer4AuditService } from './cyrano-layer4-audit.service';
import { CyranoLayer4EnterpriseService } from './cyrano-layer4-enterprise.service';
import { CyranoLayer4RateLimiterService } from './cyrano-layer4-rate-limiter.service';
import { CyranoLayer4TenantStore } from './cyrano-layer4-tenant.store';
import { CyranoLayer4VoiceBridge } from './cyrano-layer4-voice.bridge';
import {
  _resetLayer4DomainOverlays,
  registerLayer4DomainOverlay,
} from './cyrano-prompt-templates';
import { CyranoTranslationService } from './cyrano-translation.service';

function buildHarness() {
  // NatsService publish() is a no-op without a connection — safe in unit tests.
  const nats = new NatsService();
  const tenants = new CyranoLayer4TenantStore(nats);
  const apiKeys = new CyranoLayer4ApiKeyService(nats);
  const rateLimiter = new CyranoLayer4RateLimiterService(nats);
  const audit = new CyranoLayer4AuditService(nats);
  const voice = new CyranoLayer4VoiceBridge(nats);
  const translation = new CyranoTranslationService(nats);
  const service = new CyranoLayer4EnterpriseService(
    nats,
    tenants,
    rateLimiter,
    audit,
    voice,
    translation,
  );
  return { service, tenants, apiKeys, rateLimiter, audit, translation };
}

describe('CyranoLayer4EnterpriseService', () => {
  beforeEach(() => {
    _resetLayer4DomainOverlays();
  });

  describe('tenant isolation', () => {
    it('rejects unknown tenant_id with TENANT_NOT_FOUND', () => {
      const { service } = buildHarness();
      const res = service.resolvePrompt({
        tenant_id: 'ghost',
        session_id: 's1',
        category: 'CAT_SESSION_OPEN',
        tier: 'COLD',
      });
      expect(res.blocked).toBe(true);
      expect(res.reason_code).toBe('TENANT_NOT_FOUND');
    });

    it('serves a registered teaching tenant a non-adult prompt', () => {
      const { service, tenants } = buildHarness();
      tenants.upsertTenant({
        tenant_id: 'edu-1',
        display_name: 'Edu Co',
        domain: 'TEACHING',
        country_code: 'CA',
      });
      const res = service.resolvePrompt({
        tenant_id: 'edu-1',
        session_id: 's2',
        category: 'CAT_SESSION_OPEN',
        tier: 'COLD',
      });
      expect(res.blocked).toBe(false);
      expect(res.reason_code).toBe('PROMPT_OK');
      expect(res.content_mode).toBe('non_adult');
      expect(res.copy).toMatch(/learning objective/);
    });
  });

  describe('content_mode enforcement', () => {
    it('blocks adult content_mode for a non-adult tenant', () => {
      const { service, tenants } = buildHarness();
      tenants.upsertTenant({
        tenant_id: 'edu-2',
        display_name: 'Edu Co',
        domain: 'TEACHING',
        country_code: 'CA',
      });
      const res = service.resolvePrompt({
        tenant_id: 'edu-2',
        session_id: 's3',
        category: 'CAT_SESSION_OPEN',
        tier: 'COLD',
        content_mode: 'adult',
      });
      expect(res.blocked).toBe(true);
      expect(res.reason_code).toBe('CONTENT_MODE_FORBIDDEN');
    });

    it('blocks adult-only categories in non-adult tenants', () => {
      const { service, tenants } = buildHarness();
      tenants.upsertTenant({
        tenant_id: 'fr-1',
        display_name: 'FirstResp',
        domain: 'FIRST_RESPONDER',
        country_code: 'US',
      });
      const res = service.resolvePrompt({
        tenant_id: 'fr-1',
        session_id: 's4',
        category: 'CAT_MONETIZATION',
        tier: 'HOT',
      });
      expect(res.blocked).toBe(true);
      expect(res.reason_code).toBe('TEMPLATE_UNAVAILABLE');
    });
  });

  describe('HIPAA tenant gating', () => {
    it('blocks medical tenant without BAA signed', () => {
      const { service, tenants } = buildHarness();
      tenants.upsertTenant({
        tenant_id: 'med-1',
        display_name: 'Hospital',
        domain: 'MEDICAL',
        country_code: 'US',
        compliance_regime: 'HIPAA',
        baa_signed: false,
      });
      const res = service.resolvePrompt({
        tenant_id: 'med-1',
        session_id: 's5',
        category: 'CAT_SESSION_OPEN',
        tier: 'COLD',
      });
      expect(res.blocked).toBe(true);
      expect(res.reason_code).toBe('BAA_NOT_SIGNED');
    });

    it('requires consent_receipt_id for HIPAA tenants', () => {
      const { service, tenants } = buildHarness();
      tenants.upsertTenant({
        tenant_id: 'med-2',
        display_name: 'Hospital',
        domain: 'MEDICAL',
        country_code: 'US',
        compliance_regime: 'HIPAA',
        baa_signed: true,
      });
      const res = service.resolvePrompt({
        tenant_id: 'med-2',
        session_id: 's6',
        category: 'CAT_SESSION_OPEN',
        tier: 'COLD',
      });
      expect(res.blocked).toBe(true);
      expect(res.reason_code).toBe('CONSENT_RECEIPT_MISSING');
    });

    it('allows HIPAA tenant when receipt is attached', () => {
      const { service, tenants } = buildHarness();
      tenants.upsertTenant({
        tenant_id: 'med-3',
        display_name: 'Hospital',
        domain: 'MEDICAL',
        country_code: 'US',
        compliance_regime: 'HIPAA',
        baa_signed: true,
      });
      const res = service.resolvePrompt({
        tenant_id: 'med-3',
        session_id: 's7',
        category: 'CAT_SESSION_OPEN',
        tier: 'COLD',
        consent_receipt_id: 'rcpt-1',
      });
      expect(res.blocked).toBe(false);
      expect(res.reason_code).toBe('PROMPT_OK');
    });
  });

  describe('rate limiting', () => {
    it('rejects requests after the per-minute ceiling is hit', () => {
      const { service, tenants } = buildHarness();
      tenants.upsertTenant({
        tenant_id: 'co-1',
        display_name: 'Coach',
        domain: 'COACHING',
        country_code: 'CA',
        rate_limit_per_minute: 2,
      });
      const r1 = service.resolvePrompt({
        tenant_id: 'co-1', session_id: 'a', category: 'CAT_SESSION_OPEN', tier: 'COLD',
      });
      const r2 = service.resolvePrompt({
        tenant_id: 'co-1', session_id: 'a', category: 'CAT_SESSION_OPEN', tier: 'COLD',
      });
      const r3 = service.resolvePrompt({
        tenant_id: 'co-1', session_id: 'a', category: 'CAT_SESSION_OPEN', tier: 'COLD',
      });
      expect(r1.blocked).toBe(false);
      expect(r2.blocked).toBe(false);
      expect(r3.blocked).toBe(true);
      expect(r3.reason_code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  describe('API key management', () => {
    it('mints a key, verifies it, then rejects after revoke', async () => {
      const { tenants, apiKeys } = buildHarness();
      tenants.upsertTenant({
        tenant_id: 'co-2', display_name: 'Coach', domain: 'COACHING', country_code: 'CA',
      });
      const minted = apiKeys.mint({ tenant_id: 'co-2' });
      const ok = await apiKeys.verify({ tenant_id: 'co-2', raw_key: minted.raw_key });
      expect(ok.allowed).toBe(true);

      apiKeys.revoke(minted.api_key_id);
      const denied = await apiKeys.verify({ tenant_id: 'co-2', raw_key: minted.raw_key });
      expect(denied.allowed).toBe(false);
      expect(denied.reason_code).toBe('API_KEY_REVOKED');
    });

    it('blocks cross-tenant key reuse with TENANT_MISMATCH', async () => {
      const { tenants, apiKeys } = buildHarness();
      tenants.upsertTenant({
        tenant_id: 't-a', display_name: 'A', domain: 'COACHING', country_code: 'CA',
      });
      tenants.upsertTenant({
        tenant_id: 't-b', display_name: 'B', domain: 'COACHING', country_code: 'CA',
      });
      const a = apiKeys.mint({ tenant_id: 't-a' });
      const cross = await apiKeys.verify({ tenant_id: 't-b', raw_key: a.raw_key });
      expect(cross.allowed).toBe(false);
      expect(cross.reason_code).toBe('TENANT_MISMATCH');
    });
  });

  describe('audit log', () => {
    it('chains records and survives verifyChain()', () => {
      const { service, tenants, audit } = buildHarness();
      tenants.upsertTenant({
        tenant_id: 'a-1', display_name: 'A', domain: 'COACHING', country_code: 'CA',
      });
      service.resolvePrompt({
        tenant_id: 'a-1', session_id: 's', category: 'CAT_SESSION_OPEN', tier: 'COLD',
      });
      service.resolvePrompt({
        tenant_id: 'a-1', session_id: 's', category: 'CAT_ENGAGEMENT', tier: 'WARM',
      });
      const records = audit.listForTenant('a-1');
      expect(records.length).toBe(2);
      expect(records[0].hash_prior).toBeNull();
      expect(records[1].hash_prior).toBe(records[0].hash_current);
      expect(audit.verifyChain().valid).toBe(true);
    });

    it('is idempotent on correlation_id', () => {
      const { service, tenants, audit } = buildHarness();
      tenants.upsertTenant({
        tenant_id: 'a-2', display_name: 'A', domain: 'COACHING', country_code: 'CA',
      });
      service.resolvePrompt({
        tenant_id: 'a-2',
        session_id: 's',
        category: 'CAT_SESSION_OPEN',
        tier: 'COLD',
        correlation_id: 'fixed-corr',
      });
      service.resolvePrompt({
        tenant_id: 'a-2',
        session_id: 's',
        category: 'CAT_SESSION_OPEN',
        tier: 'COLD',
        correlation_id: 'fixed-corr',
      });
      // Two calls, same correlation — only one chained record.
      expect(audit.listForTenant('a-2').length).toBe(1);
    });
  });

  describe('voice envelope', () => {
    it('returns voice URI when tenant has voice_enabled', () => {
      const { service, tenants } = buildHarness();
      tenants.upsertTenant({
        tenant_id: 'v-1',
        display_name: 'V',
        domain: 'COACHING',
        country_code: 'CA',
        voice_enabled: true,
      });
      const res = service.resolvePrompt({
        tenant_id: 'v-1',
        session_id: 's',
        category: 'CAT_SESSION_OPEN',
        tier: 'COLD',
        voice: { enabled: true },
      });
      expect(res.voice).toBeTruthy();
      expect(res.voice?.voice_uri).toMatch(/^cyrano-l4:\/\/voice\//);
      expect(res.voice?.voice_id).toBe('cyrano_warm_en'); // domain default
    });

    it('skips voice with VOICE_NOT_PERMITTED when tenant lacks voice', () => {
      const { service, tenants } = buildHarness();
      tenants.upsertTenant({
        tenant_id: 'v-2',
        display_name: 'V',
        domain: 'COACHING',
        country_code: 'CA',
        voice_enabled: false,
      });
      const res = service.resolvePrompt({
        tenant_id: 'v-2',
        session_id: 's',
        category: 'CAT_SESSION_OPEN',
        tier: 'COLD',
        voice: { enabled: true },
      });
      expect(res.voice?.voice_uri).toBe('');
      expect(res.voice?.skipped_reason_code).toBe('VOICE_NOT_PERMITTED');
    });
  });

  describe('non-adult overlay extension point', () => {
    it('uses a registered overlay over the canonical template', () => {
      const { service, tenants } = buildHarness();
      tenants.upsertTenant({
        tenant_id: 'ext-1', display_name: 'Ext', domain: 'TEACHING', country_code: 'CA',
      });
      registerLayer4DomainOverlay({
        domain: 'TEACHING',
        content_mode: 'non_adult',
        category: 'CAT_SESSION_OPEN',
        template: ({ tone }) => `[${tone}] CUSTOM TEACHING OPENER`,
      });
      const res = service.resolvePrompt({
        tenant_id: 'ext-1',
        session_id: 's',
        category: 'CAT_SESSION_OPEN',
        tier: 'COLD',
      });
      expect(res.copy).toContain('CUSTOM TEACHING OPENER');
    });
  });

  describe('translation integration (Issue #15)', () => {
    it('attaches a translation envelope when target_locale is provided', () => {
      const { service, tenants } = buildHarness();
      tenants.upsertTenant({
        tenant_id: 'tr-1', display_name: 'Trans', domain: 'COACHING', country_code: 'CA',
      });
      const res = service.resolvePrompt({
        tenant_id: 'tr-1',
        session_id: 's',
        category: 'CAT_SESSION_OPEN',
        tier: 'COLD',
        target_locale: 'fr-FR',
      });
      expect(res.blocked).toBe(false);
      expect(res.translation).toBeTruthy();
      expect(res.translation?.target_locale).toBe('fr-FR');
      expect(res.translation?.source_locale).toBe('en-US');
      expect(res.translation?.translated_copy).toBeTruthy();
    });

    it('omits the translation envelope when no target_locale is given', () => {
      const { service, tenants } = buildHarness();
      tenants.upsertTenant({
        tenant_id: 'tr-2', display_name: 'Trans', domain: 'COACHING', country_code: 'CA',
      });
      const res = service.resolvePrompt({
        tenant_id: 'tr-2',
        session_id: 's',
        category: 'CAT_SESSION_OPEN',
        tier: 'COLD',
      });
      expect(res.translation).toBeNull();
    });

    it('returns a skip envelope when target_locale equals source locale', () => {
      const { service, tenants } = buildHarness();
      tenants.upsertTenant({
        tenant_id: 'tr-3', display_name: 'Trans', domain: 'COACHING', country_code: 'CA',
      });
      const res = service.resolvePrompt({
        tenant_id: 'tr-3',
        session_id: 's',
        category: 'CAT_SESSION_OPEN',
        tier: 'COLD',
        target_locale: 'en-US',
      });
      expect(res.translation?.translated_copy).toBe('');
      expect(res.translation?.skipped_reason_code).toBe('TRANSLATION_LOCALE_SAME_AS_SOURCE');
    });
  });
});
