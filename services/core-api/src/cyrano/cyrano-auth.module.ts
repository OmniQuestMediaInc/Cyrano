// Cyrano Layer 2 — auth module
// Phase 0: provides the gate that the standalone Next.js runtime
// (apps/cyrano-standalone/) calls to enforce OmniPass+ / Diamond access.
// Imports MembershipModule for tier resolution; relies on the global
// NatsModule already registered in AppModule for audit emission.

import { Module } from '@nestjs/common';
import { MembershipModule } from '../membership/membership.module';
import { CyranoAuthController } from './cyrano-auth.controller';
import { CyranoAuthService } from './cyrano-auth.service';
import { CyranoLayer2Guard } from './cyrano-auth.guard';

@Module({
  imports: [MembershipModule],
  controllers: [CyranoAuthController],
  providers: [CyranoAuthService, CyranoLayer2Guard],
  exports: [CyranoAuthService, CyranoLayer2Guard],
})
export class CyranoAuthModule {}
