// services/creator-onboarding/src/creator-onboarding.service.ts
// RBAC-STUDIO-001 — Creator onboarding service.
//
// Orchestrates the full flow:
//   start()        — accept secondary email, run domain block check, dispatch
//                    verification code, create or join a Studio via
//                    StudioService.affiliate(), mirror affiliation_number,
//                    set status=AFFILIATED.
//   verifyEmail()  — 6-digit code check (TTL 10 min, 5 attempts max)
//   complete()     — promote AFFILIATED → COMPLETE once email is verified
//                    AND the studio is ACTIVE.
//
// Verification codes are kept in-memory for the MVP (matches existing
// patterns in services/notification). Production swaps in a Redis backed
// store via the same interface.

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomInt, randomUUID } from 'crypto';
import type { CreatorOnboarding } from '@prisma/client';
import { PrismaService } from '../../core-api/src/prisma.service';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { ImmutableAuditService } from '../../core-api/src/audit/immutable-audit.service';
import { NotificationEngine } from '../../notification/src/notification.service';
import { NATS_TOPICS } from '../../nats/topics.registry';
import { StudioService } from '../../studio-affiliation/src/studio.service';
import { checkEmailDomain } from './email-domain.policy';
import {
  OnboardingPublic,
  StartOnboardingDto,
  StartOnboardingResponse,
  VerifyEmailDto,
  VerifyEmailResponse,
  toOnboardingPublic,
} from './dto/onboarding.dto';

export const ONBOARDING_RULE_ID = 'STUDIO_AFFILIATION_v1';

/** In-memory verification code store. Swap for Redis in production. */
interface CodeRecord {
  code: string;
  issued_at_ms: number;
  attempts: number;
}

@Injectable()
export class CreatorOnboardingService {
  private readonly logger = new Logger(CreatorOnboardingService.name);
  private readonly RULE_ID = ONBOARDING_RULE_ID;
  private readonly CODE_TTL_MS = 10 * 60 * 1000;
  private readonly MAX_ATTEMPTS = 5;

