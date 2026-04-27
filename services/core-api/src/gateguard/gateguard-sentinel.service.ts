// services/core-api/src/gateguard/gateguard-sentinel.service.ts
// GGS: GateGuard Sentinel™ — Chat Message Content Moderation
// Business Plan B.5 + Canonical Corpus (Pre-Processor Risk / Welfare / AV).
//
// Deterministic, pattern-based content scanner applied BEFORE a chat message
// is persisted or forwarded. No external AI dependency — all detection rules
// are compiled-in patterns so decisions are auditable and reproducible.
//
// Doctrine:
//   - Append-only. moderationLog rows are never updated after creation.
//   - Deterministic. Same content always yields the same flags.
//   - Auditable. Every block is logged with correlation_id + rule_applied_id.

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma.service';
import { NatsService } from '../nats/nats.service';
import { NATS_TOPICS } from '../../../nats/topics.registry';
import { ContentScanFlags, ContentScanResult } from './gateguard.types';

/** Sole writer of rule_applied_id for this scanner. */
const SENTINEL_RULE_ID = 'GATEGUARD_SENTINEL_CHAT_v1';

// ---------------------------------------------------------------------------
// Detection patterns — conservative, literal matches only.
// Each pattern targets a narrow content class; false-positive risk is low.
// ---------------------------------------------------------------------------

/**
 * Celebrity-likeness patterns. Detect phrases that explicitly imitate or
 * sexualise a named public figure. We match "as [name]", "[name] roleplay",
 * or explicit commands involving celebrity names.
 */
const CELEBRITY_PATTERNS: RegExp[] = [
  /\bas\s+[\w''-]+\s+[\w''-]+\b.*(?:nude|sex|naked|explicit)/i,
  /(?:pretend|act|roleplay|play)\s+(?:you(?:'re| are)|as)\s+[\w''-]+\s+[\w''-]+/i,
  /(?:nude|naked|sex(?:ual)?|explicit)\s+(?:photo|picture|video|image)\s+of\s+[\w''-]+\s+[\w''-]+/i,
];

/**
 * Illegal content patterns. These match terms strongly indicative of CSAM,
 * exploitation, or other per-se illegal material. Pattern vocabulary is
 * intentionally minimal — only clear-cut markers.
 */
const ILLEGAL_PATTERNS: RegExp[] = [
  /\bchild(?:ren)?\s+(?:nude|naked|sex|explicit|porn)/i,
  /\bminor\s+(?:nude|naked|sex|explicit|porn)/i,
  /\bunderage\s+(?:nude|naked|sex|explicit|porn)/i,
  /\bcsam\b/i,
  /\bkiddie\s+porn/i,
  /\bchild\s+(?:erotica|exploitation)/i,
  /\bsnuff\s+(?:film|video|porn)/i,
];

/**
 * Non-consensual content patterns. Detect requests for scenarios that depict
 * sexual acts presented explicitly as non-consensual.
 */
const NON_CONSENSUAL_PATTERNS: RegExp[] = [
  /\bnon[-\s]?consensual\b/i,
  /\brape\s+(?:scene|fantasy|roleplay|video|porn)/i,
  /\bforce(?:d)?\s+(?:sex|intercourse|penetration)/i,
  /\bsexual\s+assault\s+(?:roleplay|fantasy|scene)/i,
];

// ---------------------------------------------------------------------------
// Typed Prisma delegate (matches the delegate pattern used in GateGuardService)
// ---------------------------------------------------------------------------

type DelegateShape = {
  create: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

function delegateFor(prisma: PrismaService, name: string): DelegateShape {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model = (prisma as any)[name] as DelegateShape | undefined;
  if (!model || typeof model.create !== 'function') {
    throw new Error(`GateGuardSentinelService: Prisma delegate missing for '${name}'`);
  }
  return model;
}

// ---------------------------------------------------------------------------
// GateGuardSentinelService
// ---------------------------------------------------------------------------

@Injectable()
export class GateGuardSentinelService {
  private readonly logger = new Logger(GateGuardSentinelService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly nats: NatsService,
  ) {}

  /**
   * Scans a single chat message for prohibited content.
   *
   * If any flag fires the message is blocked, an append-only moderationLog row
   * is written, and a GATEGUARD_MESSAGE_BLOCKED NATS event is emitted.
   *
   * @param userId  - The user who authored the message.
   * @param content - The raw message text.
   * @param twinId  - The AI twin / creator the message is directed to.
   * @returns ContentScanResult — callers must bail out when `blocked` is true.
   */
  async scanMessage(
    userId: string,
    content: string,
    twinId: string,
  ): Promise<ContentScanResult> {
    const flags = GateGuardSentinelService.detectFlags(content);

    if (flags.celebrity || flags.illegal || flags.nonConsensual) {
      const correlationId = randomUUID();

      await this.persistModerationLog({ userId, twinId, reason: flags.reason, correlationId, flags });

      this.nats.publish(NATS_TOPICS.GATEGUARD_MESSAGE_BLOCKED, {
        user_id: userId,
        twin_id: twinId,
        reason: flags.reason,
        correlation_id: correlationId,
        blocked_at_utc: new Date().toISOString(),
        rule_applied_id: SENTINEL_RULE_ID,
      });

      this.logger.warn('GateGuardSentinelService: message blocked', {
        userId,
        twinId,
        reason: flags.reason,
        correlationId,
        rule_applied_id: SENTINEL_RULE_ID,
      });

      return { blocked: true, message: 'Content not allowed.', flags };
    }

    return { blocked: false };
  }

  // ---------------------------------------------------------------------------
  // Internal — pattern detection
  // ---------------------------------------------------------------------------

  /**
   * Pure, synchronous flag detector. No I/O — safe to call from tests.
   * Exported for unit-test coverage without standing up the full service.
   */
  static detectFlags(content: string): ContentScanFlags {
    const celebrity = CELEBRITY_PATTERNS.some(p => p.test(content));
    const illegal = ILLEGAL_PATTERNS.some(p => p.test(content));
    const nonConsensual = NON_CONSENSUAL_PATTERNS.some(p => p.test(content));

    const reasons: string[] = [];
    if (celebrity) reasons.push('CELEBRITY_LIKENESS');
    if (illegal) reasons.push('ILLEGAL_CONTENT');
    if (nonConsensual) reasons.push('NON_CONSENSUAL');

    return {
      celebrity,
      illegal,
      nonConsensual,
      reason: reasons.length > 0 ? reasons.join(',') : 'NONE',
    };
  }

  // ---------------------------------------------------------------------------
  // Internal — persistence
  // ---------------------------------------------------------------------------

  private async persistModerationLog(params: {
    userId: string;
    twinId: string;
    reason: string;
    correlationId: string;
    flags: ContentScanFlags;
  }): Promise<void> {
    try {
      await delegateFor(this.prisma, 'moderationLog').create({
        data: {
          user_id: params.userId,
          twin_id: params.twinId,
          reason: params.reason,
          correlation_id: params.correlationId,
          celebrity_flag: params.flags.celebrity,
          illegal_flag: params.flags.illegal,
          non_consensual_flag: params.flags.nonConsensual,
          rule_applied_id: SENTINEL_RULE_ID,
        },
      });
    } catch (error) {
      this.logger.error('GateGuardSentinelService: failed to persist moderationLog', {
        userId: params.userId,
        twinId: params.twinId,
        error: String(error),
      });
      throw error;
    }
  }
}
