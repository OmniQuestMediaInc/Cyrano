// OBS: OBS-001 — ChatAggregatorService
// Internal CNZ chat source only — external connectors are OBS-003.
// Normalises each message to ChatMessage and publishes chat.message.ingested
// with a variable jitter delay per GovernanceConfig OBS.CHAT_JITTER_*_MS.
import { Injectable, Logger } from '@nestjs/common';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { OBS } from '../../core-api/src/config/governance.config';
import { NATS_TOPICS } from '../../nats/topics.registry';

export interface ChatMessage {
  id: string;
  source: 'CNZ';
  creator_id: string;
  user_id: string;
  content: string;
  timestamp: string;
  platform_user_id: string;
  organization_id: string;
  tenant_id: string;
}

export interface IngestMessageInput {
  id: string;
  creatorId: string;
  userId: string;
  content: string;
  platformUserId: string;
  organizationId: string;
  tenantId: string;
  timestamp?: string;
}

@Injectable()
export class ChatAggregatorService {
  private readonly logger = new Logger(ChatAggregatorService.name);
  private readonly RULE_ID = 'OBS-001_CHAT_AGGREGATOR_v1';

  constructor(private readonly natsService: NatsService) {}

  /**
   * Ingest a single CNZ chat message.
   * - Normalises to ChatMessage
   * - Logs at info level
   * - Publishes with a jitter delay in [CHAT_JITTER_MIN_MS, CHAT_JITTER_MAX_MS)
   */
  ingest(input: IngestMessageInput): ChatMessage {
    const normalised: ChatMessage = {
      id: input.id,
      source: 'CNZ',
      creator_id: input.creatorId,
      user_id: input.userId,
      content: input.content,
      timestamp: input.timestamp ?? new Date().toISOString(),
      platform_user_id: input.platformUserId,
      organization_id: input.organizationId,
      tenant_id: input.tenantId,
    };

    this.logger.log('ChatAggregatorService.ingest: message ingested', {
      message_id: normalised.id,
      creator_id: normalised.creator_id,
      user_id: normalised.user_id,
      source: normalised.source,
      rule_applied_id: this.RULE_ID,
    });

    const delayMs = this.computeJitterMs();
    setTimeout(() => {
      this.natsService.publish(NATS_TOPICS.CHAT_MESSAGE_INGESTED, {
        ...normalised,
        jitter_delay_ms: delayMs,
        rule_applied_id: this.RULE_ID,
      });
    }, delayMs);

    return normalised;
  }

  /**
   * Pick a random jitter value in [MIN, MAX) milliseconds from GovernanceConfig.
   */
  private computeJitterMs(): number {
    const min = OBS.CHAT_JITTER_MIN_MS;
    const max = OBS.CHAT_JITTER_MAX_MS;
    return Math.floor(Math.random() * (max - min)) + min;
  }
}
