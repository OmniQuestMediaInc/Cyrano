// FIZ: MEMB-002 — MembershipModule
// Provides MembershipService for tier resolution and subscription lifecycle.
// FIZ: MEMB-003 — adds StipendDistributionJob for monthly CZT grants.
import { Module } from '@nestjs/common';
import { MembershipService } from './membership.service';
import { StipendDistributionJob } from './stipend-distribution.job';
import { LedgerModule } from '../finance/ledger.module';

@Module({
  imports: [LedgerModule],
  providers: [MembershipService, StipendDistributionJob],
  exports: [MembershipService, StipendDistributionJob],
})
export class MembershipModule {}
