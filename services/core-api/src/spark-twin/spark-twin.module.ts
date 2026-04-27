// services/core-api/src/spark-twin/spark-twin.module.ts
// CYR: Spark Twin NestJS module — free-tier provisioning and daily usage tracking.

import { Module } from '@nestjs/common';
import { SparkTwinService } from './spark-twin.service';
import { SparkTwinController } from './spark-twin.controller';

@Module({
  controllers: [SparkTwinController],
  providers: [SparkTwinService],
  exports: [SparkTwinService],
})
export class SparkTwinModule {}
