// PAYLOAD 5+ — Cyrano Layer 4 enterprise auth guard
// Phase 0 (Layer 4 v1) — extracts tenant + API key from request headers,
// resolves the tenant from the tenant store (hard isolation: callers can
// only see their own tenant), and binds the resolved tenant + api_key_id
// to the request for downstream handlers.
//
// API-key validation is delegated to CyranoLayer4ApiKeyService — the guard
// never trusts a raw header without hashing + comparing through the
// dedicated service.

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { CyranoLayer4ApiKeyService } from './cyrano-layer4-api-key.service';
import { CyranoLayer4TenantStore } from './cyrano-layer4-tenant.store';
import {
  CYRANO_LAYER4_HEADERS,
  CYRANO_LAYER4_RULE_ID,
  type CyranoLayer4ReasonCode,
} from './cyrano-layer4.types';

@Injectable()
export class CyranoLayer4Guard implements CanActivate {
  private readonly logger = new Logger(CyranoLayer4Guard.name);

  constructor(
    private readonly tenants: CyranoLayer4TenantStore,
    private readonly apiKeys: CyranoLayer4ApiKeyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const headers = request.headers ?? {};

    const claimed_tenant: string | undefined = headers[CYRANO_LAYER4_HEADERS.TENANT];
    const raw_key: string | undefined = headers[CYRANO_LAYER4_HEADERS.API_KEY];
    const correlation_id: string | undefined =
      headers[CYRANO_LAYER4_HEADERS.CORRELATION];

    if (!claimed_tenant) {
      this.deny('TENANT_NOT_FOUND', { correlation_id, claimed_tenant: null });
    }
    if (!raw_key) {
      this.deny('API_KEY_MISSING', { correlation_id, claimed_tenant });
    }

    const tenant = this.tenants.resolveForRequest(claimed_tenant);
    if (!tenant) {
      this.deny('TENANT_NOT_FOUND', { correlation_id, claimed_tenant });
    }

    const verified = await this.apiKeys.verify({
      tenant_id: tenant!.tenant_id,
      raw_key: raw_key!,
    });
    if (!verified.allowed) {
      this.deny(verified.reason_code, {
        correlation_id,
        claimed_tenant,
      });
    }

    // Bind the resolved identity onto the request so the controller can
    // forward without re-reading headers.
    request.cyranoLayer4 = {
      tenant: tenant!,
      api_key_id: verified.api_key_id,
      correlation_id,
    };

    return true;
  }

  private deny(
    reason_code: CyranoLayer4ReasonCode,
    ctx: { correlation_id?: string; claimed_tenant: string | undefined | null },
  ): never {
    this.logger.warn('CyranoLayer4Guard: request denied', {
      reason_code,
      claimed_tenant: ctx.claimed_tenant ?? null,
      correlation_id: ctx.correlation_id ?? null,
      rule_applied_id: CYRANO_LAYER4_RULE_ID,
    });
    throw new UnauthorizedException({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Cyrano Layer 4 enterprise authentication failed.',
      reason_code,
      rule_applied_id: CYRANO_LAYER4_RULE_ID,
      correlation_id: ctx.correlation_id ?? null,
    });
  }
}
