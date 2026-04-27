// FIZ: MEMB-001 — ZoneAccessModule
// FIZ: MEMB-002 — imports MembershipModule for tier resolution DI.
// Provides ZoneAccessService and ZoneAccessGuard to the application.
// MEMB-002: imports MembershipModule so ZoneAccessService can call getActiveTier.
import { Module } from '@nestjs/common';
import { ZoneAccessService } from './zone-access.service';
import { ZoneAccessGuard } from './zone-access.guard';
import { MembershipModule } from '../membership/membership.module';

@Module({
  imports: [MembershipModule],
  providers: [ZoneAccessService, ZoneAccessGuard],
  exports: [ZoneAccessService, ZoneAccessGuard],
})
export class ZoneAccessModule {}
