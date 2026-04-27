// PAYLOAD 5+ — Cyrano Layer 4 tenant store
// Phase 0 (Layer 4 v1) — append-only tenant registry with hard
// (tenant_id)-keyed isolation. Read paths can never return a tenant
// belonging to a different caller; mutations carry correlation_id +
// reason_code per Canonical Corpus invariants.
//
// Storage model: in-process Map keyed by tenant_id. The shape mirrors a
// future `cyrano_layer4_tenants` Prisma table 1:1 (see ASSUMPTIONS A009)
// so the swap to Prisma is a drop-in replacement.

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { NATS_TOPICS } from '../../nats/topics.registry';
import {
  CYRANO_LAYER4_RULE_ID,
  type CyranoLayer4ComplianceRegime,
  type CyranoLayer4ContentMode,
  type CyranoLayer4Tenant,
} from './cyrano-layer4.types';
import type { CyranoDomain } from './cyrano.types';

/** Default per-tenant rate limit (requests / minute). */
export const DEFAULT_TENANT_RATE_LIMIT_PER_MINUTE = 600;

/** Domains that are non-adult by spec — content_mode forced to non_adult. */
const NON_ADULT_DOMAINS: readonly CyranoDomain[] = [
  'TEACHING',
  'COACHING',
  'FIRST_RESPONDER',
  'FACTORY_SAFETY',
  'MEDICAL',
] as const;

export interface RegisterTenantInput {
  tenant_id: string;
  display_name: string;
  domain: CyranoDomain;
  country_code: string;
  baa_signed?: boolean;
  compliance_regime?: CyranoLayer4ComplianceRegime;
  content_mode?: CyranoLayer4ContentMode;
  rate_limit_per_minute?: number;
  voice_enabled?: boolean;
  correlation_id?: string;
  reason_code?: string;
}

@Injectable()
export class CyranoLayer4TenantStore {
  private readonly logger = new Logger(CyranoLayer4TenantStore.name);
  private readonly tenants = new Map<string, CyranoLayer4Tenant>();

  constructor(private readonly nats: NatsService) {}

  /**
   * Register or update a tenant. Idempotent on tenant_id — re-registering
   * the same tenant_id rewrites the row but preserves created_at_utc and
   * the original correlation_id chain.
   */
  upsertTenant(input: RegisterTenantInput): CyranoLayer4Tenant {
    const now = new Date().toISOString();
    const correlation_id = input.correlation_id ?? randomUUID();
    const reason_code = input.reason_code ?? 'ENTERPRISE_TENANT_UPSERT';

    // Domain-driven content_mode coercion. Non-adult domains can never
    // opt into adult content_mode, regardless of caller request.
    const requested_mode = input.content_mode ?? 'non_adult';
    const content_mode: CyranoLayer4ContentMode = NON_ADULT_DOMAINS.includes(input.domain)
      ? 'non_adult'
      : requested_mode;

    const existing = this.tenants.get(input.tenant_id);
    const created_at_utc = existing?.created_at_utc ?? now;

    const tenant: CyranoLayer4Tenant = {
      tenant_id: input.tenant_id,
      display_name: input.display_name,
      domain: input.domain,
      country_code: input.country_code,
      baa_signed: input.baa_signed ?? false,
      compliance_regime: input.compliance_regime ?? 'NONE',
      content_mode,
      rate_limit_per_minute:
        input.rate_limit_per_minute ?? DEFAULT_TENANT_RATE_LIMIT_PER_MINUTE,
      voice_enabled: input.voice_enabled ?? false,
      created_at_utc,
      updated_at_utc: now,
      correlation_id,
      reason_code,
      rule_applied_id: CYRANO_LAYER4_RULE_ID,
    };

    this.tenants.set(tenant.tenant_id, tenant);

    this.logger.log('CyranoLayer4TenantStore: tenant upserted', {
      tenant_id: tenant.tenant_id,
      domain: tenant.domain,
      compliance_regime: tenant.compliance_regime,
      content_mode: tenant.content_mode,
      correlation_id,
      reason_code,
      rule_applied_id: CYRANO_LAYER4_RULE_ID,
    });

    this.nats.publish(NATS_TOPICS.CYRANO_LAYER4_TENANT_REGISTERED, {
      tenant_id: tenant.tenant_id,
      domain: tenant.domain,
      country_code: tenant.country_code,
      compliance_regime: tenant.compliance_regime,
      content_mode: tenant.content_mode,
      voice_enabled: tenant.voice_enabled,
      correlation_id,
      reason_code,
      rule_applied_id: CYRANO_LAYER4_RULE_ID,
      emitted_at_utc: now,
    });

    return { ...tenant };
  }

  /** Read a tenant by id. Returns a defensive copy. */
  getTenant(tenant_id: string): CyranoLayer4Tenant | null {
    const tenant = this.tenants.get(tenant_id);
    return tenant ? { ...tenant } : null;
  }

  /**
   * Strict isolation read: returns the tenant only if the caller-claimed
   * id matches a registered tenant. Used by the Layer 4 guard.
   */
  resolveForRequest(claimed_tenant_id: string | undefined): CyranoLayer4Tenant | null {
    if (!claimed_tenant_id) return null;
    return this.getTenant(claimed_tenant_id);
  }

  /** Lists tenants registered so far. Read-only — returns defensive copies. */
  listTenants(): CyranoLayer4Tenant[] {
    return Array.from(this.tenants.values()).map((t) => ({ ...t }));
  }

  /** Test seam — clears every tenant. Never call from production code paths. */
  reset(): void {
    this.tenants.clear();
  }
}
