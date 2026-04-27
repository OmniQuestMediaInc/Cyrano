// services/studio-affiliation/src/studio-commission.service.ts
// RBAC-STUDIO-001 — read model for studio commission.
//
// Per spec: "commission_rate is set by the platform only" — writes go through
// StudioService.setCommission (PLATFORM_ADMIN gated). This service exposes
// the read-side projection for the studio dashboard + read-side audit log.

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core-api/src/prisma.service';

export const COMMISSION_RULE_ID = 'STUDIO_AFFILIATION_v1';

export interface CommissionView {
  studio_id: string;
  affiliation_number: string;
  commission_rate: string;        // decimal string ("0.2500")
  commission_rate_pct: string;    // human ("25.00%")
  last_updated_at: string;
  rule_applied_id: string;
}

@Injectable()
export class StudioCommissionService {
  private readonly logger = new Logger(StudioCommissionService.name);
  private readonly RULE_ID = COMMISSION_RULE_ID;

  constructor(private readonly prisma: PrismaService) {}

  async getView(studioId: string): Promise<CommissionView> {
    const studio = await this.prisma.studio.findUnique({
      where: { id: studioId },
      select: {
        id: true,
        affiliation_number: true,
        commission_rate: true,
        updated_at: true,
      },
    });
    if (!studio) throw new NotFoundException(`STUDIO_NOT_FOUND: ${studioId}`);

    const rateStr = studio.commission_rate.toString();
    const pct = (Number(rateStr) * 100).toFixed(2) + '%';

    this.logger.log('StudioCommissionService.getView', {
      studio_id: studioId,
      rule_applied_id: this.RULE_ID,
    });

    return {
      studio_id: studio.id,
      affiliation_number: studio.affiliation_number,
      commission_rate: rateStr,
      commission_rate_pct: pct,
      last_updated_at: studio.updated_at.toISOString(),
      rule_applied_id: this.RULE_ID,
    };
  }
}
