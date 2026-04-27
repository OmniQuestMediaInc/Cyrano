// services/studio-affiliation/src/studio-dashboard.controller.ts
// RBAC-STUDIO-001 — read-only dashboard surface for the Studio UI.
//
// Aggregates the three projections a STUDIO_OWNER / STUDIO_ADMIN needs:
//   GET /studio-dashboard/:studio_id
//      → studio summary + roster + commission view + contract count
//
// Per spec: "read-only roster, progress tracking, commission view".
// Writes happen elsewhere (StudioController + StudioContractController).

import { Controller, Get, Logger, Param } from '@nestjs/common';
import { StudioCommissionService, CommissionView } from './studio-commission.service';
import { StudioContractService, ContractPublic } from './studio-contract.service';
import { StudioService } from './studio.service';
import { AffiliationPublic, StudioPublic } from './dto/studio.dto';

export interface StudioDashboardView {
  studio: StudioPublic;
  roster: AffiliationPublic[];
  commission: CommissionView;
  contracts: {
    total: number;
    signed: number;
    pending_signature: number;
    recent: ContractPublic[];
  };
  rule_applied_id: string;
}

@Controller('studio-dashboard')
export class StudioDashboardController {
  private readonly logger = new Logger(StudioDashboardController.name);

  constructor(
    private readonly studios: StudioService,
    private readonly commission: StudioCommissionService,
    private readonly contracts: StudioContractService,
  ) {}

  @Get(':studio_id')
  async getDashboard(@Param('studio_id') studioId: string): Promise<StudioDashboardView> {
    this.logger.log('StudioDashboardController.getDashboard', { studio_id: studioId });

    const [studio, roster, commission, allContracts] = await Promise.all([
      this.studios.findById(studioId),
      this.studios.listAffiliations(studioId),
      this.commission.getView(studioId),
      this.contracts.listByStudio(studioId),
    ]);

    const signed = allContracts.filter((c) => c.status === 'SIGNED').length;
    const pending = allContracts.filter((c) => c.status === 'UPLOADED').length;

    return {
      studio,
      roster,
      commission,
      contracts: {
        total: allContracts.length,
        signed,
        pending_signature: pending,
        recent: allContracts.slice(0, 10),
      },
      rule_applied_id: 'STUDIO_AFFILIATION_v1',
    };
  }
}
