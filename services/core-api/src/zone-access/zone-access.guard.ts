// FIZ: MEMB-001 — ZoneAccessGuard
// NestJS CanActivate guard that enforces zone access via ZoneAccessService.
// Applied to all zone-gated route controllers.
import { CanActivate, ExecutionContext, Injectable, Logger, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ZoneAccessService } from './zone-access.service';
import { ZoneAccessZone } from '../config/governance.config';

/** Metadata key for the zone required by a controller/route. */
export const ZONE_GATE_KEY = 'ZONE_GATE';

/**
 * Decorator: mark a controller or route as requiring access to a specific zone.
 * Usage: @ZoneGate('SHOW_THEATRE')
 */
export const ZoneGate = (zone: ZoneAccessZone) => SetMetadata(ZONE_GATE_KEY, zone);

@Injectable()
export class ZoneAccessGuard implements CanActivate {
  private readonly logger = new Logger(ZoneAccessGuard.name);

  constructor(
    private readonly zoneAccessService: ZoneAccessService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const zone = this.reflector.getAllAndOverride<ZoneAccessZone | undefined>(ZONE_GATE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no @ZoneGate decorator is present, allow access (not zone-gated)
    if (!zone) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    // Multi-tenant: extract user, organization, and tenant from request
    const userId: string =
      request.user?.id ?? request.user?.user_id ?? request.headers?.['x-user-id'];
    const organizationId: string | undefined = request.headers?.['x-organization-id'];
    const tenantId: string | undefined = request.headers?.['x-tenant-id'];

    if (!userId) {
      this.logger.warn('ZoneAccessGuard: no user_id found on request', {
        zone,
        rule_applied_id: 'MEMB-001_ZONE_ACCESS_v1',
      });
      return false;
    }

    if (!organizationId || !tenantId) {
      this.logger.warn('ZoneAccessGuard: missing organization_id or tenant_id', {
        zone,
        user_id: userId,
        rule_applied_id: 'MEMB-001_ZONE_ACCESS_v1',
      });
      return false;
    }

    this.logger.log('ZoneAccessGuard: evaluating access', {
      user_id: userId,
      zone,
      rule_applied_id: 'MEMB-001_ZONE_ACCESS_v1',
    });

    // evaluateAccess throws ForbiddenException on DENIED
    await this.zoneAccessService.evaluateAccess(userId, zone, organizationId, tenantId);

    return true;
  }
}
