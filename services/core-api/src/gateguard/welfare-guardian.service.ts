// services/core-api/src/gateguard/welfare-guardian.service.ts
// GGS: Welfare Guardian™ — Conversation Distress Monitor
// Business Plan B.5 + Canonical Corpus (Pre-Processor Risk / Welfare / AV).
//
// Applied AFTER GateGuardSentinel clears the message. Analyses recent
// conversation messages for distress signals. If the computed distress score
// exceeds 0.7, a welfare system message (with real crisis resources) is
// emitted to the user via NATS and a GATEGUARD_WELFARE_DISTRESS_DETECTED
// event is published for dashboard / human-escalation consumers.
//
// Doctrine:
//   - Detection is keyword-weighted, fully deterministic, no external I/O.
//   - Scores are clamped to [0.0, 1.0].
//   - Crisis resources are sourced from globally-recognised services.

import { Injectable, Logger } from '@nestjs/common';
import { NatsService } from '../nats/nats.service';
import { NATS_TOPICS } from '../../../nats/topics.registry';

/** Sole writer of rule_applied_id for this monitor. */
const WELFARE_GUARDIAN_CHAT_RULE_ID = 'WELFARE_GUARDIAN_CHAT_v1';

/** Distress threshold — scores above this value trigger a welfare message. */
const DISTRESS_THRESHOLD = 0.7;

/**
 * Welfare system message delivered to the user when distress is detected.
 * Uses internationally recognised crisis lines.
 */
const WELFARE_SYSTEM_MESSAGE =
  "Hey… I'm here if you want to talk, but if you're feeling low I " +
  'strongly recommend reaching out to a real person. Here are some resources:\n' +
  '• Crisis Text Line (US/CA/UK/IE): Text HOME to 741741\n' +
  '• 988 Suicide & Crisis Lifeline (US): Call or text 988\n' +
  '• Samaritans (UK/IE): 116 123\n' +
  '• International resources: https://www.iasp.info/resources/Crisis_Centres/';

// ---------------------------------------------------------------------------
// Distress keyword weights
// ---------------------------------------------------------------------------

/**
 * Each entry is [pattern, weight]. Weights are additive and clamped to 1.0.
 *
 * Tier 1 (0.30) — severe/immediate risk language.
 * Tier 2 (0.20) — strong distress expressions.
 * Tier 3 (0.10) — moderate distress or hopelessness.
 */
const DISTRESS_PATTERNS: Array<[RegExp, number]> = [
  // Tier 1 — immediate risk
  [/\bkill\s+myself\b/i, 0.30],
  [/\bsuicid(?:e|al)\b/i, 0.30],
  [/\bend\s+(?:it|my\s+life|my\s+pain)\b/i, 0.30],
  [/\bdon[''']?t\s+want\s+to\s+(?:live|be\s+(?:here|alive))\b/i, 0.30],
  [/\bwant\s+to\s+die\b/i, 0.30],
  [/\bhurt\s+myself\b/i, 0.30],
  [/\bself[-\s]?harm\b/i, 0.25],

  // Tier 2 — strong distress
  [/\bhopeless\b/i, 0.20],
  [/\bworthless\b/i, 0.20],
  [/\bhate\s+myself\b/i, 0.20],
  [/\bcan[''']?t\s+(?:take|bear|handle)\s+(?:it|this|anymore)\b/i, 0.20],
  [/\bno\s+(?:point|reason)\s+(?:to|in)\s+(?:go(?:ing)?\s+on|living|anything)\b/i, 0.20],
  [/\bfeel(?:ing)?\s+(?:so\s+)?empty\b/i, 0.15],
  [/\bnumb(?:ness)?\b/i, 0.10],

  // Tier 3 — moderate distress
  [/\bcan[''']?t\s+cope\b/i, 0.10],
  [/\bbreaking\s+down\b/i, 0.10],
  [/\bfalling\s+apart\b/i, 0.10],
  [/\bno\s+one\s+cares\b/i, 0.10],
  [/\bso\s+alone\b/i, 0.10],
  [/\bgiving\s+up\b/i, 0.10],
];

// ---------------------------------------------------------------------------
// WelfareGuardianService
// ---------------------------------------------------------------------------

@Injectable()
export class WelfareGuardianService {
  private readonly logger = new Logger(WelfareGuardianService.name);

  constructor(private readonly nats: NatsService) {}

  /**
   * Analyses recent conversation messages for distress signals.
   *
   * If the computed distress score > 0.7:
   *   1. Emits a welfare system message to the user via CHAT_RESPONSE_OUTBOUND.
   *   2. Publishes GATEGUARD_WELFARE_DISTRESS_DETECTED for dashboard consumers.
   *
   * @param userId         - The user whose conversation is being monitored.
   * @param recentMessages - Sliding window of recent messages (newest last).
   */
  async monitorConversation(userId: string, recentMessages: string[]): Promise<void> {
    const distressScore = WelfareGuardianService.computeDistressScore(recentMessages);

    if (distressScore > DISTRESS_THRESHOLD) {
      this.nats.publish(NATS_TOPICS.CHAT_RESPONSE_OUTBOUND, {
        user_id: userId,
        message: WELFARE_SYSTEM_MESSAGE,
        type: 'WELFARE_SYSTEM_MESSAGE',
        distress_score: distressScore,
        sent_at_utc: new Date().toISOString(),
        rule_applied_id: WELFARE_GUARDIAN_CHAT_RULE_ID,
      });

      this.nats.publish(NATS_TOPICS.GATEGUARD_WELFARE_DISTRESS_DETECTED, {
        user_id: userId,
        distress_score: distressScore,
        detected_at_utc: new Date().toISOString(),
        rule_applied_id: WELFARE_GUARDIAN_CHAT_RULE_ID,
      });

      this.logger.warn('WelfareGuardianService: distress detected — welfare message sent', {
        userId,
        distressScore,
        rule_applied_id: WELFARE_GUARDIAN_CHAT_RULE_ID,
      });
    }
  }

  /**
   * Pure distress scorer. Exported for unit-test coverage.
   * Combines all messages, applies weighted keyword patterns, clamps to [0, 1].
   */
  static computeDistressScore(messages: string[]): number {
    if (messages.length === 0) return 0;

    const combined = messages.join(' ');
    let score = 0;

    for (const [pattern, weight] of DISTRESS_PATTERNS) {
      if (pattern.test(combined)) {
        score += weight;
      }
    }

    return Math.min(1.0, score);
  }
}
