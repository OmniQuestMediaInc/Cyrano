// WO: WO-INIT-001
import { Module } from '@nestjs/common';
import { RegionSignalService } from './region-signal.service';

@Module({
  providers: [RegionSignalService],
  exports: [RegionSignalService],
})
export class RiskModule {}
