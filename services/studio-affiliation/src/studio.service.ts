// services/studio-affiliation/src/studio.service.ts
// STUDIO-AFF-001 — StudioService (full implementation).
//
// FIZ NOTE: Every Studio and StudioAffiliation mutation touches governance-bearing rows.
// All writes MUST include correlation_id, reason_code, rule_applied_id, organization_id,
// tenant_id. The affiliate() method operates in a $transaction — all-or-nothing.
// No partial studio without a founder affiliation; no partial affiliation without a studio.

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core-api/src/prisma.service';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { AffiliationNumberGenerator } from './affiliation-number.generator';

export interface StudioRecord {
  id: string;
  name: string;
  affiliation_number: string;
  status: string;
}

export interface AffiliationRequest {
  creator_id: string;
  studio_name?: string;
  existing_studio_id?: string;
  organization_id: string;
  tenant_id: string;
  correlation_id: string;
}

export interface AffiliationResult {
  studio: StudioRecord;
  affiliation_number: string;
}

// NATS subject for studio affiliation events
const NATS_STUDIO_AFFILIATED = 'nats.studios.affiliated';

@Injectable()
export class StudioService {
  private readonly logger = new Logger(StudioService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly nats: NatsService,
    private readonly affiliationNumberGenerator: AffiliationNumberGenerator,
  ) {}

  /** Look up a Studio by its 6–9 char alphanumeric affiliation number. */
  async findByAffiliationNumber(affiliation_number: string): Promise<StudioRecord | null> {
    const studio = await this.prisma.studio.findUnique({
      where: { affiliation_number },
      select: {
        id: true,
        name: true,
        affiliation_number: true,
        status: true,
      },
    });
    return studio ?? null;
  }

  /**
   * Affiliate a creator with a studio.
   *
   * Two paths:
   *   A) existing_studio_id given — join an existing ACTIVE studio as CREATOR.
   *   B) studio_name given — create a new Studio (PENDING) + founder StudioAffiliation (OWNER).
   *
   * All rows are written inside a single $transaction (all-or-nothing).
   * Emits `nats.studios.affiliated` with a redacted payload after commit.
   *
   * FIZ-scoped: every row must carry correlation_id, reason_code, rule_applied_id,
   * organization_id, tenant_id per OQMI_GOVERNANCE invariants.
   */
  async affiliate(request: AffiliationRequest): Promise<AffiliationResult> {
    const { creator_id, studio_name, existing_studio_id, organization_id, tenant_id, correlation_id } = request;

    if (!existing_studio_id && !studio_name) {
      throw new Error('AffiliationRequest must provide either existing_studio_id or studio_name');
    }
    if (existing_studio_id && studio_name) {
      throw new Error('AffiliationRequest must provide either existing_studio_id or studio_name — not both');
    }

    let resultStudio: StudioRecord;
    let affiliationNumber: string;

    if (existing_studio_id) {
      // ── Path A: Join existing studio ────────────────────────────────────────
      const result = await this.prisma.$transaction(async (tx) => {
        const studio = await tx.studio.findUniqueOrThrow({
          where: { id: existing_studio_id },
          select: { id: true, name: true, affiliation_number: true, status: true },
        });

        if (studio.status !== 'ACTIVE') {
          throw new Error(
            `Studio ${existing_studio_id} is not ACTIVE (status: ${studio.status}) — cannot affiliate`,
          );
        }

        const affiliation = await tx.studioAffiliation.create({
          data: {
            studio_id: studio.id,
            creator_id,
            role: 'CREATOR',
            status: 'ACTIVE',
            correlation_id,
            reason_code: 'STUDIO_AFFILIATE_JOIN',
            rule_applied_id: 'STUDIO-AFF-001',
            organization_id,
            tenant_id,
          },
        });

        this.logger.log(
          `Creator ${creator_id} affiliated with studio ${studio.id} (affiliation: ${affiliation.id}, correlation_id: ${correlation_id})`,
        );

        return { studio, affiliation };
      });

      resultStudio = result.studio;
      affiliationNumber = result.studio.affiliation_number;
    } else {
      // ── Path B: Create new studio + founder affiliation ──────────────────────
      const studioCount = await this.prisma.studio.count();

      const generatedNumber = await this.affiliationNumberGenerator.generateUnique(
        studioCount,
        async (candidate) => {
          const existing = await this.prisma.studio.findUnique({
            where: { affiliation_number: candidate },
            select: { id: true },
          });
          return existing === null;
        },
      );

      const result = await this.prisma.$transaction(async (tx) => {
        // Double-check uniqueness inside the transaction before inserting
        const conflict = await tx.studio.findUnique({
          where: { affiliation_number: generatedNumber },
          select: { id: true },
        });
        if (conflict) {
          throw new Error(
            `Affiliation number collision at transaction time: "${generatedNumber}" — retry`,
          );
        }

        const studio = await tx.studio.create({
          data: {
            name: studio_name!,
            affiliation_number: generatedNumber,
            status: 'PENDING',
            organization_id,
            tenant_id,
            correlation_id,
            reason_code: 'STUDIO_CREATE',
            rule_applied_id: 'STUDIO-AFF-001',
          },
          select: { id: true, name: true, affiliation_number: true, status: true },
        });

        const affiliation = await tx.studioAffiliation.create({
          data: {
            studio_id: studio.id,
            creator_id,
            role: 'STUDIO_OWNER',
            status: 'ACTIVE',
            correlation_id: `${correlation_id}:founder`,
            reason_code: 'STUDIO_FOUNDER_AFFILIATION',
            rule_applied_id: 'STUDIO-AFF-001',
            organization_id,
            tenant_id,
          },
        });

        this.logger.log(
          `Studio created: id=${studio.id} aff_num=${studio.affiliation_number} creator=${creator_id} affiliation=${affiliation.id}`,
        );

        return { studio, affiliation };
      });

      resultStudio = result.studio;
      affiliationNumber = result.studio.affiliation_number;
    }

    // Emit NATS event — redacted payload (no PII/financials)
    await this.nats.publish(NATS_STUDIO_AFFILIATED, {
      studio_id: resultStudio.id,
      affiliation_number: affiliationNumber,
      correlation_id,
    });

    return { studio: resultStudio, affiliation_number: affiliationNumber };
  }
}
