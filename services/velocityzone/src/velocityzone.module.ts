// VelocityZone — NestJS module
import { Module } from '@nestjs/common';
import { VelocityZoneController } from './velocityzone.controller';
import { VelocityZoneService } from './velocityzone.service';

@Module({
  controllers: [VelocityZoneController],
  providers:   [VelocityZoneService],
  exports:     [VelocityZoneService],
})
export class VelocityZoneModule {}
