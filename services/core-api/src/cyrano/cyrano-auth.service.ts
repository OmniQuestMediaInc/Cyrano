// Cyrano Layer 2 — gate service
// Phase 0: tier-only enforcement for the standalone role-play platform.
// No DB writes yet (no session persistence); session_id is opaque + ephemeral
// and emitted on the audit-grade NATS topic so downstream services have a
// correlation hook before Phase 1 introduces cyrano_world_sessions.

import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { MembershipService } from '../membership/membership.service';
import { NatsService } from '../nats/nats.service';
import { NATS_TOPICS } from '../../../nats/topics.registry';
import {
  CYRANO_LAYER2_ALLOWED_TIERS,
  CYRANO_LAYER2_RULE_APPLIED_ID,
  CYRANO_LAYER2_SESSION_TTL_SECONDS,
  CYRANO_LAYER2_TIER_DISPLAY,
  CyranoLayer2SessionDecision,
  CyranoLayer2SessionGranted,
  CyranoLayer2Tier,
  EstablishCyranoLayer2SessionInput,
} from './cyrano-auth.types';

@Injectable()
export class CyranoAuthService {
  private readonly logger = new Logger(CyranoAuthService.name);

  constructor(
    private readonly membershipService: MembershipService,
    private readonly natsService: NatsService,
  ) {}

  /**
   * Establish a Cyrano Layer 2 session for the given user.
   * Resolves the user's active membership tier, enforces the OmniPass+ /
   * Diamond gate, and emits an audit-grade NATS event regardless of outcome.
   * Throws ForbiddenException on DENIED.
   */
  async establishSession(
    input: EstablishCyranoLayer2SessionInput,
  ): Promise<CyranoLayer2SessionGranted> {
    const correlationId = input.correlation_id ?? randomUUID();
    const contentMode = input.content_mode ?? 'adult';

    const resolvedTier = await this.membershipService.getActiveTier(input.user_id);
    const allowed = (CYRANO_LAYER2_ALLOWED_TIERS as readonly string[]).includes(resolvedTier);

    if (!allowed) {
      const denied: CyranoLayer2SessionDecision = {
        result: 'DENIED',
        user_id: input.user_id,
        resolved_tier: resolvedTier,
        correlation_id: correlationId,
        reason_code: 'TIER_INSUFFICIENT',
        rule_applied_id: CYRANO_LAYER2_RULE_APPLIED_ID,
      };

      this.logger.warn('CyranoAuthService.establishSession: DENIED', {
        ...denied,
        organization_id: input.organization_id,
        tenant_id: input.tenant_id,
      });

      this.natsService.publish(NATS_TOPICS.CYRANO_LAYER2_SESSION_DENIED, {
        ...denied,
        organization_id: input.organization_id,
        tenant_id: input.tenant_id,
        timestamp: new Date().toISOString(),
        timezone: 'America/Toronto',
      });

      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Cyrano Layer 2 access requires OmniPass+ or Diamond membership.',
        reason_code: denied.reason_code,
        rule_applied_id: denied.rule_applied_id,
        resolved_tier: resolvedTier,
        correlation_id: correlationId,
      });
    }

    // Allowed tier — issue an opaque session token. Phase 1 will persist
    // session state in the cyrano_world_sessions table; for now the token is
    // ephemeral and only carries audit identity.
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + CYRANO_LAYER2_SESSION_TTL_SECONDS * 1000);
    const sessionId = randomUUID();
    const tier = resolvedTier as CyranoLayer2Tier;

    const granted: CyranoLayer2SessionGranted = {
      result: 'GRANTED',
      session_id: sessionId,
      user_id: input.user_id,
      resolved_tier: tier,
      tier_display: CYRANO_LAYER2_TIER_DISPLAY[tier],
      content_mode: contentMode,
      expires_at_utc: expiresAt.toISOString(),
      correlation_id: correlationId,
      reason_code: 'TIER_AUTHORIZED',
      rule_applied_id: CYRANO_LAYER2_RULE_APPLIED_ID,
    };

    this.logger.log('CyranoAuthService.establishSession: GRANTED', {
      session_id: granted.session_id,
      user_id: granted.user_id,
      resolved_tier: granted.resolved_tier,
      content_mode: granted.content_mode,
      correlation_id: granted.correlation_id,
      rule_applied_id: granted.rule_applied_id,
      organization_id: input.organization_id,
      tenant_id: input.tenant_id,
    });

    this.natsService.publish(NATS_TOPICS.CYRANO_LAYER2_SESSION_GRANTED, {
      session_id: granted.session_id,
      user_id: granted.user_id,
      resolved_tier: granted.resolved_tier,
      content_mode: granted.content_mode,
      expires_at_utc: granted.expires_at_utc,
      correlation_id: granted.correlation_id,
      reason_code: granted.reason_code,
      rule_applied_id: granted.rule_applied_id,
      organization_id: input.organization_id,
      tenant_id: input.tenant_id,
      timestamp: issuedAt.toISOString(),
      timezone: 'America/Toronto',
    });

    return granted;
  }
}
