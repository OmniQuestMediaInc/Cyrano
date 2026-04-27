// services/gamification/src/gamification.module.ts
// NestJS module wiring for the gamification feature. Mirrors the existing
// GamesModule pattern. Repositories are provided as DI tokens so production
// wiring (Prisma adapters in core-api) replaces the in-memory test doubles
// without touching the services.

import { Module, type Provider } from '@nestjs/common';
import { GamesModule } from '../../core-api/src/games/games.module';
import { ZoneAccessModule } from '../../core-api/src/zone-access/zone-access.module';
import { GamificationController } from './controllers/gamification.controller';
import { GameAnalyticsService } from './services/analytics.service';
import { GameAuditService } from './services/audit.service';
import { CooldownService } from './services/cooldown.service';
import { CreatorGameConfigService } from './services/creator-game-config.service';
import { LEDGER_PORT, PlayOrchestratorService } from './services/play-orchestrator.service';
import { PrizePoolService } from './services/prize-pool.service';
import {
  AlwaysAllowCaptchaVerifier,
  GameSecurityService,
  InMemoryRateLimitStore,
} from './services/security.service';
import { RedRoomRewardsBurnService } from './services/redroom-rewards-burn.service';

/** Repository DI tokens. Adapters bind to these in the core-api module. */
export const GAMIFICATION_TOKENS = {
  PRIZE_POOL_REPO: Symbol.for('GAMIFICATION_PRIZE_POOL_REPO'),
  CREATOR_GAME_CONFIG_REPO: Symbol.for('GAMIFICATION_CREATOR_GAME_CONFIG_REPO'),
  COOLDOWN_REPO: Symbol.for('GAMIFICATION_COOLDOWN_REPO'),
  RATE_LIMIT_STORE: Symbol.for('GAMIFICATION_RATE_LIMIT_STORE'),
  CAPTCHA_VERIFIER: Symbol.for('GAMIFICATION_CAPTCHA_VERIFIER'),
  RRR_BURN_REPO: Symbol.for('GAMIFICATION_RRR_BURN_REPO'),
  RRR_BURN_CLIENT: Symbol.for('GAMIFICATION_RRR_BURN_CLIENT'),
  AUDIT_REPO: Symbol.for('GAMIFICATION_AUDIT_REPO'),
  ANALYTICS_REPO: Symbol.for('GAMIFICATION_ANALYTICS_REPO'),
  GAME_SESSION_REPO: Symbol.for('GAMIFICATION_GAME_SESSION_REPO'),
} as const;

const SERVICE_PROVIDERS: Provider[] = [
  PrizePoolService,
  CreatorGameConfigService,
  CooldownService,
  GameSecurityService,
  RedRoomRewardsBurnService,
  GameAuditService,
  GameAnalyticsService,
  PlayOrchestratorService,
];

/**
 * Default in-process providers. `core-api` overrides these with Prisma-backed
 * adapters when wiring the live module — see services/core-api/src/games-v2.
 */
const DEFAULT_PROVIDERS: Provider[] = [
  { provide: GAMIFICATION_TOKENS.RATE_LIMIT_STORE, useClass: InMemoryRateLimitStore },
  { provide: GAMIFICATION_TOKENS.CAPTCHA_VERIFIER, useClass: AlwaysAllowCaptchaVerifier },
];

@Module({
  imports: [GamesModule, ZoneAccessModule],
  controllers: [GamificationController],
  providers: [...SERVICE_PROVIDERS, ...DEFAULT_PROVIDERS],
  exports: [
    PrizePoolService,
    CreatorGameConfigService,
    CooldownService,
    GameSecurityService,
    RedRoomRewardsBurnService,
    GameAuditService,
    GameAnalyticsService,
    PlayOrchestratorService,
  ],
})
export class GamificationModule {}

export { LEDGER_PORT };
