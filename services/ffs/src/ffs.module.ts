// FFS — Flicker n'Flame Scoring: module
// NatsModule and PrismaModule are global — no local import needed.
import { Module } from '@nestjs/common';
import { FfsController } from './ffs.controller';
import { FfsService } from './ffs.service';

@Module({
  controllers: [FfsController],
  providers:   [FfsService],
  exports:     [FfsService],
})
export class FfsModule {}
