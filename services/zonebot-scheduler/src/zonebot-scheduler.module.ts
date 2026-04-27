// services/zonebot-scheduler/src/zonebot-scheduler.module.ts
// WO-002: HCZ ZoneBot Zoey — NestJS module declaration.
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ZonebotSchedulingService } from './zonebot-scheduler.service';
import { ZonebotSchedulerController } from './zonebot-scheduler.controller';
import { CreatorRateDay61Job } from './creator-rate-day61.job';

@Module({
  imports: [PrismaModule],
  controllers: [ZonebotSchedulerController],
  providers: [ZonebotSchedulingService, CreatorRateDay61Job],
  exports: [ZonebotSchedulingService, CreatorRateDay61Job],
})
export class ZonebotSchedulerModule {}
