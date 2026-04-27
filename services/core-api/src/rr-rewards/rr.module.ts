// CYR: Wave L — RedRoom Rewards NestJS Module
// Wires RedRoomRewardsService with its repository tokens.
// Production: bind LEDGER_REPO and GRANTS_REPO to Prisma-backed adapters.

import { Module, type Provider } from '@nestjs/common';
import { RedRoomRewardsService } from './rr.service';

/** DI tokens for repository injection. */
export const RR_REWARDS_TOKENS = {
  LEDGER_REPO:   Symbol.for('RR_REWARDS_LEDGER_REPO'),
  GRANTS_REPO:   Symbol.for('RR_REWARDS_GRANTS_REPO'),
  ACTIVE_USERS:  Symbol.for('RR_REWARDS_ACTIVE_USERS'),
} as const;

const PROVIDERS: Provider[] = [RedRoomRewardsService];

@Module({
  providers: PROVIDERS,
  exports: [RedRoomRewardsService],
})
export class RrRewardsModule {}
