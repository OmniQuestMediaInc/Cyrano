// services/core-api/src/gateguard/chat-guard.service.ts
// GGS: ChatGuard — NATS-driven chat-flow gate.
// Business Plan B.5 — applies GateGuardSentinel + WelfareGuardian in sequence
// before every inbound chat message is forwarded or persisted.
//
// Subscribes to CHAT_MESSAGE_INGESTED. For each message:
//   1. Run GateGuardSentinelService.scanMessage() — if blocked, drop and return.
//   2. Run WelfareGuardianService.monitorConversation() — may emit a welfare message.
//
// Expected CHAT_MESSAGE_INGESTED payload fields:
//   user_id        string   — required
//   content        string   — required
//   twin_id        string   — required (AI twin / creator ID)
//   recent_messages string[] — optional sliding window of prior messages

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { NatsService } from '../nats/nats.service';
import { NATS_TOPICS } from '../../../nats/topics.registry';
import { GateGuardSentinelService } from './gateguard-sentinel.service';
import { WelfareGuardianService } from './welfare-guardian.service';

@Injectable()
export class ChatGuardService implements OnModuleInit {
  private readonly logger = new Logger(ChatGuardService.name);

  constructor(
    private readonly sentinel: GateGuardSentinelService,
    private readonly welfare: WelfareGuardianService,
    private readonly nats: NatsService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.nats.subscribe(NATS_TOPICS.CHAT_MESSAGE_INGESTED, (payload) => {
      this.handleChatMessage(payload).catch((err) => {
        this.logger.error('ChatGuardService: unhandled error in handleChatMessage', {
          error: String(err),
        });
      });
    });

    this.logger.log('ChatGuardService: subscribed to CHAT_MESSAGE_INGESTED', {
      topic: NATS_TOPICS.CHAT_MESSAGE_INGESTED,
    });
  }

  // ---------------------------------------------------------------------------
  // Internal — per-message pipeline
  // ---------------------------------------------------------------------------

  private async handleChatMessage(payload: Record<string, unknown>): Promise<void> {
    const userId = payload['user_id'] as string | undefined;
    const content = payload['content'] as string | undefined;
    const twinId = (payload['twin_id'] ?? payload['creator_id']) as string | undefined;
    const recentMessages = (payload['recent_messages'] as string[] | undefined) ?? [];

    if (!userId || !content || !twinId) {
      this.logger.warn('ChatGuardService: skipped — missing required fields', {
        hasUserId: !!userId,
        hasContent: !!content,
        hasTwinId: !!twinId,
      });
      return;
    }

    // Step 1 — Content gate (celebrity likeness, illegal content, non-consensual).
    const gate = await this.sentinel.scanMessage(userId, content, twinId);
    if (gate.blocked) {
      // Message is blocked — do not proceed to welfare check or message save.
      return;
    }

    // Step 2 — Welfare monitoring (distress detection on the sliding window).
    await this.welfare.monitorConversation(userId, [...recentMessages, content]);
  }
}
