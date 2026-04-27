/**
 * cyrano-layer4-enterprise.spec.ts
 * Phase 3.11 — multi-tenant enterprise API stub.
 */
import { CyranoLayer4EnterpriseService } from '../../services/cyrano/src/cyrano-layer4-enterprise.service';

describe('CyranoLayer4EnterpriseService', () => {
  it('blocks unknown tenants', () => {
    const svc = new CyranoLayer4EnterpriseService();
    const out = svc.resolvePrompt({
      tenant_id: 'unknown',
      session_id: 'sess-1',
      category: 'CAT_SESSION_OPEN',
      tier: 'COLD',
    });
    expect(out.blocked).toBe(true);
    expect(out.reason_code).toBe('TENANT_NOT_FOUND');
  });

  it('blocks medical tenants without a signed BAA', () => {
    const svc = new CyranoLayer4EnterpriseService();
    svc.registerTenant({
      tenant_id: 'med-1',
      display_name: 'Acme Health',
      domain: 'MEDICAL',
      country_code: 'CA',
      baa_signed: false,
    });
    const out = svc.resolvePrompt({
      tenant_id: 'med-1',
      session_id: 'sess-1',
      category: 'CAT_SESSION_OPEN',
      tier: 'COLD',
    });
    expect(out.blocked).toBe(true);
    expect(out.reason_code).toBe('BAA_NOT_SIGNED');
  });

  it('returns a domain-appropriate template for a registered teaching tenant', () => {
    const svc = new CyranoLayer4EnterpriseService();
    svc.registerTenant({
      tenant_id: 'edu-1',
      display_name: 'Acme U',
      domain: 'TEACHING',
      country_code: 'CA',
      baa_signed: true,
    });
    const out = svc.resolvePrompt({
      tenant_id: 'edu-1',
      session_id: 'sess-1',
      category: 'CAT_SESSION_OPEN',
      tier: 'COLD',
    });
    expect(out.blocked).toBeUndefined();
    expect(out.copy).toMatch(/learning objective/);
  });
});
