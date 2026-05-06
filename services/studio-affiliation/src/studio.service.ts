// services/studio-affiliation/src/studio.service.ts
// RBAC-STUDIO-001 — StudioService (initial scaffold).
//
// Status: SCAFFOLD. findByAffiliationNumber() is wired against the Prisma
// schema and is safe to call. affiliate() is intentionally NOT IMPLEMENTED
// — it requires the affiliation-number generator + transactional studio
// creation/join, both of which are scheduled in a follow-up directive
// (see PROGRAM_CONTROL/DIRECTIVES/QUEUE/STUDIO-AFF-001-IMPL.md).
//
// FIZ NOTE: every studio mutation must populate correlation_id, reason_code,
// rule_applied_id, organization_id, tenant_id (per Prisma schema). The
// affiliate() implementation owes a FIZ-prefixed commit when delivered.

import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { PrismaService } from '../../core-api/src/prisma.service';

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

@Injectable()
export class StudioService {
  private readonly logger = new Logger(StudioService.name);

  constructor(private readonly prisma: PrismaService) {}

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
   * Affiliate a creator with a studio (existing or new).
   *
   * NOT YET IMPLEMENTED — see STUDIO-AFF-001-IMPL directive. Throws to make
   * the unsupported path obvious in dev/staging instead of silently no-op'ing.
   */
  async affiliate(_request: AffiliationRequest): Promise<AffiliationResult> {
    this.logger.error(
      'StudioService.affiliate called before implementation lands; see STUDIO-AFF-001-IMPL directive',
    );
    throw new NotImplementedException(
      'STUDIO_AFFILIATE_NOT_IMPLEMENTED: pending directive STUDIO-AFF-001-IMPL',
    );
  }
}
