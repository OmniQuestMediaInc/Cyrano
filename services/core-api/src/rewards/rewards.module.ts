// FIZ: PAYLOAD-012 — RewardsModule
// Wires the CNZ-side bundle controller + RRR client + the in-process
// PointsPurchaseService / RedRoomLedgerService it bridges to.

import { Module } from '@nestjs/common';
import { PointsController } from './points.controller';
import { RrrClientService } from './rrr-client.service';
import { PointsPurchaseService } from '../../../rewards-api/src/services/points-purchase.service';
import { RedRoomLedgerService } from '../../../rewards-api/src/services/redroom-ledger.service';

@Module({
  controllers: [PointsController],
  providers: [RrrClientService, PointsPurchaseService, RedRoomLedgerService],
  exports: [RrrClientService],
})
export class RewardsModule {}