  /** keyed by creator_id — single in-flight code per creator. */
  private readonly codeStore = new Map<string, CodeRecord>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly nats: NatsService,
    private readonly audit: ImmutableAuditService,
    private readonly notifications: NotificationEngine,
    private readonly studios: StudioService,
  ) {}

  // ────────────────────────────────────────────────────────────────────────
  // Reads
  // ────────────────────────────────────────────────────────────────────────

  async findByCreator(creatorId: string): Promise<OnboardingPublic | null> {
    const row = await this.prisma.creatorOnboarding.findUnique({
      where: { creator_id: creatorId },
    });
    return row ? toOnboardingPublic(row) : null;
  }

  // ────────────────────────────────────────────────────────────────────────
  // Writes
  // ────────────────────────────────────────────────────────────────────────

  async start(dto: StartOnboardingDto): Promise<StartOnboardingResponse> {
    if (!dto.affiliation_number && !dto.new_studio_name) {
      throw new BadRequestException(
        'ONBOARDING_INPUT: must supply affiliation_number OR new_studio_name',
      );
    }
    if (dto.affiliation_number && dto.new_studio_name) {
      throw new BadRequestException(
        'ONBOARDING_INPUT: affiliation_number and new_studio_name are mutually exclusive',
      );
    }

    const correlation_id = dto.correlation_id ?? `onboard_${randomUUID()}`;
    const creator = await this.prisma.creator.findUnique({ where: { id: dto.creator_id } });
    if (!creator) throw new NotFoundException(`CREATOR_NOT_FOUND: ${dto.creator_id}`);

    // 1. Domain block check.
    const domain = checkEmailDomain(dto.secondary_email);
    if (domain.blocked) {
      const blockedRow = await this.upsertOnboarding({
        creator_id: dto.creator_id,
        secondary_email: dto.secondary_email,
        email_block_reason: domain.reason ?? 'STUDIO_DOMAIN_BLOCKED',
        status: 'PENDING',
        correlation_id,
        organization_id: dto.organization_id,
        tenant_id: dto.tenant_id,
        reason_code: 'EMAIL_DOMAIN_BLOCKED',
      });
      await this.audit.emit({
        eventType: 'RBAC_DECISION',
        correlationId: correlation_id,
        actorId: dto.creator_id,
        actorRole: 'creator',
        reasonCode: 'EMAIL_DOMAIN_BLOCKED',
        redactedPayload: { domain: domain.domain },
        metadata: { rule: this.RULE_ID },
      });
      return {
        onboarding: toOnboardingPublic(blockedRow),
        studio_id: null,
        affiliation_number: null,
        email_dispatch_id: '',
        email_blocked: true,
        email_block_reason: domain.reason,
        correlation_id,
        rule_applied_id: this.RULE_ID,
      };
    }

    // 2. Resolve target studio (existing via affiliation_number, or new).
    let studio_id: string | undefined;
    if (dto.affiliation_number) {
      const studio = await this.studios.findByAffiliationNumber(
        dto.affiliation_number,
      );
      if (!studio) {
        throw new BadRequestException(
          `ONBOARDING_AFFILIATION_INVALID: ${dto.affiliation_number}`,
        );
      }
      studio_id = studio.id;
    }

    // 3. Affiliate (delegates Studio creation when new_studio_name is present).
    const affiliation = await this.studios.affiliate({
      creator_id: dto.creator_id,
      studio_name: dto.new_studio_name,
      existing_studio_id: studio_id,
      organization_id: dto.organization_id,
      tenant_id: dto.tenant_id,
      correlation_id,
    });

    // 4. Persist / update the onboarding row.
    const onboarding = await this.upsertOnboarding({
      creator_id: dto.creator_id,
      studio_id: affiliation.studio.id,
      affiliation_number: affiliation.affiliation_number,
      secondary_email: dto.secondary_email,
      status: 'AFFILIATED',
      correlation_id,
      organization_id: dto.organization_id,
      tenant_id: dto.tenant_id,
      reason_code: 'CREATOR_AFFILIATED',
    });

    // 5. Issue + dispatch the verification code email — also includes the
    //    Affiliation Number (per spec §2 Delivery).
    const code = this.issueCode(dto.creator_id);
    const email = await this.notifications.send({
      user_id: dto.creator_id,
      channel: 'EMAIL',
      template: 'STUDIO_AFFILIATION_NUMBER_ASSIGNED',
      payload: {
        affiliation_number: affiliation.affiliation_number,
        studio_id: affiliation.studio.id,
        studio_name: affiliation.studio.name,
        verification_code: code,
        instructions:
          'Use this Affiliation Number to verify your studio affiliation when logging in.',
      },
      correlation_id,
    });

    this.nats.publish(NATS_TOPICS.AFFILIATION_NUMBER_DELIVERED, {
      creator_id: dto.creator_id,
      studio_id: affiliation.studio.id,
      affiliation_number: affiliation.affiliation_number,
      dispatch_id: email.dispatch_id,
      correlation_id,
      rule_applied_id: this.RULE_ID,
    });
    this.nats.publish(NATS_TOPICS.CREATOR_ONBOARDING_AFFILIATED, {
      creator_id: dto.creator_id,
      studio_id: affiliation.studio.id,
      affiliation_number: affiliation.affiliation_number,
      correlation_id,
      rule_applied_id: this.RULE_ID,
    });

    await this.audit.emit({
      eventType: 'RBAC_DECISION',
      correlationId: `${correlation_id}:onboarding_started`,
      actorId: dto.creator_id,
      actorRole: 'creator',
      reasonCode: 'CREATOR_ONBOARDING_STARTED',
      redactedPayload: {
        studio_id: affiliation.studio.id,
        affiliation_number: affiliation.affiliation_number,
        // domain hashed — never log the raw email
        secondary_email_domain: domain.domain,
      },
      metadata: { rule: this.RULE_ID },
    });

    return {
      onboarding: toOnboardingPublic(onboarding),
      studio_id: affiliation.studio.id,
      affiliation_number: affiliation.affiliation_number,
      email_dispatch_id: email.dispatch_id,
      email_blocked: false,
      email_block_reason: null,
      correlation_id,
      rule_applied_id: this.RULE_ID,
    };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<VerifyEmailResponse> {
    const correlation_id = dto.correlation_id ?? `onboard_verify_${randomUUID()}`;
    const onboarding = await this.prisma.creatorOnboarding.findUnique({
      where: { creator_id: dto.creator_id },
    });
    if (!onboarding) throw new NotFoundException('ONBOARDING_NOT_FOUND');

    const record = this.codeStore.get(dto.creator_id);
    if (!record) {
      return this.failVerify(onboarding, 'NO_CODE_ISSUED', correlation_id);
    }
    if (Date.now() - record.issued_at_ms > this.CODE_TTL_MS) {
      this.codeStore.delete(dto.creator_id);
      return this.failVerify(onboarding, 'CODE_EXPIRED', correlation_id);
    }
    if (record.attempts >= this.MAX_ATTEMPTS) {
      this.codeStore.delete(dto.creator_id);
      return this.failVerify(onboarding, 'TOO_MANY_ATTEMPTS', correlation_id);
    }
    record.attempts += 1;
    if (record.code !== dto.code) {
      return this.failVerify(onboarding, 'CODE_MISMATCH', correlation_id);
    }
    this.codeStore.delete(dto.creator_id);

    const updated = await this.prisma.creatorOnboarding.update({
      where: { creator_id: dto.creator_id },
      data: {
        email_verified_at: new Date(),
        correlation_id,
        reason_code: 'EMAIL_VERIFIED',
        rule_applied_id: this.RULE_ID,
      },
    });

    await this.audit.emit({
      eventType: 'STEP_UP_CHALLENGE',
      correlationId: correlation_id,
      actorId: dto.creator_id,
      actorRole: 'creator',
      reasonCode: 'ONBOARDING_EMAIL_VERIFIED',
      redactedPayload: { onboarding_id: onboarding.id },
      metadata: { rule: this.RULE_ID },
    });

    return {
      onboarding: toOnboardingPublic(updated),
      verified: true,
      reason: null,
    };
  }

  async complete(creator_id: string): Promise<OnboardingPublic> {
    const correlation_id = `onboard_complete_${randomUUID()}`;
    const onboarding = await this.prisma.creatorOnboarding.findUnique({
      where: { creator_id },
      include: { studio: true },
    });
    if (!onboarding) throw new NotFoundException('ONBOARDING_NOT_FOUND');
    if (onboarding.status === 'COMPLETE') return toOnboardingPublic(onboarding);
    if (!onboarding.email_verified_at) {
      throw new BadRequestException('ONBOARDING_EMAIL_NOT_VERIFIED');
    }
    if (!onboarding.studio || onboarding.studio.status !== 'ACTIVE') {
      throw new BadRequestException('ONBOARDING_STUDIO_NOT_ACTIVE');
    }

    const updated = await this.prisma.creatorOnboarding.update({
      where: { creator_id },
      data: {
        status: 'COMPLETE',
        correlation_id,
        reason_code: 'ONBOARDING_COMPLETE',
        rule_applied_id: this.RULE_ID,
      },
    });

    this.nats.publish(NATS_TOPICS.CREATOR_ONBOARDING_COMPLETED, {
      creator_id,
      studio_id: updated.studio_id,
      affiliation_number: updated.affiliation_number,
      correlation_id,
      rule_applied_id: this.RULE_ID,
    });

    return toOnboardingPublic(updated);
  }

  // ────────────────────────────────────────────────────────────────────────
  // Internals
  // ────────────────────────────────────────────────────────────────────────

  private async upsertOnboarding(params: {
    creator_id: string;
    studio_id?: string;
    affiliation_number?: string;
    secondary_email: string;
    email_block_reason?: string;
    status: 'PENDING' | 'AFFILIATED' | 'COMPLETE';
    correlation_id: string;
    organization_id: string;
    tenant_id: string;
    reason_code: string;
  }): Promise<CreatorOnboarding> {
    return this.prisma.creatorOnboarding.upsert({
      where: { creator_id: params.creator_id },
      create: {
        creator_id: params.creator_id,
        studio_id: params.studio_id ?? null,
        affiliation_number: params.affiliation_number ?? null,
        secondary_email: params.secondary_email,
        email_block_reason: params.email_block_reason ?? null,
        status: params.status,
        correlation_id: params.correlation_id,
        reason_code: params.reason_code,
        rule_applied_id: this.RULE_ID,
        organization_id: params.organization_id,
        tenant_id: params.tenant_id,
      },
      update: {
        studio_id: params.studio_id ?? null,
        affiliation_number: params.affiliation_number ?? null,
        secondary_email: params.secondary_email,
        email_block_reason: params.email_block_reason ?? null,
        status: params.status,
        correlation_id: params.correlation_id,
        reason_code: params.reason_code,
        rule_applied_id: this.RULE_ID,
      },
    });
  }

  private issueCode(creator_id: string): string {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    this.codeStore.set(creator_id, {
      code,
      issued_at_ms: Date.now(),
      attempts: 0,
    });
    this.logger.log('CreatorOnboardingService: code issued', {
      creator_id,
      ttl_ms: this.CODE_TTL_MS,
      rule_applied_id: this.RULE_ID,
    });
    return code;
  }

  private failVerify(
    row: CreatorOnboarding,
    reason: string,
    correlation_id: string,
  ): VerifyEmailResponse {
    this.logger.warn('CreatorOnboardingService: verify failed', {
      creator_id: row.creator_id,
      reason,
      correlation_id,
    });
    return {
      onboarding: toOnboardingPublic(row),
      verified: false,
      reason,
    };
  }
}
