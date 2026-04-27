// PAYLOAD 5+ — Cyrano Layer 3 (HCZ) consumer stub
// Phase 3.11 — HCZ (Human Contact Zone) routes Cyrano insights through the
// scheduling + welfare-guardian pipelines. This stub subscribes to the HCZ
// shift NATS topics and surfaces a single suggestion per shift hand-off,
// using the shared prompt-template engine.
//
// Implementation status: STUB. The real Layer 3 wires into the RedBook
// rate card and the welfare-guardian score; this scaffolding only fans
// HCZ shift events into a deterministic suggestion record.

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { NATS_TOPICS } from '../../nats/topics.registry';
import { resolvePromptTemplate, type CyranoTier } from './cyrano-prompt-templates';
import type { CyranoCategory, CyranoDomain } from './cyrano.types';

export const CYRANO_LAYER3_RULE_ID = 'CYRANO_LAYER_3_HCZ_v1';

@Injectable()
export class CyranoLayer3HczService implements OnModuleInit {
  private readonly logger = new Logger(CyranoLayer3HczService.name);

  constructor(private readonly nats: NatsService) {}

  async onModuleInit(): Promise<void> {
    this.subscribeShiftEvents();
    this.logger.log('CyranoLayer3HczService: subscribed to HCZ shift events', {
      rule_applied_id: CYRANO_LAYER3_RULE_ID,
    });
  }

  private subscribeShiftEvents(): void {
    // Re-use the existing GZ schedule shift NATS subjects — HCZ is the
    // human-contact extension of the same scheduling fabric.
    this.nats.subscribe(NATS_TOPICS.SCHEDULE_SHIFT_ASSIGNED, (payload) => {
      this.emitShiftBriefing(payload, 'CAT_SESSION_OPEN');
    });
    this.nats.subscribe(NATS_TOPICS.SCHEDULE_SHIFT_SWAPPED, (payload) => {
      this.emitShiftBriefing(payload, 'CAT_CALLBACK');
    });
    this.nats.subscribe(NATS_TOPICS.SCHEDULE_GAP_FILLED, (payload) => {
      this.emitShiftBriefing(payload, 'CAT_RECOVERY');
    });
  }

  private emitShiftBriefing(
    payload: Record<string, unknown>,
    category: CyranoCategory,
  ): void {
    const domain: CyranoDomain = 'COACHING'; // HCZ defaults to coaching tone.
    const tier: CyranoTier = 'WARM';
    const template = resolvePromptTemplate({ category, domain, tier });
    if (!template) return;

    const copy = template({ tone: 'hcz_calm', tier });
    const suggestion = {
      suggestion_id: randomUUID(),
      origin: 'CYRANO_LAYER_3_HCZ',
      category,
      domain,
      tier,
      copy,
      shift_payload: payload,
      emitted_at_utc: new Date().toISOString(),
      rule_applied_id: CYRANO_LAYER3_RULE_ID,
    };

    this.nats.publish(NATS_TOPICS.CYRANO_SUGGESTION_EMITTED, suggestion);
    this.logger.debug('CyranoLayer3HczService: HCZ briefing emitted', {
      category,
      shift_id: payload['shift_id'] ?? null,
    });
  }
}
