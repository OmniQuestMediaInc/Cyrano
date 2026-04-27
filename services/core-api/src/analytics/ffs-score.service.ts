// services/core-api/src/analytics/ffs-score.service.ts
// HZ: FfsScoreService — six-input behavioral HSV for HotZone / My Zone Manager
// Corpus constraint: advisory only, non-gating, non-punitive. Ch.5 §6.
import { Injectable, Logger } from '@nestjs/common';

export type HeatBand = 'COLD' | 'COOL' | 'WARM' | 'HOT' | 'RED_ZONE';

export interface FfsScoreInput {
  creator_id: string;
  // HIGH weight
  session_spend_tokens: number;
  // MEDIUM weight (count only — message content is PROHIBITED per Corpus Ch.5 §6.2)
  chat_message_count: number;
  // MEDIUM weight
  avg_dwell_time_secs: number;
  // MEDIUM weight — negative: high churn reduces score
  room_churn_rate_pct: number;
  // MEDIUM weight
  avg_attendee_token_balance: number;
  // LOW weight
  profile_ctr_pct: number;
}

export interface FfsScoreResult {
  creator_id: string;
  raw_score: number;
  heat_band: HeatBand;
  computed_at_utc: string;
  // Mandatory per Corpus Ch.5 §6.3 — must appear in every output
  advisory_disclaimer: string;
  // Logged for auditability — metric names only, never values or content
  inputs_used: string[];
}

const WEIGHTS = {
  session_spend: 0.35,
  chat_volume: 0.2,
  dwell_time: 0.2,
  churn_rate: -0.15,
  token_balance: 0.07,
  profile_ctr: 0.03,
} as const;

// Mandatory advisory disclaimer — Corpus Ch.5 §6.3
const ADVISORY_DISCLAIMER =
  'HSV is an advisory performance signal only. It does not determine eligibility, ' +
  'affect payout percentage, influence moderation decisions, or gate access. ' +
  'Canonical Corpus v10 Ch.5 §6.';

@Injectable()
export class FfsScoreService {
  private readonly logger = new Logger(FfsScoreService.name);

  compute(input: FfsScoreInput): FfsScoreResult {
    // Normalize each input to 0–100 range before weighting
    const spend_norm = Math.min((input.session_spend_tokens / 500) * 100, 100);
    const chat_norm = Math.min((input.chat_message_count / 100) * 100, 100);
    const dwell_norm = Math.min((input.avg_dwell_time_secs / 3600) * 100, 100);
    const churn_norm = Math.min(input.room_churn_rate_pct, 100);
    const balance_norm = Math.min((input.avg_attendee_token_balance / 500) * 100, 100);
    const ctr_norm = Math.min(input.profile_ctr_pct, 100);

    const raw_score = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          spend_norm * WEIGHTS.session_spend +
            chat_norm * WEIGHTS.chat_volume +
            dwell_norm * WEIGHTS.dwell_time +
            churn_norm * WEIGHTS.churn_rate +
            balance_norm * WEIGHTS.token_balance +
            ctr_norm * WEIGHTS.profile_ctr,
        ),
      ),
    );

    const heat_band: HeatBand =
      raw_score >= 85
        ? 'RED_ZONE'
        : raw_score >= 65
          ? 'HOT'
          : raw_score >= 45
            ? 'WARM'
            : raw_score >= 25
              ? 'COOL'
              : 'COLD';

    this.logger.log('FfsScoreService: HSV computed', {
      creator_id: input.creator_id,
      raw_score,
      heat_band,
      advisory: true,
      rule_applied_id: 'HEAT_SCORE_v1',
    });

    return {
      creator_id: input.creator_id,
      raw_score,
      heat_band,
      computed_at_utc: new Date().toISOString(),
      advisory_disclaimer: ADVISORY_DISCLAIMER,
      inputs_used: [
        'session_spend_tokens',
        'chat_message_count',
        'avg_dwell_time_secs',
        'room_churn_rate_pct',
        'avg_attendee_token_balance',
        'profile_ctr_pct',
      ],
    };
  }
}
