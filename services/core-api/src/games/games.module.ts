// services/core-api/src/games/games.module.ts
import { Module } from '@nestjs/common';
import { GameEngineService } from './game-engine.service';
import { GamesController } from './games.controller';
import { GovernanceConfigService } from '../config/governance.config';
import { ZoneAccessModule } from '../zone-access/zone-access.module';

@Module({
  imports: [ZoneAccessModule],
  controllers: [GamesController],
  providers: [GameEngineService, GovernanceConfigService],
  exports: [GameEngineService],
})
export class GamesModule {}
