// services/core-api/src/refund/refund.module.ts
// NatsModule and PrismaModule are @Global(), so no explicit imports needed.
import { Module } from '@nestjs/common';
import { RefundDisclosureService } from './refund-disclosure.service';
import { ExtensionService } from './extension.service';

@Module({
  providers: [RefundDisclosureService, ExtensionService],
  exports: [RefundDisclosureService, ExtensionService],
})
export class RefundModule {}
