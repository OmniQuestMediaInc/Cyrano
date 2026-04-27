// CYR: BENEFITS-001 — BenefitsModule
// Provides BenefitsGuard and UsageInterceptor globally via APP_GUARD / APP_INTERCEPTOR.
import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { BenefitsGuard } from './benefits.guard';
import { UsageInterceptor } from './usage.interceptor';
import { MembershipModule } from '../membership/membership.module';

@Module({
  imports: [MembershipModule],
  providers: [
    BenefitsGuard,
    UsageInterceptor,
    {
      provide: APP_GUARD,
      useClass: BenefitsGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: UsageInterceptor,
    },
  ],
})
export class BenefitsModule {}
