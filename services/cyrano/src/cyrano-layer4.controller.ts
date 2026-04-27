// PAYLOAD 5+ — Cyrano Layer 4 enterprise REST controller
// Phase 0 (Layer 4 v1) — multi-tenant entry point.
//   POST /cyrano/layer4/tenants                  → register/upsert a tenant
//   POST /cyrano/layer4/tenants/:tenantId/keys   → mint an API key (tenant-bound)
//   GET  /cyrano/layer4/tenants/:tenantId/keys   → list hashed key records
//   POST /cyrano/layer4/prompt                   → resolve a domain prompt
//
// The /prompt endpoint is gated by CyranoLayer4Guard, which binds the
// resolved tenant to req.cyranoLayer4. Tenant-management endpoints are
// admin-scoped and gated upstream by the platform admin guard
// (out-of-scope for Layer 4 v1).

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CyranoLayer4ApiKeyService } from './cyrano-layer4-api-key.service';
import {
  CyranoLayer4AuditService,
  type CyranoLayer4ChainedAuditRecord,
  type CyranoLayer4ChainVerifyResult,
} from './cyrano-layer4-audit.service';
import { CyranoLayer4EnterpriseService } from './cyrano-layer4-enterprise.service';
import { CyranoLayer4Guard } from './cyrano-layer4.guard';
import { CyranoLayer4TenantStore } from './cyrano-layer4-tenant.store';
import {
  CYRANO_LAYER4_HEADERS,
  CYRANO_LAYER4_RULE_ID,
  type CyranoLayer4ApiKey,
  type CyranoLayer4ApiKeyMint,
  type CyranoLayer4PromptRequest,
  type CyranoLayer4PromptResponse,
  type CyranoLayer4RegisterTenantRequest,
  type CyranoLayer4Tenant,
} from './cyrano-layer4.types';

@Controller('cyrano/layer4')
export class CyranoLayer4Controller {
  private readonly logger = new Logger(CyranoLayer4Controller.name);

  constructor(
    private readonly tenants: CyranoLayer4TenantStore,
    private readonly apiKeys: CyranoLayer4ApiKeyService,
    private readonly enterprise: CyranoLayer4EnterpriseService,
    private readonly audit: CyranoLayer4AuditService,
  ) {}

