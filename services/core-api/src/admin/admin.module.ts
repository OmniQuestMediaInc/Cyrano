// services/core-api/src/admin/admin.module.ts
// CYR: Admin NestJS module — RBAC-gated admin dashboard surfaces.

import { Module } from '@nestjs/common';
import { AdminHouseModelController } from './admin-house-model.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AdminHouseModelController],
})
export class AdminModule {}
