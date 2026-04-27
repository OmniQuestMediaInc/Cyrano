// PAYLOAD 2 — Recovery module wiring.
import { Module } from '@nestjs/common';
import { RecoveryEngine } from './recovery.service';
import { AdminRecoveryController } from './admin-recovery.controller';
import { DiamondConciergeModule } from '../../diamond-concierge/src/diamond-concierge.module';

@Module({
  imports: [DiamondConciergeModule],
  providers: [RecoveryEngine],
  controllers: [AdminRecoveryController],
  exports: [RecoveryEngine],
})
export class RecoveryModule {}
