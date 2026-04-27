// services/core-api/src/audit/audit.module.ts
// WO-019: Audit dashboard.
// PAYLOAD 6: ImmutableAuditService + AuditBridgeService wired as the
// canonical hash-chained emission point for all sensitive actions.
// PrismaModule + NatsModule are @Global, so no explicit imports needed.
import { Global, Module } from '@nestjs/common';
import { AuditDashboardController } from './audit-dashboard.controller';
import { ImmutableAuditService } from './immutable-audit.service';
import { ImmutableAuditController } from './immutable-audit.controller';
import { AuditBridgeService } from './audit-bridge.service';

@Global()
@Module({
  controllers: [AuditDashboardController, ImmutableAuditController],
  providers: [ImmutableAuditService, AuditBridgeService],
  exports: [ImmutableAuditService, AuditBridgeService],
})
export class AuditModule {}
