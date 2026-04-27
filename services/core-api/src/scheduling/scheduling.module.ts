// services/core-api/src/scheduling/scheduling.module.ts
// GZ-SCHEDULE: NestJS module for the GuestZone scheduling system.
// Waterfall shifts, ZoneBot lottery, compliance guard, coverage validation,
// Bull queue automation (7 AM / 7 PM), and runtime seed services.
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { SchedulingService } from './scheduling.service';
import { ZoneBotService } from './zonebot.service';
import { ShiftCoverageService } from './shift-coverage.service';
import { ComplianceGuardService } from './compliance-guard.service';
import { SchedulingSeedService } from './scheduling-seed.service';
import { SchedulingQueueProcessor, SCHEDULING_QUEUE_NAME } from './scheduling-queue.processor';
import {
  SchedulePeriodController,
  ShiftAssignmentController,
  ZoneBotController,
  CoverageController,
  ComplianceController,
  ScheduleSeedController,
} from './scheduling.controller';

@Module({
  imports: [
    BullModule.registerQueue({
      name: SCHEDULING_QUEUE_NAME,
      redis: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      },
    }),
  ],
  controllers: [
    SchedulePeriodController,
    ShiftAssignmentController,
    ZoneBotController,
    CoverageController,
    ComplianceController,
    ScheduleSeedController,
  ],
  providers: [
    ComplianceGuardService,
    ShiftCoverageService,
    ZoneBotService,
    SchedulingService,
    SchedulingSeedService,
    SchedulingQueueProcessor,
  ],
  exports: [
    ComplianceGuardService,
    ShiftCoverageService,
    ZoneBotService,
    SchedulingService,
    SchedulingSeedService,
  ],
})
export class SchedulingModule {}
