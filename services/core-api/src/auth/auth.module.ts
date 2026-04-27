// services/core-api/src/auth/auth.module.ts
// AUTH-002 — AuthModule with StepUpService + RbacGuard.
// PAYLOAD 6: RbacService added as the canonical audit-emitting decision
// wrapper. AuthModule now depends on AuditModule (ImmutableAuditService) —
// AuditModule is @Global, so no explicit import is required.
import { Module } from '@nestjs/common';
import { StepUpService } from './step-up.service';
import { RbacGuard } from './rbac.guard';
import { RbacService } from './rbac.service';

@Module({
  providers: [StepUpService, RbacGuard, RbacService],
  exports: [StepUpService, RbacGuard, RbacService],
})
export class AuthModule {}
