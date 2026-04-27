// FIZ: MEMB-001 / MEMB-002 — ZoneAccessService
// Server-side zone access enforcement. Resolves membership tier + ShowZonePass
// and checks against ZONE_MAP in GovernanceConfig.
// MEMB-002: resolveUserTier now delegates to MembershipService.getActiveTier().
import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  ZONE_MAP,
  SHOW_ZONE_PASS_OVERRIDE_ZONES,
  ZoneAccessTier,
  ZoneAccessZone,
} from '../config/governance.config';
import { NATS_TOPICS } from '../../../nats/topics.registry';
import { NatsService } from '../nats/nats.service';
import { MembershipService } from '../membership/membership.service';

export interface ZoneAccessDecision {
  result: 'GRANTED' | 'DENIED';
  user_id: string;
  zone: ZoneAccessZone;
  resolved_tier: ZoneAccessTier;
  has_show_zone_pass: boolean;
  reason_code: string;
  rule_applied_id: string;
}

@Injectable()
export class ZoneAccessService {
  private readonly logger = new Logger(ZoneAccessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly natsService: NatsService,
    private readonly membershipService: MembershipService,
  ) {}

  /**
   * Evaluate zone access for a user.
   * 1. Resolve the user's current membership tier via MembershipService
   * 2. Check for active ShowZonePass records for the requested zone
   * 3. Compare against ZONE_MAP
   * 4. Return GRANTED or DENIED with full audit payload
   */
  async evaluateAccess(
    userId: string,
    zone: ZoneAccessZone,
    organizationId: string,
    tenantId: string,
  ): Promise<ZoneAccessDecision> {
    const ruleAppliedId = `MEMB-001_ZONE_ACCESS_v1`;

    // Step 1: Resolve membership tier via MembershipService (MEMB-002)
    const resolvedTier: ZoneAccessTier = await this.resolveUserTier(userId);

    // Step 2: Check for active ShowZonePass for this zone
    const hasShowZonePass = await this.hasActiveShowZonePass(userId, zone);

    // Step 3: Check ZONE_MAP
    const allowedTiers = ZONE_MAP[zone] as readonly string[];
    const tierGranted = allowedTiers.includes(resolvedTier);

    // Step 4: ShowZonePass override for SHOW_THEATRE and BIJOU
    const passOverrideZones: readonly string[] = SHOW_ZONE_PASS_OVERRIDE_ZONES;
    const passOverride = hasShowZonePass && passOverrideZones.includes(zone);

    const granted = tierGranted || passOverride;

    const decision: ZoneAccessDecision = {
      result: granted ? 'GRANTED' : 'DENIED',
      user_id: userId,
      zone,
      resolved_tier: resolvedTier,
      has_show_zone_pass: hasShowZonePass,
      reason_code: granted
        ? tierGranted
          ? 'TIER_AUTHORIZED'
          : 'SHOW_ZONE_PASS_OVERRIDE'
        : 'TIER_INSUFFICIENT',
      rule_applied_id: ruleAppliedId,
    };

    // Log every decision (granted and denied)
    this.logger.log('ZoneAccessService: access decision', {
      ...decision,
      organization_id: organizationId,
      tenant_id: tenantId,
    });

    if (!granted) {
      // Publish NATS event on DENIED
      this.natsService.publish(NATS_TOPICS.ZONE_ACCESS_DENIED, {
        user_id: userId,
        zone,
        reason_code: decision.reason_code,
        rule_applied_id: decision.rule_applied_id,
        timestamp: new Date().toISOString(),
        timezone: 'America/Toronto',
        organization_id: organizationId,
        tenant_id: tenantId,
      });

      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message: `Zone access denied: ${zone}`,
        reason_code: decision.reason_code,
        rule_applied_id: decision.rule_applied_id,
        resolved_tier: resolvedTier,
        zone,
      });
    }

    return decision;
  }

  /**
   * Resolve user's current membership tier via MembershipService (MEMB-002).
   * Returns GUEST if no active subscription exists.
   */
  async resolveUserTier(userId: string): Promise<ZoneAccessTier> {
    return this.membershipService.getActiveTier(userId);
  }

  /**
   * Check if the user has an active ShowZonePass for the given zone.
   */
  private async hasActiveShowZonePass(userId: string, zone: ZoneAccessZone): Promise<boolean> {
    const now = new Date();
    const pass = await this.prisma.showZonePass.findFirst({
      where: {
        user_id: userId,
        zone,
        valid_from: { lte: now },
        valid_until: { gte: now },
      },
    });
    return pass !== null;
  }
}
