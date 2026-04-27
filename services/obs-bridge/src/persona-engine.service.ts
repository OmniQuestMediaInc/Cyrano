// OBS: OBS-001 — PersonaEngineService
// Rule-based pass only. No AI call (deferred to OBS-004).
// Gated by Creator.creator_auto: when true, applies the Ontario Bill 149
// disclosure prefix to every generated response before publishing.
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../core-api/src/prisma.service';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { OBS } from '../../core-api/src/config/governance.config';
import { NATS_TOPICS } from '../../nats/topics.registry';

interface IngestedChatPayload {
  id?: string;
  creator_id?: string;
  user_id?: string;
  content?: string;
  organization_id?: string;
  tenant_id?: string;
}

@Injectable()
export class PersonaEngineService implements OnModuleInit {
  private readonly logger = new Logger(PersonaEngineService.name);
  private readonly RULE_ID = 'OBS-001_PERSONA_ENGINE_v1';

  constructor(
    private readonly prisma: PrismaService,
    private readonly natsService: NatsService,
  ) {}

  onModuleInit(): void {
    this.natsService.subscribe(NATS_TOPICS.CHAT_MESSAGE_INGESTED, (payload) => {
      void this.handleIngested(payload as IngestedChatPayload);
    });
    this.logger.log('PersonaEngineService: subscribed to CHAT_MESSAGE_INGESTED', {
      rule_applied_id: this.RULE_ID,
    });
  }

  /**
   * React to an ingested chat message.
   * - If Creator.creator_auto = false: no auto-response generated (log & return).
   * - If Creator.creator_auto = true: generate rule-based response, prefix with
   *   Bill 149 disclosure from GovernanceConfig, publish PERSONA_RESPONSE_QUEUED.
   */
  async handleIngested(payload: IngestedChatPayload): Promise<void> {
    const creatorId = payload.creator_id;
    const userId = payload.user_id;
    const content = payload.content ?? '';
    const organizationId = payload.organization_id ?? '';
    const tenantId = payload.tenant_id ?? '';
    const sourceMessageId = payload.id;

    if (!creatorId) {
      this.logger.warn('PersonaEngineService: missing creator_id — skipped', {
        rule_applied_id: this.RULE_ID,
      });
      return;
    }

    const creator = await this.prisma.creator.findUnique({ where: { id: creatorId } });
    if (!creator) {
      this.logger.warn('PersonaEngineService: creator not found — skipped', {
        creator_id: creatorId,
        rule_applied_id: this.RULE_ID,
      });
      return;
    }

    if (!creator.creator_auto) {
      this.logger.log('PersonaEngineService: CREATOR_AUTO=false — no auto-response', {
        creator_id: creatorId,
        source_message_id: sourceMessageId,
        rule_applied_id: this.RULE_ID,
      });
      return;
    }

    const baseResponse = this.generateRuleBasedResponse(content);
    // Bill 149 disclosure prefix — from GovernanceConfig only, never hardcoded.
    const response = `${OBS.BILL_149_DISCLOSURE_PREFIX}${baseResponse}`;

    this.logger.log('PersonaEngineService: response queued (CREATOR_AUTO=true)', {
      creator_id: creatorId,
      source_message_id: sourceMessageId,
      rule_applied_id: this.RULE_ID,
    });

    this.natsService.publish(NATS_TOPICS.PERSONA_RESPONSE_QUEUED, {
      creator_id: creatorId,
      responding_to_user_id: userId,
      source_message_id: sourceMessageId,
      response,
      disclosure_prefix_applied: true,
      organization_id: organizationId,
      tenant_id: tenantId,
      rule_applied_id: this.RULE_ID,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Rule-based stub response. OBS-004 replaces this with a real AI call.
   */
  private generateRuleBasedResponse(content: string): string {
    const snippet = content.length > 60 ? `${content.substring(0, 60)}…` : content;
    return `Thanks for the message: "${snippet}"`;
  }
}
