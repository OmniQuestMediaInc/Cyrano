// PAYLOAD 2 — Diamond Concierge module wiring.
import { Module } from '@nestjs/common';
import { DiamondConciergeService } from './diamond.service';

@Module({
  providers: [DiamondConciergeService],
  exports: [DiamondConciergeService],
})
export class DiamondConciergeModule {}
