// CRM: Guest-Heat module
import { Module } from '@nestjs/common';
import { WhaleProfileService, OfferEngine } from './guest-heat.service';
import { GemstoneService } from './gemstone.service';
import { CyranoTeleprompterService } from './cyrano-teleprompter.service';
import { DualFlamePulseService } from './dual-flame-pulse.service';
import { FanFervorScoreService } from './fan-fervor-score.service';
import { ForecastService } from './forecast.service';
import { PerformanceTimerService } from './performance-timer.service';
import { GuestHeatController } from './guest-heat.controller';

@Module({
  providers: [
    WhaleProfileService,
    OfferEngine,
    GemstoneService,
    CyranoTeleprompterService,
    DualFlamePulseService,
    FanFervorScoreService,
    ForecastService,
    PerformanceTimerService,
    GuestHeatController,
  ],
  exports: [
    WhaleProfileService,
    OfferEngine,
    GemstoneService,
    CyranoTeleprompterService,
    DualFlamePulseService,
    FanFervorScoreService,
    ForecastService,
    PerformanceTimerService,
    GuestHeatController,
  ],
})
export class GuestHeatModule {}
