// services/core-api/src/app.module.ts
// CYR: Cyrano standalone — stripped to Cyrano-essential modules only.
//      Removed: ZoneGpt, Bijou, SenSync, GuestHeat, AffiliationNumber,
//               StudioAffiliation (live-streaming / theatre surfaces removed).
// PAYLOAD 3: wire GateGuardModule + GateGuardMiddleware in front of
//            /purchase, /spend, /payout route trees.
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
import { CreatorOnboardingModule } from '../../creator-onboarding/src/creator-onboarding.module';
import { CyranoAuthModule } from './cyrano/cyrano-auth.module';
import { PromotionModule } from './promotion/promotion.module';
import { BenefitsModule } from './middleware/benefits.module';

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
    AuthModule,
    SchedulingModule,
    MembershipModule,
    ZoneAccessModule,
    FfsModule, // Flicker n'Flame Scoring — rewards earn/burn logic retained
    RewardsModule,
    CreatorOnboardingModule,
    CyranoAuthModule,
    PromotionModule,
    BenefitsModule,
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
