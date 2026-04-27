// services/core-api/src/compliance/compliance.module.ts
import { Module } from '@nestjs/common';
import { WormExportService } from './worm-export.service';
import { AuditChainService } from './audit-chain.service';
import { LegalHoldService } from './legal-hold.service';
import { ReconciliationService } from './reconciliation.service';

@Module({
  providers: [WormExportService, AuditChainService, LegalHoldService, ReconciliationService],
  exports: [WormExportService, AuditChainService, LegalHoldService, ReconciliationService],
})
export class ComplianceModule {}
