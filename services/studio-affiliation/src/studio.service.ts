// services/studio-affiliation/src/studio.service.ts
// RBAC-STUDIO-001 — Studio + StudioAffiliation domain service.
//
// Implements the full assignment-to-studio flow from the technical spec:
//   1. POST /studios/affiliate (creator requests affiliation)
//      → Studio created PENDING (or existing studio looked up)
//      → AffiliationNumberService.generate() → unique 6-9 char code
//      → StudioAffiliation row created (STUDIO_OWNER for first creator,
//        otherwise CREATOR)
//      → creator.affiliation_number mirror updated
//      → ImmutableAuditService event + STUDIO_CREATED / STUDIO_AFFILIATION_GRANTED
//        NATS topics published
//   2. PATCH /studios/:id/activate transitions PENDING → ACTIVE
//   3. PATCH /studios/:id/commission writes commission_rate (PLATFORM_ADMIN only)
//
// Every write carries:
//   - correlation_id (idempotent across retries of the same business event)
//   - reason_code   (human-grep-able classifier)
//   - rule_applied_id = STUDIO_AFFILIATION_v1

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import Decimal from 'decimal.js';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../core-api/src/prisma.service';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { ImmutableAuditService } from '../../core-api/src/audit/immutable-audit.service';
import { NATS_TOPICS } from '../../nats/topics.registry';
import { AffiliationNumberService } from '../../affiliation-number/src/affiliation-number.service';
import {
  AffiliateRequestDto,
  AffiliateResponseDto,
  ActivateStudioRequestDto,
  SetCommissionRequestDto,
  StudioPublic,
  AffiliationPublic,
  toAffiliationPublic,
  toStudioPublic,
} from './dto/studio.dto';

export const STUDIO_RULE_ID = 'STUDIO_AFFILIATION_v1';

@Injectable()
export class StudioService {
  private readonly logger = new Logger(StudioService.name);
  private readonly RULE_ID = STUDIO_RULE_ID;

  constructor(
    private readonly prisma: PrismaService,
    private readonly nats: NatsService,
    private readonly audit: ImmutableAuditService,
    private readonly affiliationNumbers: AffiliationNumberService,
  ) {}

  // ────────────────────────────────────────────────────────────────────────
  // Reads
  // ────────────────────────────────────────────────────────────────────────

  async findById(studioId: string): Promise<StudioPublic> {
    const row = await this.prisma.studio.findUnique({ where: { id: studioId } });
    if (!row) throw new NotFoundException(`STUDIO_NOT_FOUND: ${studioId}`);
    return toStudioPublic(row);
  }

  async findByAffiliationNumber(affiliationNumber: string): Promise<StudioPublic | null> {
    const row = await this.prisma.studio.findUnique({
      where: { affiliation_number: affiliationNumber },
    });
    return row ? toStudioPublic(row) : null;
  }

  async listAffiliations(studioId: string): Promise<AffiliationPublic[]> {
    await this.findById(studioId); // 404 guard
    const rows = await this.prisma.studioAffiliation.findMany({
      where: { studio_id: studioId },
      orderBy: { joined_at: 'asc' },
    });
    return rows.map(toAffiliationPublic);
  }

  async getCreatorAffiliation(
    creatorId: string,
    studioId: string,
  ): Promise<AffiliationPublic | null> {
    const row = await this.prisma.studioAffiliation.findUnique({
      where: { studio_id_creator_id: { studio_id: studioId, creator_id: creatorId } },
    });
    return row ? toAffiliationPublic(row) : null;
  }

  // ────────────────────────────────────────────────────────────────────────
  // Writes
  // ────────────────────────────────────────────────────────────────────────

