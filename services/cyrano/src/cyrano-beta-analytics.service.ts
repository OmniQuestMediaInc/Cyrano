// PAYLOAD 5+ — Cyrano Beta Analytics (Issue #16 — Phase 4)
// Tracks usage events for the internal beta program (20–30 creators).
//
// Analytics captured:
//   • Per-creator prompt call count
//   • Per-creator translation call count + locale distribution
//   • Per-creator voice synthesis count
//   • Block rate (blocked / total prompts)
//   • Session summary emitted on demand via NATS
//
// Phase 0: all metrics are in-process. Phase 1 drains to a time-series DB
// (InfluxDB / Postgres partitioned table) via a NATS subscriber.
//
// Invariants:
//   • correlation_id + reason_code on every event.
//   • No PII — only creator_id + aggregate counters are held.
//   • Summary events emit on NATS (CYRANO_BETA_SUMMARY_EMITTED).

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { NATS_TOPICS } from '../../nats/topics.registry';
import { CYRANO_LAYER4_RULE_ID } from './cyrano-layer4.types';
import { BETA_RULE_ID } from './cyrano-beta-registry.service';

export interface BetaCreatorStats {
  creator_id: string;
  prompt_calls: number;
  blocked_prompts: number;
  translation_calls: number;
  /** Map of target_locale → call count. */
  locale_distribution: Record<string, number>;
  voice_calls: number;
  first_event_at_utc: string;
  last_event_at_utc: string;
}

export interface TrackPromptInput {
  creator_id: string;
  blocked: boolean;
  voice_used: boolean;
  translated: boolean;
  target_locale?: string;
  correlation_id?: string;
}

export interface TrackTranslationInput {
  creator_id: string;
  target_locale: string;
  skipped: boolean;
  correlation_id?: string;
}

export interface BetaSummary {
  total_creators: number;
  total_prompt_calls: number;
  total_blocked_prompts: number;
  total_translation_calls: number;
  total_voice_calls: number;
  block_rate_pct: number;
  top_locales: Array<{ locale: string; count: number }>;
  emitted_at_utc: string;
  correlation_id: string;
  rule_applied_id: string;
}

@Injectable()
export class CyranoBetaAnalyticsService {
  private readonly logger = new Logger(CyranoBetaAnalyticsService.name);
  private readonly stats = new Map<string, BetaCreatorStats>();

  constructor(private readonly nats: NatsService) {}

  /**
   * Track a prompt event for a beta creator.
   * Emits CYRANO_BETA_PROMPT_TRACKED on NATS.
   */
  trackPrompt(input: TrackPromptInput): void {
    const corr = input.correlation_id ?? randomUUID();
    const now = new Date().toISOString();
    const stats = this.getOrCreate(input.creator_id, now);

    stats.prompt_calls += 1;
    if (input.blocked) {
      stats.blocked_prompts += 1;
    }
    if (input.voice_used) {
      stats.voice_calls += 1;
    }
    if (input.translated && input.target_locale) {
      stats.translation_calls += 1;
      stats.locale_distribution[input.target_locale] =
        (stats.locale_distribution[input.target_locale] ?? 0) + 1;
    }
    stats.last_event_at_utc = now;

    this.nats.publish(NATS_TOPICS.CYRANO_BETA_PROMPT_TRACKED, {
      creator_id: input.creator_id,
      blocked: input.blocked,
      voice_used: input.voice_used,
      translated: input.translated,
      target_locale: input.target_locale ?? null,
      prompt_calls: stats.prompt_calls,
      correlation_id: corr,
      reason_code: 'BETA_PROMPT_TRACKED',
      rule_applied_id: BETA_RULE_ID,
      emitted_at_utc: now,
    });
  }