  /** Register or upsert a tenant. Admin-only — guard upstream. */
  @Post('tenants')
  @HttpCode(HttpStatus.OK)
  registerTenant(
    @Body() body: CyranoLayer4RegisterTenantRequest | undefined,
    @Headers(CYRANO_LAYER4_HEADERS.CORRELATION) correlationId?: string,
  ): CyranoLayer4Tenant {
    if (!body || !body.tenant_id || !body.display_name || !body.domain || !body.country_code) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message:
          'tenant_id, display_name, domain, and country_code are required to register a tenant.',
        reason_code: 'TENANT_REGISTRATION_INVALID',
        rule_applied_id: CYRANO_LAYER4_RULE_ID,
      });
    }
    return this.tenants.upsertTenant({
      tenant_id: body.tenant_id,
      display_name: body.display_name,
      domain: body.domain,
      country_code: body.country_code,
      baa_signed: body.baa_signed,
      compliance_regime: body.compliance_regime,
      content_mode: body.content_mode,
      rate_limit_per_minute: body.rate_limit_per_minute,
      voice_enabled: body.voice_enabled,
      correlation_id: body.correlation_id ?? correlationId,
    });
  }

  /** Mint an API key for a tenant. Admin-only — guard upstream. */
  @Post('tenants/:tenantId/keys')
  @HttpCode(HttpStatus.CREATED)
  mintApiKey(
    @Param('tenantId') tenantId: string,
    @Body() body: { label?: string; correlation_id?: string } | undefined,
    @Headers(CYRANO_LAYER4_HEADERS.CORRELATION) correlationId?: string,
  ): CyranoLayer4ApiKeyMint {
    const tenant = this.tenants.getTenant(tenantId);
    if (!tenant) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message: `Unknown tenant: ${tenantId}`,
        reason_code: 'TENANT_NOT_FOUND',
        rule_applied_id: CYRANO_LAYER4_RULE_ID,
      });
    }
    return this.apiKeys.mint({
      tenant_id: tenant.tenant_id,
      label: body?.label,
      correlation_id: body?.correlation_id ?? correlationId,
    });
  }

  /** List hashed key records for a tenant. Never returns raw keys. */
  @Get('tenants/:tenantId/keys')
  listApiKeys(@Param('tenantId') tenantId: string): { keys: CyranoLayer4ApiKey[] } {
    const tenant = this.tenants.getTenant(tenantId);
    if (!tenant) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message: `Unknown tenant: ${tenantId}`,
        reason_code: 'TENANT_NOT_FOUND',
        rule_applied_id: CYRANO_LAYER4_RULE_ID,
      });
    }
    return { keys: this.apiKeys.listForTenant(tenant.tenant_id) };
  }

  /**
   * Resolve a domain-specific prompt for the authenticated tenant.
   * Body's tenant_id must match the guard-resolved tenant_id; otherwise
   * the request is rejected on TENANT_MISMATCH.
   */
  @Post('prompt')
  @UseGuards(CyranoLayer4Guard)
  @HttpCode(HttpStatus.OK)
  resolvePrompt(
    @Body() body: CyranoLayer4PromptRequest | undefined,
    @Req() req: { cyranoLayer4?: { tenant: CyranoLayer4Tenant; api_key_id: string; correlation_id?: string } },
    @Headers(CYRANO_LAYER4_HEADERS.CONSENT_RECEIPT) consentReceiptId?: string,
  ): CyranoLayer4PromptResponse {
    const session = req.cyranoLayer4;
    if (!session) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message: 'CyranoLayer4Guard did not bind a tenant — internal misconfiguration.',
        reason_code: 'TENANT_NOT_FOUND',
        rule_applied_id: CYRANO_LAYER4_RULE_ID,
      });
    }
    if (!body || !body.tenant_id || !body.session_id || !body.category || !body.tier) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'tenant_id, session_id, category, and tier are required.',
        reason_code: 'PROMPT_REQUEST_INVALID',
        rule_applied_id: CYRANO_LAYER4_RULE_ID,
      });
    }
    if (body.tenant_id !== session.tenant.tenant_id) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Body tenant_id does not match the authenticated tenant.',
        reason_code: 'TENANT_MISMATCH',
        rule_applied_id: CYRANO_LAYER4_RULE_ID,
      });
    }

    return this.enterprise.resolvePrompt({
      ...body,
      consent_receipt_id: body.consent_receipt_id ?? consentReceiptId,
      correlation_id: body.correlation_id ?? session.correlation_id,
      api_key_id: session.api_key_id,
    });
  }

  /** Revoke an API key. Admin-only — guard upstream. */
  @Delete('tenants/:tenantId/keys/:apiKeyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeApiKey(
    @Param('tenantId') tenantId: string,
    @Param('apiKeyId') apiKeyId: string,
  ): void {
    const tenant = this.tenants.getTenant(tenantId);
    if (!tenant) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message: `Unknown tenant: ${tenantId}`,
        reason_code: 'TENANT_NOT_FOUND',
        rule_applied_id: CYRANO_LAYER4_RULE_ID,
      });
    }
    const found = this.apiKeys
      .listForTenant(tenant.tenant_id)
      .find((k) => k.api_key_id === apiKeyId);
    if (!found) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        message: `Unknown API key for this tenant: ${apiKeyId}`,
        reason_code: 'API_KEY_INVALID',
        rule_applied_id: CYRANO_LAYER4_RULE_ID,
      });
    }
    this.apiKeys.revoke(apiKeyId, 'API_KEY_REVOKED_BY_TENANT_ADMIN');
  }

  /** Read tenant-scoped audit log. Admin / compliance-only. */
  @Get('tenants/:tenantId/audit')
  listAudit(
    @Param('tenantId') tenantId: string,
  ): { records: CyranoLayer4ChainedAuditRecord[]; chain: CyranoLayer4ChainVerifyResult } {
    const tenant = this.tenants.getTenant(tenantId);
    if (!tenant) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message: `Unknown tenant: ${tenantId}`,
        reason_code: 'TENANT_NOT_FOUND',
        rule_applied_id: CYRANO_LAYER4_RULE_ID,
      });
    }
    return {
      records: this.audit.listForTenant(tenant.tenant_id),
      chain: this.audit.verifyChain(),
    };
  }
}