  /**
   * The canonical assignment-to-studio entrypoint.
   * - studio_name:        creates a new PENDING studio + STUDIO_OWNER affiliation
   * - existing_studio_id: joins an existing studio as CREATOR
   * Always emits an ImmutableAudit row (STUDIO_AFFILIATION_GRANTED) and
   * publishes STUDIO_CREATED + STUDIO_AFFILIATION_GRANTED NATS messages.
   */
  async affiliate(req: AffiliateRequestDto): Promise<AffiliateResponseDto> {
    if (!req.studio_name && !req.existing_studio_id) {
      throw new BadRequestException(
        'STUDIO_AFFILIATE_INPUT: must supply studio_name OR existing_studio_id',
      );
    }
    if (req.studio_name && req.existing_studio_id) {
      throw new BadRequestException(
        'STUDIO_AFFILIATE_INPUT: studio_name and existing_studio_id are mutually exclusive',
      );
    }

    const correlation_id = req.correlation_id ?? `studio_aff_${randomUUID()}`;

    // 1. Verify the creator exists (defensive — FK would catch but message is nicer).
    const creator = await this.prisma.creator.findUnique({ where: { id: req.creator_id } });
    if (!creator) throw new NotFoundException(`CREATOR_NOT_FOUND: ${req.creator_id}`);

    // 2. Resolve or create the Studio.
    const { studio, isNewStudio } = req.studio_name
      ? await this.createPendingStudio({
          name: req.studio_name,
          organization_id: req.organization_id,
          tenant_id: req.tenant_id,
          correlation_id,
        })
      : await this.loadExistingStudio(req.existing_studio_id as string);

    // 3. Idempotency — if the creator is already affiliated, return the same row.
    const existing = await this.prisma.studioAffiliation.findUnique({
      where: { studio_id_creator_id: { studio_id: studio.id, creator_id: creator.id } },
    });
    if (existing) {
      this.logger.log('StudioService.affiliate: existing affiliation — returning', {
        studio_id: studio.id,
        creator_id: creator.id,
        affiliation_id: existing.id,
        correlation_id,
        rule_applied_id: this.RULE_ID,
      });
      return {
        studio: toStudioPublic(studio),
        affiliation: toAffiliationPublic(existing),
        affiliation_number: studio.affiliation_number,
        correlation_id,
        rule_applied_id: this.RULE_ID,
      };
    }

    // 4. Determine role — first affiliate of a studio becomes STUDIO_OWNER.
    const role: 'STUDIO_OWNER' | 'CREATOR' = isNewStudio ? 'STUDIO_OWNER' : 'CREATOR';

    // 5. Create the affiliation row + mirror affiliation_number to creator.
    const affiliation = await this.prisma.$transaction(async (tx) => {
      const created = await tx.studioAffiliation.create({
        data: {
          studio_id: studio.id,
          creator_id: creator.id,
          role,
          status: 'ACTIVE',
          correlation_id,
          reason_code: isNewStudio
            ? 'STUDIO_OWNER_BOOTSTRAP'
            : 'CREATOR_JOIN_EXISTING',
          rule_applied_id: this.RULE_ID,
          organization_id: req.organization_id,
          tenant_id: req.tenant_id,
        },
      });
      await tx.creator.update({
        where: { id: creator.id },
        data: { affiliation_number: studio.affiliation_number },
      });
      return created;
    });

    // 6. Audit + NATS — both keyed off correlation_id for idempotent fan-out.
    await this.audit.emit({
      eventType: 'RBAC_DECISION',
      correlationId: correlation_id,
      actorId: creator.id,
      actorRole: 'creator',
      reasonCode: affiliation.reason_code,
      redactedPayload: {
        studio_id: studio.id,
        affiliation_number: studio.affiliation_number,
        role,
        is_new_studio: isNewStudio,
      },
      metadata: {
        rule: this.RULE_ID,
        organization_id: req.organization_id,
      },
    });

    if (isNewStudio) {
      this.nats.publish(NATS_TOPICS.STUDIO_CREATED, {
        studio_id: studio.id,
        affiliation_number: studio.affiliation_number,
        organization_id: studio.organization_id,
        correlation_id,
        rule_applied_id: this.RULE_ID,
      });
    }
    this.nats.publish(NATS_TOPICS.STUDIO_AFFILIATION_GRANTED, {
      studio_id: studio.id,
      creator_id: creator.id,
      role,
      affiliation_number: studio.affiliation_number,
      correlation_id,
      rule_applied_id: this.RULE_ID,
    });

    return {
      studio: toStudioPublic(studio),
      affiliation: toAffiliationPublic(affiliation),
      affiliation_number: studio.affiliation_number,
      correlation_id,
      rule_applied_id: this.RULE_ID,
    };
  }

