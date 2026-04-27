// Payload #13 — CNZ × RedRoomRewards micro-gift integration
// GiftsModule wires GiftController + RrrClientService.
import { Module } from '@nestjs/common';
import { GiftController } from './gift.controller';
import { RrrClientService } from './rrr-client.service';

@Module({
  controllers: [GiftController],
  providers: [RrrClientService],
  exports: [RrrClientService],
})
export class GiftsModule {}
