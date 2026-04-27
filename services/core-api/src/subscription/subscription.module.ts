// CYR: SubscriptionModule — wires SubscriptionService for benefit-tier resolution.
import { Module } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';

@Module({
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
