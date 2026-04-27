// CRM: Guest-Heat — Predictive Forecasting Service
// Business Plan §B.4 — spend forecasting using weather, holiday, and seasonal signals.
//
// Contract:
//   • Generate a spend forecast for a session window.
//   • Signals: WEATHER_HOT, WEATHER_COLD, HOLIDAY, SEASONAL_PEAK, WEEKEND.
//   • Forecast is based on base spend (from WhaleProfile) × signal multipliers.
//   • Emits GUEST_HEAT_FORECAST_UPDATED on NATS.
//   • No external API calls — signal detection is rule-based on date/region.

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { NATS_TOPICS } from '../../nats/topics.registry';
import {
  GUEST_HEAT_RULE_ID,
  type ForecastSignal,
  type SpendForecast,
} from './guest-heat.types';

// ── Signal multipliers ────────────────────────────────────────────────────────

const SIGNAL_MULTIPLIERS: Record<ForecastSignal, number> = {
  WEATHER_HOT:   1.15, // hot weather → indoor entertainment premium
  WEATHER_COLD:  1.20, // cold weather → home entertainment premium
  HOLIDAY:       1.35, // statutory or cultural holiday
  SEASONAL_PEAK: 1.25, // season-wide uplift (Valentine's, Christmas, etc.)
  WEEKEND:       1.10, // Friday/Saturday boost
};

// ── Holiday calendar (UTC month/day pairs — not exhaustive; primary events) ──

const HOLIDAY_WINDOWS: Array<{ month: number; day: number; name: string }> = [
  { month: 1,  day: 1,  name: "New Year's Day" },
  { month: 2,  day: 14, name: "Valentine's Day" },
  { month: 3,  day: 17, name: "St. Patrick's Day" },
  { month: 4,  day: 1,  name: "April Fool's Day" },
  { month: 5,  day: 5,  name: "Cinco de Mayo" },
  { month: 7,  day: 4,  name: "Fourth of July" },
  { month: 10, day: 31, name: "Halloween" },
  { month: 11, day: 25, name: "Thanksgiving (approx.)" }, // last Thu Nov — simplified
  { month: 12, day: 25, name: "Christmas Day" },
  { month: 12, day: 31, name: "New Year's Eve" },
];

// ── Seasonal peak windows (month ranges, inclusive) ──────────────────────────

const SEASONAL_PEAKS: Array<{ months: number[]; name: string }> = [
  { months: [2],        name: "Valentine's Season" },
  { months: [10, 11],   name: "Autumn / Holiday Ramp" },
  { months: [12, 1],    name: "Christmas / New Year" },
  { months: [6, 7],     name: "Pride / Summer Peak" },
];

@Injectable()
export class ForecastService {
  private readonly logger = new Logger(ForecastService.name);

  constructor(private readonly nats: NatsService) {}

  /**
   * Generate a spend forecast for a session window.
   *
   * @param session_id   Active session ID.
   * @param creator_id   Creator ID.
   * @param base_czt     Baseline expected spend in CZT (from WhaleProfile).
   * @param window_hours Duration of the forecast window in hours.
   * @param geo_region   Optional CNZ geo region code.
   * @param reference_dt Reference UTC datetime for signal detection (defaults to now).
   */
  generateForecast(
    session_id: string,
    creator_id: string,
    base_czt: number,
    window_hours: number,
    geo_region?: string,
    reference_dt: Date = new Date(),
  ): SpendForecast {
    const signals = this.detectSignals(reference_dt, geo_region);
    const multiplier = this.computeMultiplier(signals);
    const expected_spend_czt = Math.round(base_czt * multiplier);
    const confidence = this.computeConfidence(signals);

    const window_start = reference_dt.toISOString();
    const window_end = new Date(
      reference_dt.getTime() + window_hours * 3_600_000,
    ).toISOString();

    const forecast: SpendForecast = {
      forecast_id: randomUUID(),
      session_id,
      creator_id,
      window_start_utc: window_start,
      window_end_utc: window_end,
      expected_spend_czt,
      confidence,
      signals,
      rule_applied_id: GUEST_HEAT_RULE_ID,
      generated_at_utc: window_start,
    };

    this.nats.publish(NATS_TOPICS.GUEST_HEAT_FORECAST_UPDATED, {
      ...forecast,
    } as unknown as Record<string, unknown>);

    this.logger.log('ForecastService: forecast generated', {
      session_id,
      expected_spend_czt,
      signals,
      confidence,
    });

    return forecast;
  }

  // ── Signal detection ───────────────────────────────────────────────────────

  private detectSignals(dt: Date, _geo_region?: string): ForecastSignal[] {
    // _geo_region is reserved for future integration with a regional weather/
    // calendar API (see ASSUMPTIONS.md A006). Currently unused — all signals
    // are derived from UTC date logic only.
    const signals: ForecastSignal[] = [];
    const month = dt.getUTCMonth() + 1; // 1-based
    const day   = dt.getUTCDate();
    const dow   = dt.getUTCDay(); // 0=Sun, 5=Fri, 6=Sat

    // Weekend.
    if (dow === 5 || dow === 6) signals.push('WEEKEND');

    // Holiday window (±1 day tolerance).
    const isHoliday = HOLIDAY_WINDOWS.some(h => {
      const monthMatch = h.month === month;
      const dayMatch = Math.abs(h.day - day) <= 1;
      return monthMatch && dayMatch;
    });
    if (isHoliday) signals.push('HOLIDAY');

    // Seasonal peak.
    const isSeasonal = SEASONAL_PEAKS.some(sp => sp.months.includes(month));
    if (isSeasonal) signals.push('SEASONAL_PEAK');

    // Weather signals — simplified rule: Northern Hemisphere convention.
    // June–August = HOT; December–February = COLD.
    if ([6, 7, 8].includes(month)) signals.push('WEATHER_HOT');
    if ([12, 1, 2].includes(month)) signals.push('WEATHER_COLD');

    return signals;
  }

  private computeMultiplier(signals: ForecastSignal[]): number {
    if (signals.length === 0) return 1.0;
    // Take the maximum signal multiplier to avoid over-stacking.
    return Math.max(...signals.map(s => SIGNAL_MULTIPLIERS[s]));
  }

  private computeConfidence(signals: ForecastSignal[]): number {
    // More signals = higher confidence (more evidence converges).
    const base = 60;
    const bonus = Math.min(35, signals.length * 10);
    return base + bonus;
  }
}