  /**
   * Track a standalone translation event (when translation is called
   * outside the prompt flow, e.g. from a Layer 1 session).
   * Emits CYRANO_BETA_TRANSLATION_TRACKED on NATS.
   */
  trackTranslation(input: TrackTranslationInput): void {
    const corr = input.correlation_id ?? randomUUID();
    const now = new Date().toISOString();
    const stats = this.getOrCreate(input.creator_id, now);

    if (!input.skipped) {
      stats.translation_calls += 1;
      stats.locale_distribution[input.target_locale] =
        (stats.locale_distribution[input.target_locale] ?? 0) + 1;
    }
    stats.last_event_at_utc = now;

    this.nats.publish(NATS_TOPICS.CYRANO_BETA_TRANSLATION_TRACKED, {
      creator_id: input.creator_id,
      target_locale: input.target_locale,
      skipped: input.skipped,
      translation_calls: stats.translation_calls,
      correlation_id: corr,
      reason_code: 'BETA_TRANSLATION_TRACKED',
      rule_applied_id: BETA_RULE_ID,
      emitted_at_utc: now,
    });
  }

  /**
   * Return stats for a single beta creator. Returns undefined if the
   * creator has no tracked events yet.
   */
  getStats(creator_id: string): BetaCreatorStats | undefined {
    const s = this.stats.get(creator_id);
    return s ? { ...s, locale_distribution: { ...s.locale_distribution } } : undefined;
  }

  /**
   * Compute and emit a summary across all tracked beta creators.
   * Emits CYRANO_BETA_SUMMARY_EMITTED on NATS.
   */
  emitSummary(correlation_id?: string): BetaSummary {
    const corr = correlation_id ?? randomUUID();
    const now = new Date().toISOString();

    let total_prompt_calls = 0;
    let total_blocked_prompts = 0;
    let total_translation_calls = 0;
    let total_voice_calls = 0;
    const globalLocales: Record<string, number> = {};

    for (const s of this.stats.values()) {
      total_prompt_calls += s.prompt_calls;
      total_blocked_prompts += s.blocked_prompts;
      total_translation_calls += s.translation_calls;
      total_voice_calls += s.voice_calls;
      for (const [locale, count] of Object.entries(s.locale_distribution)) {
        globalLocales[locale] = (globalLocales[locale] ?? 0) + count;
      }
    }

    const block_rate_pct =
      total_prompt_calls > 0
        ? Math.round((total_blocked_prompts / total_prompt_calls) * 100 * 100) / 100
        : 0;

    const top_locales = Object.entries(globalLocales)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([locale, count]) => ({ locale, count }));

    const summary: BetaSummary = {
      total_creators: this.stats.size,
      total_prompt_calls,
      total_blocked_prompts,
      total_translation_calls,
      total_voice_calls,
      block_rate_pct,
      top_locales,
      emitted_at_utc: now,
      correlation_id: corr,
      rule_applied_id: BETA_RULE_ID,
    };

    this.nats.publish(NATS_TOPICS.CYRANO_BETA_SUMMARY_EMITTED, {
      ...summary,
      reason_code: 'BETA_SUMMARY_EMITTED',
    });

    this.logger.log('CyranoBetaAnalyticsService: summary emitted', {
      total_creators: summary.total_creators,
      total_prompt_calls,
      block_rate_pct,
      correlation_id: corr,
      rule_applied_id: CYRANO_LAYER4_RULE_ID,
    });

    return summary;
  }

  /** Return stats for all tracked creators. */
  allStats(): BetaCreatorStats[] {
    return Array.from(this.stats.values()).map((s) => ({
      ...s,
      locale_distribution: { ...s.locale_distribution },
    }));
  }

  /** Test seam — wipe all metrics. Never call from prod. */
  reset(): void {
    this.stats.clear();
  }

  private getOrCreate(creator_id: string, now: string): BetaCreatorStats {
    if (!this.stats.has(creator_id)) {
      this.stats.set(creator_id, {
        creator_id,
        prompt_calls: 0,
        blocked_prompts: 0,
        translation_calls: 0,
        locale_distribution: {},
        voice_calls: 0,
        first_event_at_utc: now,
        last_event_at_utc: now,
      });
    }
    return this.stats.get(creator_id)!;
  }
}
