// Cyrano Layer 2 — auth guard
// CanActivate guard that any controller serving the standalone role-play
// platform (apps/cyrano-standalone/) can apply. Re-uses the platform's
// canonical request-identity convention: x-user-id, x-organization-id,
// x-tenant-id headers (or request.user.id when set by an upstream auth
// middleware), then defers to CyranoAuthService for the tier check.
//
// Phase 0 only enforces the gate. Session persistence is intentionally
// deferred to Phase 1 with cyrano_world_sessions.

import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { CyranoAuthService } from './cyrano-auth.service';

@Injectable()
export class CyranoLayer2Guard implements CanActivate {
  private readonly logger = new Logger(CyranoLayer2Guard.name);

  constructor(private readonly cyranoAuth: CyranoAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const userId: string | undefined =
      request.user?.id ?? request.user?.user_id ?? request.headers?.['x-user-id'];
    const organizationId: string | undefined = request.headers?.['x-organization-id'];
    const tenantId: string | undefined = request.headers?.['x-tenant-id'];
    const correlationId: string | undefined = request.headers?.['x-correlation-id'];

    if (!userId || !organizationId || !tenantId) {
      this.logger.warn('CyranoLayer2Guard: missing identity headers', {
        has_user_id: Boolean(userId),
        has_organization_id: Boolean(organizationId),
        has_tenant_id: Boolean(tenantId),
        rule_applied_id: 'CYRANO_LAYER2_GATE_v1',
      });
      return false;
    }

    // establishSession throws ForbiddenException on DENIED. The granted result
    // is attached to the request for downstream handlers that need the tier
    // or correlation_id (e.g. Phase 1 world-loader).
    const granted = await this.cyranoAuth.establishSession({
      user_id: userId,
      organization_id: organizationId,
      tenant_id: tenantId,
      correlation_id: correlationId,
    });

    request.cyranoLayer2Session = granted;
    return true;
  }
}
