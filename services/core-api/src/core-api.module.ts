import { Module } from '@nestjs/common';
import { StatementsService } from './creator/surfaces/statements.service';

@Module({
  providers: [StatementsService],
  exports: [StatementsService],
})
export class CoreApiModule {}
