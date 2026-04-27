// Cyrano Layer 2 — auth controller
// Exposes the gate endpoint that the standalone Next.js runtime
// (apps/cyrano-standalone/) calls before serving any VIP-only surface.
//
// Endpoint:
//   POST /cyrano/auth/session
//     Headers (canonical platform identity convention):
//       x-user-id          (required)
//       x-organization-id  (required)
//       x-tenant-id        (required)
//       x-correlation-id   (optional, propagated for tracing)
//     Body (optional):
//       { content_mode?: 'adult' | 'narrative' }
//     200 → CyranoLayer2SessionGranted
//     403 → ForbiddenException with { reason_code, rule_applied_id, ... }

import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import { CyranoAuthService } from './cyrano-auth.service';
import {
  CyranoLayer2ContentMode,
  CyranoLayer2SessionGranted,
} from './cyrano-auth.types';

interface EstablishSessionBody {
  content_mode?: CyranoLayer2ContentMode;
}

@Controller('cyrano/auth')
export class CyranoAuthController {
  private readonly logger = new Logger(CyranoAuthController.name);

  constructor(private readonly cyranoAuth: CyranoAuthService) {}

  @Post('session')
  @HttpCode(HttpStatus.OK)
  async establishSession(
    @Headers('x-user-id') userId: string | undefined,
    @Headers('x-organization-id') organizationId: string | undefined,
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @Body() body: EstablishSessionBody | undefined,
  ): Promise<CyranoLayer2SessionGranted> {
    if (!userId || !organizationId || !tenantId) {
      this.logger.warn('CyranoAuthController.establishSession: missing identity headers', {
        has_user_id: Boolean(userId),
        has_organization_id: Boolean(organizationId),
        has_tenant_id: Boolean(tenantId),
        rule_applied_id: 'CYRANO_LAYER2_GATE_v1',
      });
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'x-user-id, x-organization-id, and x-tenant-id headers are required.',
        reason_code: 'NO_USER_CONTEXT',
        rule_applied_id: 'CYRANO_LAYER2_GATE_v1',
      });
    }

    return this.cyranoAuth.establishSession({
      user_id: userId,
      organization_id: organizationId,
      tenant_id: tenantId,
      content_mode: body?.content_mode,
      correlation_id: correlationId,
    });
  }
}
