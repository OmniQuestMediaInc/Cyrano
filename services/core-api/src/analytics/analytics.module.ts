// services/core-api/src/analytics/analytics.module.ts
import { Module } from '@nestjs/common';
import { FfsScoreService } from './ffs-score.service';

@Module({
  providers: [FfsScoreService],
  exports: [FfsScoreService],
})
export class AnalyticsModule {}
