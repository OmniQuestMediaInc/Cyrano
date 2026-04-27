// services/studio-affiliation/src/studio-affiliation.module.ts
// RBAC-STUDIO-001 — wires Studio + Affiliation + Commission + Contract +
// StudioRbacGuard. Depends on:
//   - PrismaModule, NatsModule, AuditModule (all @Global from core-api)
//   - AffiliationNumberModule (this repo)
//   - AuthModule (for shared RBAC primitives — registered globally)
//   - NotificationEngine (for studio-related emails — provided here as a
//     direct provider; the upstream service is plain DI, not a Nest module)
import { Module } from '@nestjs/common';
import { AffiliationNumberModule } from '../../affiliation-number/src/affiliation-number.module';
import { NotificationEngine } from '../../notification/src/notification.service';
import { StudioCommissionService } from './studio-commission.service';
import { StudioContractService } from './studio-contract.service';
import { StudioContractController } from './studio-contract.controller';
import { StudioController } from './studio.controller';
import { StudioDashboardController } from './studio-dashboard.controller';
import { StudioRbacGuard } from './studio-rbac.guard';
import { StudioService } from './studio.service';

@Module({
  imports: [AffiliationNumberModule],
  controllers: [
    StudioController,
    StudioDashboardController,
    StudioContractController,
  ],
  providers: [
    StudioService,
    StudioCommissionService,
    StudioContractService,
    StudioRbacGuard,
    // NotificationEngine is plain @Injectable (no Nest module wrapper).
    NotificationEngine,
  ],
  exports: [StudioService, StudioRbacGuard, StudioCommissionService],
})
export class StudioAffiliationModule {}
