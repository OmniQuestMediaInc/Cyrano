// WO: WO-INIT-001
import { Module } from '@nestjs/common';
import { StatementsController } from './statements.controller';
import { StatementsService } from './statements.service';

@Module({
  controllers: [StatementsController],
  providers: [StatementsService],
})
export class CreatorModule {}
