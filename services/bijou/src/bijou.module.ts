// services/bijou/src/bijou.module.ts
// BIJOU: BJ-002 — register BijouSchedulerService.
// BIJOU: BJ-003 — register BijouAdmissionService.
// BIJOU: BJ-004 — register BijouDwellService.
import { Module } from '@nestjs/common';
import { BijouSessionService } from './bijou-session.service';
import { PassPricingService } from './pass-pricing.service';
import { MinSeatGateService } from './min-seat-gate.service';
import { BijouSchedulerService } from './bijou-scheduler.service';
import { BijouAdmissionService } from './bijou-admission.service';
import { BijouDwellService } from './bijou-dwell.service';
import { LedgerModule } from '../../core-api/src/finance/ledger.module';

@Module({
  imports: [LedgerModule],
  providers: [
    BijouSessionService,
    PassPricingService,
    MinSeatGateService,
    BijouSchedulerService,
    BijouAdmissionService,
    BijouDwellService,
  ],
  exports: [
    BijouSessionService,
    PassPricingService,
    MinSeatGateService,
    BijouSchedulerService,
    BijouAdmissionService,
    BijouDwellService,
  ],
})
export class BijouModule {}
