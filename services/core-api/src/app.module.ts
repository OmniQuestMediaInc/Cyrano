// services/core-api/src/app.module.ts
// CHORE: HOUSE-001 — restore missing module registrations dropped in merge
// PAYLOAD 3: wire GateGuardModule + GateGuardMiddleware in front of
//            /purchase, /spend, /payout route trees.
// HZ: register SenSyncModule + GuestHeatModule.
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { CreatorModule } from './creator/creator.module';
import { SafetyModule } from './safety/safety.module';
import { GrowthModule } from './growth/growth.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ComplianceModule } from './compliance/compliance.module';
import { DfspModule } from './dfsp/dfsp.module';
import { PaymentsModule } from './payments/payments.module';
import { NatsModule } from './nats/nats.module';
import { PrismaModule } from './prisma.module';
import { GamesModule } from './games/games.module';
import { GiftsModule } from './gifts/gifts.module';
import { SovereignCaCMiddleware } from './compliance/sovereign-cac.middleware';
import { ZoneGptModule } from '../../zone-gpt/src/zone-gpt.module';
import { BijouModule } from '../../bijou/src/bijou.module';
import { AuthModule } from './auth/auth.module';
import { SchedulingModule } from './scheduling/scheduling.module';
import { ZoneAccessModule } from './zone-access/zone-access.module';
import { MembershipModule } from './membership/membership.module';
import { GateGuardModule } from './gateguard/gateguard.module';
import { GateGuardMiddleware } from './gateguard/gateguard.middleware';
import { AuditModule } from './audit/audit.module';
import { RewardsModule } from './rewards/rewards.module';
import { ThreeBucketSpendGuardMiddleware } from './finance/three-bucket-spend-guard.middleware';
import { FfsModule } from '../../ffs/src/ffs.module';
import { SenSyncModule } from '../../sensync/src/sensync.module';
import { GuestHeatModule } from '../../guest-heat/src/guest-heat.module';
import { AffiliationNumberModule } from '../../affiliation-number/src/affiliation-number.module';
import { StudioAffiliationModule } from '../../studio-affiliation/src/studio-affiliation.module';
import { CreatorOnboardingModule } from '../../creator-onboarding/src/creator-onboarding.module';
import { CyranoAuthModule } from './cyrano/cyrano-auth.module';

@Module({
  imports: [
    NatsModule, // FIRST — global module, must be registered before all others
    PrismaModule, // SECOND — global Prisma client
    AuditModule, // THIRD — global ImmutableAuditService available everywhere
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      },
    }),
    GateGuardModule, // Register before finance-adjacent modules — middleware
    //  wires against /purchase, /spend, /payout below.
    CreatorModule,
    SafetyModule,
    GrowthModule,
    AnalyticsModule,
    ComplianceModule,
    DfspModule,
    PaymentsModule,
    GamesModule,
    GiftsModule,
    ZoneGptModule,
    BijouModule,
    AuthModule,
    SchedulingModule,
    MembershipModule,
    ZoneAccessModule,
    FfsModule,
    SenSyncModule,
    GuestHeatModule,
    RewardsModule,
    // RBAC-STUDIO-001 — Studio onboarding + affiliation + RBAC
    AffiliationNumberModule,
    StudioAffiliationModule,
    CreatorOnboardingModule,
    CyranoAuthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SovereignCaCMiddleware).forRoutes('*');

    // PAYLOAD 3: GateGuard runs AFTER SovereignCaCMiddleware (jurisdiction
    // context is attached first) but BEFORE any ledger mutation handler.
    consumer.apply(GateGuardMiddleware).forRoutes('/purchase', '/spend', '/payout');

    // PAYLOAD 6: Three-bucket spend-order guard runs after GateGuard on
    // /spend routes. Final defence against a handler that tries to debit
    // PURCHASED before MEMBERSHIP_ALLOCATION or PROMOTIONAL_BONUS.
    consumer.apply(ThreeBucketSpendGuardMiddleware).forRoutes('/spend');
  }
}
