// CRM: Guest-Heat REST controller — insights, offers, gemstones, teleprompter,
// forecast, performance timer, Fan Fervor Score.
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { WhaleProfileService, OfferEngine } from './guest-heat.service';
import { GemstoneService } from './gemstone.service';
import { CyranoTeleprompterService } from './cyrano-teleprompter.service';
import { DualFlamePulseService } from './dual-flame-pulse.service';
import { FanFervorScoreService } from './fan-fervor-score.service';
import { ForecastService } from './forecast.service';
import { PerformanceTimerService } from './performance-timer.service';
import {
  type GemType,
  type GemVisibility,
  type GuestOffer,
  type MembershipTier,
  type PreferenceVector,
  type SeasonalCampaign,
  type SpendForecast,
  type SpendWindows,
  type WhaleProfileRecord,
} from './guest-heat.types';
import type { FfsInput, FfsResult } from './fan-fervor-score.types';
// HeatTier is imported from creator-control following the established pattern
// FfsTier is imported from creator-control following the established pattern
// already used by cyrano.service and cyrano.types. When creator-control is
// extracted to a shared package this import will be updated accordingly.
import type { FfsTier } from '../../creator-control/src/ffs.engine';

// ── REST DTOs ─────────────────────────────────────────────────────────────────

export interface ScoreGuestDto {
  guest_id: string;
  spend: SpendWindows;
  preference_vector: PreferenceVector;
  geo_region?: string;
  correlation_id?: string;
}

export interface TriggerOfferDto {
  guest_id: string;
  offer_type: 'SPENDING_PATTERN' | 'GEO_PRICE' | 'LOYALTY_REWARD';
  base_value_czt?: number;
  geo_region?: string;
  session_id?: string;
}

export interface QueueGemstoneDto {
  guest_id: string;
  gem_type: GemType;
  visibility: GemVisibility;
  session_id?: string;
  custom_symbolism?: string;
  send_delay_sec?: number;
  correlation_id?: string;
}

export interface StartTeleprompterDto {
  session_id: string;
  creator_id: string;
  campaign: SeasonalCampaign;
}

export interface RegisterPresenceDto {
  session_id: string;
  creator_id: string;
  guest_id: string;
  tier: MembershipTier;
  current_heat: FfsTier;
}

export interface GenerateForecastDto {
  session_id: string;
  creator_id: string;
  base_czt: number;
  window_hours: number;
  geo_region?: string;
}

export interface StartTimerDto {
  session_id: string;
  creator_id: string;
  correlation_id?: string;
}

export interface TimerTickDto {
  session_id: string;
  revenue_czt: number;
  correlation_id?: string;
}

export interface ScoreFanFervorDto {
  guest_id: string;
  session_id: string;
  tips_czt_in_session: number;
  tip_velocity_per_min: number;
  chat_messages_in_session: number;
  heart_reactions_in_session: number;
  dwell_minutes: number;
  private_request_count: number;
  whale_score: number;
  heartsync_opted_in: boolean;
  heartsync_bpm: number;
  heartsync_baseline_bpm: number;
  correlation_id?: string;
}

// ── Controller ────────────────────────────────────────────────────────────────

@Injectable()
export class GuestHeatController {
  private readonly logger = new Logger(GuestHeatController.name);

  constructor(
    private readonly whaleProfile: WhaleProfileService,
    private readonly offerEngine: OfferEngine,
    private readonly gemstone: GemstoneService,
    private readonly teleprompter: CyranoTeleprompterService,
    private readonly dualFlame: DualFlamePulseService,
    private readonly fanFervorScore: FanFervorScoreService,
    private readonly forecast: ForecastService,
    private readonly perfTimer: PerformanceTimerService,
  ) {}

  // ── Whale profile ──────────────────────────────────────────────────────────

  /** POST /guest-heat/insights/score */
  async scoreGuest(dto: ScoreGuestDto): Promise<WhaleProfileRecord> {
    return this.whaleProfile.scoreGuest(
      dto.guest_id,
      dto.spend,
      dto.preference_vector,
      dto.geo_region,
      dto.correlation_id,
    );
  }

  /** GET /guest-heat/insights/:guest_id */
  async getInsights(guest_id: string): Promise<WhaleProfileRecord | { error: string }> {
    const profile = await this.whaleProfile.getLatestProfile(guest_id);
    if (!profile) return { error: 'PROFILE_NOT_FOUND' };
    return profile;
  }

  // ── Offer engine ───────────────────────────────────────────────────────────

  /** POST /guest-heat/offers */
  async triggerOffer(dto: TriggerOfferDto): Promise<GuestOffer | { error: string }> {
    if (dto.offer_type === 'GEO_PRICE') {
      if (!dto.base_value_czt || !dto.geo_region) {
        return { error: 'GEO_PRICE_REQUIRES_base_value_czt_AND_geo_region' };
      }
      return this.offerEngine.generateGeoPriceOffer(
        dto.guest_id,
        dto.base_value_czt,
        dto.geo_region,
        dto.session_id,
      );
    }

    const profile = await this.whaleProfile.getLatestProfile(dto.guest_id);
    if (!profile) return { error: 'PROFILE_NOT_FOUND' };

    if (dto.offer_type === 'LOYALTY_REWARD') {
      return this.offerEngine.generateLoyaltyRewardOffer(dto.guest_id, profile, dto.session_id);
    }

    return this.offerEngine.generateSpendingPatternOffer(dto.guest_id, profile, dto.session_id);
  }

