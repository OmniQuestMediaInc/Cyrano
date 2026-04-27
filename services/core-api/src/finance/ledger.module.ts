// Latest implementation details for the ledger module

import { Module } from '@nestjs/common';
import { LedgerService } from './ledger.service';

@Module({
  imports: [],
  providers: [LedgerService],
  exports: [LedgerService],
})
export class LedgerModule {}