  async activate(studioId: string, req: ActivateStudioRequestDto): Promise<StudioPublic> {
    const correlation_id = req.correlation_id ?? `studio_act_${randomUUID()}`;
    const before = await this.prisma.studio.findUnique({ where: { id: studioId } });
    if (!before) throw new NotFoundException(`STUDIO_NOT_FOUND: ${studioId}`);
    if (before.status === 'ACTIVE') {
      // Idempotent — return existing.
      return toStudioPublic(before);
    }
    if (before.status === 'CLOSED') {
      throw new BadRequestException('STUDIO_ACTIVATE_INVALID: studio is CLOSED');
    }

    const updated = await this.prisma.studio.update({
      where: { id: studioId },
      data: {
        status: 'ACTIVE',
        correlation_id,
        reason_code: req.reason ?? 'STUDIO_ACTIVATION',
        rule_applied_id: this.RULE_ID,
      },
    });

    await this.audit.emit({
      eventType: 'RBAC_DECISION',
      correlationId: correlation_id,
      actorId: req.actor_id,
      actorRole: 'admin',
      reasonCode: req.reason ?? 'STUDIO_ACTIVATION',
      redactedPayload: {
        studio_id: studioId,
        from_status: before.status,
        to_status: 'ACTIVE',
      },
      metadata: { rule: this.RULE_ID },
    });

    this.nats.publish(NATS_TOPICS.STUDIO_ACTIVATED, {
      studio_id: studioId,
      affiliation_number: updated.affiliation_number,
      correlation_id,
      rule_applied_id: this.RULE_ID,
    });

    return toStudioPublic(updated);
  }

  async setCommission(
    studioId: string,
    req: SetCommissionRequestDto,
  ): Promise<StudioPublic> {
    if (req.commission_rate < 0 || req.commission_rate > 1) {
      throw new BadRequestException(
        'STUDIO_COMMISSION_BOUNDS: commission_rate must be in [0, 1]',
      );
    }
    const correlation_id = req.correlation_id ?? `studio_comm_${randomUUID()}`;
    const before = await this.prisma.studio.findUnique({ where: { id: studioId } });
    if (!before) throw new NotFoundException(`STUDIO_NOT_FOUND: ${studioId}`);

    const updated = await this.prisma.studio.update({
      where: { id: studioId },
      data: {
        commission_rate: new Decimal(req.commission_rate),
        correlation_id,
        reason_code: req.reason ?? 'STUDIO_COMMISSION_UPDATE',
        rule_applied_id: this.RULE_ID,
      },
    });

    await this.audit.emit({
      eventType: 'RBAC_DECISION',
      correlationId: correlation_id,
      actorId: req.actor_id,
      actorRole: 'admin',
      reasonCode: 'STUDIO_COMMISSION_UPDATE',
      redactedPayload: {
        studio_id: studioId,
        from_rate: before.commission_rate.toString(),
        to_rate: updated.commission_rate.toString(),
      },
      metadata: { rule: this.RULE_ID },
    });

    this.nats.publish(NATS_TOPICS.STUDIO_COMMISSION_UPDATED, {
      studio_id: studioId,
      commission_rate: updated.commission_rate.toString(),
      correlation_id,
      rule_applied_id: this.RULE_ID,
    });

    return toStudioPublic(updated);
  }

  // ────────────────────────────────────────────────────────────────────────
  // Internals
  // ────────────────────────────────────────────────────────────────────────

  private async createPendingStudio(params: {
    name: string;
    organization_id: string;
    tenant_id: string;
    correlation_id: string;
  }): Promise<{ studio: Prisma.StudioGetPayload<Record<string, never>>; isNewStudio: true }> {
    const { affiliation_number } = await this.affiliationNumbers.generate({
      correlationId: params.correlation_id,
      existsCheck: async (candidate) => {
        const hit = await this.prisma.studio.findUnique({
          where: { affiliation_number: candidate },
          select: { id: true },
        });
        return hit !== null;
      },
    });

    const studio = await this.prisma.studio.create({
      data: {
        name: params.name,
        affiliation_number,
        status: 'PENDING',
        commission_rate: new Decimal(0),
        organization_id: params.organization_id,
        tenant_id: params.tenant_id,
        correlation_id: params.correlation_id,
        reason_code: 'STUDIO_BOOTSTRAP',
        rule_applied_id: this.RULE_ID,
      },
    });

    this.nats.publish(NATS_TOPICS.AFFILIATION_NUMBER_GENERATED, {
      studio_id: studio.id,
      affiliation_number,
      correlation_id: params.correlation_id,
      rule_applied_id: this.RULE_ID,
    });

    return { studio, isNewStudio: true };
  }

  private async loadExistingStudio(
    studioId: string,
  ): Promise<{ studio: Prisma.StudioGetPayload<Record<string, never>>; isNewStudio: false }> {
    const studio = await this.prisma.studio.findUnique({ where: { id: studioId } });
    if (!studio) throw new NotFoundException(`STUDIO_NOT_FOUND: ${studioId}`);
    if (studio.status === 'CLOSED') {
      throw new BadRequestException('STUDIO_AFFILIATE_INPUT: studio is CLOSED');
    }
    return { studio, isNewStudio: false };
  }
}