  // ── Gemstone system ────────────────────────────────────────────────────────

  /** POST /guest-heat/gemstones */
  async queueGemstone(dto: QueueGemstoneDto) {
    return this.gemstone.queueGemstone(
      dto.guest_id,
      dto.gem_type,
      dto.visibility,
      dto.session_id,
      dto.custom_symbolism,
      dto.send_delay_sec,
      dto.correlation_id,
    );
  }

  /** GET /guest-heat/gemstones/:guest_id/pending */
  async listPendingGemstones(guest_id: string) {
    return this.gemstone.listPending(guest_id);
  }

  /** PATCH /guest-heat/gemstones/:gem_id/visibility */
  async updateGemVisibility(gem_id: string, visibility: GemVisibility) {
    return this.gemstone.updateVisibility(gem_id, visibility);
  }

  // ── Teleprompter ───────────────────────────────────────────────────────────

  /** POST /guest-heat/teleprompter/start */
  startTeleprompter(dto: StartTeleprompterDto) {
    return this.teleprompter.startChain(
      dto.session_id,
      dto.creator_id,
      dto.campaign,
    );
  }

  /** GET /guest-heat/teleprompter/:session_id/current */
  getTeleprompterCurrent(session_id: string) {
    return this.teleprompter.getCurrentSuggestion(session_id);
  }

  /** POST /guest-heat/teleprompter/:session_id/advance */
  advanceTeleprompter(session_id: string) {
    return this.teleprompter.advanceChain(session_id);
  }

  /** GET /guest-heat/teleprompter/:session_id/state */
  getTeleprompterState(session_id: string) {
    return this.teleprompter.getChainState(session_id);
  }

  /** GET /guest-heat/teleprompter/campaigns */
  listCampaigns(): SeasonalCampaign[] {
    return this.teleprompter.listCampaigns();
  }

  // ── Dual Flame Pulse ───────────────────────────────────────────────────────

  /** POST /guest-heat/dual-flame/presence */
  registerPresence(dto: RegisterPresenceDto) {
    return this.dualFlame.registerPresence(
      dto.session_id,
      dto.creator_id,
      dto.guest_id,
      dto.tier,
      dto.current_heat,
    );
  }

  // ── Forecast ───────────────────────────────────────────────────────────────

  /** POST /guest-heat/forecast */
  generateForecast(dto: GenerateForecastDto): SpendForecast {
    return this.forecast.generateForecast(
      dto.session_id,
      dto.creator_id,
      dto.base_czt,
      dto.window_hours,
      dto.geo_region,
    );
  }

  // ── Performance timer ──────────────────────────────────────────────────────

  /** POST /guest-heat/perf-timer/start */
  startTimer(dto: StartTimerDto) {
    return this.perfTimer.startTimer(
      dto.session_id,
      dto.creator_id,
      dto.correlation_id,
    );
  }

  /** POST /guest-heat/perf-timer/tick */
  timerTick(dto: TimerTickDto) {
    return this.perfTimer.tick(
      dto.session_id,
      dto.revenue_czt,
      dto.correlation_id,
    );
  }

  /** GET /guest-heat/perf-timer/:session_id */
  getTimerState(session_id: string) {
    const state = this.perfTimer.getTimerState(session_id);
    if (!state) return { error: 'TIMER_NOT_FOUND' };
    return state;
  }

  /** POST /guest-heat/perf-timer/stop */
  stopTimer(dto: TimerTickDto) {
    return this.perfTimer.stopTimer(
      dto.session_id,
      dto.revenue_czt,
      dto.correlation_id,
    );
  }

  // ── Fan Fervor Score ───────────────────────────────────────────────────────

  /**
   * POST /guest-heat/ffs/score
   * Compute and persist the Fan Fervor Score for a guest in a session.
   * Emits FFS_GUEST_SCORED on NATS for consumption by payout engine, UI effects,
   * Cyrano, GateGuard Welfare Score, and VelocityZone.
   */
  async scoreFanFervor(dto: ScoreFanFervorDto): Promise<FfsResult> {
    const input: FfsInput = {
      guest_id:                   dto.guest_id,
      session_id:                 dto.session_id,
      captured_at_utc:            new Date().toISOString(),
      tips_czt_in_session:        dto.tips_czt_in_session,
      tip_velocity_per_min:       dto.tip_velocity_per_min,
      chat_messages_in_session:   dto.chat_messages_in_session,
      heart_reactions_in_session: dto.heart_reactions_in_session,
      dwell_minutes:              dto.dwell_minutes,
      private_request_count:      dto.private_request_count,
      whale_score:                dto.whale_score,
      heartsync_opted_in:         dto.heartsync_opted_in,
      heartsync_bpm:              dto.heartsync_bpm,
      heartsync_baseline_bpm:     dto.heartsync_baseline_bpm,
      correlation_id:             dto.correlation_id ?? randomUUID(),
    };
    return this.fanFervorScore.score(input);
  }

  /**
   * GET /guest-heat/ffs/:guest_id
   * Retrieve the latest Fan Fervor Score for a guest.
   */
  async getLatestFanFervorScore(
    guest_id: string,
  ): Promise<FfsResult | { error: string }> {
    const result = await this.fanFervorScore.getLatest(guest_id);
    if (!result) return { error: 'FFS_NOT_FOUND' };
    return result;
  }
}
