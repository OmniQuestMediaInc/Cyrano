// CRM: Guest-Heat — Gemstone award service
// Business Plan §B.4 — queued symbolic gifting with human-like delayed sending.
//
// Contract:
//   • Queue a gemstone for a guest — persisted to gemstone_awards.
//   • Deliberate delay before send (simulates human-like timing).
//   • Public / private visibility toggle.
//   • Customisable erotic symbolism text; defaults per gem type.
//   • Emits GUEST_HEAT_GEMSTONE_QUEUED and GUEST_HEAT_GEMSTONE_SENT on NATS.

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { PrismaService } from '../../core-api/src/prisma.service';
import { NATS_TOPICS } from '../../nats/topics.registry';
import {
  DEFAULT_SYMBOLISM,
  GUEST_HEAT_RULE_ID,
  type GemstoneAwardRecord,
  type GemStatus,
  type GemType,
  type GemVisibility,
} from './guest-heat.types';

@Injectable()
export class GemstoneService {
  private readonly logger = new Logger(GemstoneService.name);

  /** Pending send timers — keyed by gem_id. Ephemeral; clears on restart. */
  private readonly pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly nats: NatsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Queue a gemstone award for a guest.
   * The gem is persisted as QUEUED and scheduled for delivery after
   * `send_delay_sec` seconds.
   */
  async queueGemstone(
    guest_id: string,
    gem_type: GemType,
    visibility: GemVisibility,
    session_id?: string,
    custom_symbolism?: string,
    send_delay_sec?: number,
    correlation_id: string = randomUUID(),
  ): Promise<GemstoneAwardRecord> {
    const symbolism = custom_symbolism ?? DEFAULT_SYMBOLISM[gem_type];
    const delay_sec = this.resolveDelay(send_delay_sec);

    const row = await this.prisma.gemstoneAward.create({
      data: {
        guest_id,
        session_id,
        gem_type,
        symbolism,
        visibility,
        status: 'QUEUED',
        send_delay_sec: delay_sec,
        correlation_id,
        reason_code: 'GEMSTONE_QUEUED',
        rule_applied_id: GUEST_HEAT_RULE_ID,
      },
    });

    const record: GemstoneAwardRecord = this.mapRow(row);

    this.nats.publish(NATS_TOPICS.GUEST_HEAT_GEMSTONE_QUEUED, {
      ...record,
    } as unknown as Record<string, unknown>);

    this.logger.log('GemstoneService: gemstone queued', {
      gem_id: record.gem_id,
      guest_id,
      gem_type,
      delay_sec,
    });

    // Schedule the delayed send.
    this.scheduleSend(record);

    return record;
  }

  /**
   * Mark a gemstone as SENT (called by the scheduled timer).
   */
  async sendGemstone(gem_id: string): Promise<GemstoneAwardRecord> {
    const now = new Date();

    const row = await this.prisma.gemstoneAward.update({
      where: { id: gem_id },
      data: {
        status: 'SENT',
        sent_at: now,
        reason_code: 'GEMSTONE_SENT',
      },
    });

    const record = this.mapRow(row);

    this.nats.publish(NATS_TOPICS.GUEST_HEAT_GEMSTONE_SENT, {
      ...record,
    } as unknown as Record<string, unknown>);

    this.logger.log('GemstoneService: gemstone sent', {
      gem_id,
      guest_id: record.guest_id,
    });

    this.pendingTimers.delete(gem_id);
    return record;
  }

  /**
   * Toggle gemstone visibility (PUBLIC ↔ PRIVATE).
   */
  async updateVisibility(
    gem_id: string,
    visibility: GemVisibility,
  ): Promise<GemstoneAwardRecord> {
    const row = await this.prisma.gemstoneAward.update({
      where: { id: gem_id },
      data: { visibility },
    });
    return this.mapRow(row);
  }

  /**
   * List pending (QUEUED) gemstones for a guest.
   */
  async listPending(guest_id: string): Promise<GemstoneAwardRecord[]> {
    const rows = await this.prisma.gemstoneAward.findMany({
      where: { guest_id, status: 'QUEUED' },
      orderBy: { created_at: 'asc' },
    });
    return rows.map(r => this.mapRow(r));
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private scheduleSend(gem: GemstoneAwardRecord): void {
    if (gem.send_delay_sec <= 0) {
      // Fire immediately (next tick).
      setImmediate(() => this.sendGemstone(gem.gem_id).catch(err =>
        this.logger.error('GemstoneService: immediate send failed', err),
      ));
      return;
    }

    const timer = setTimeout(() => {
      this.sendGemstone(gem.gem_id).catch(err =>
        this.logger.error('GemstoneService: delayed send failed', err, {
          gem_id: gem.gem_id,
        }),
      );
    }, gem.send_delay_sec * 1_000);

    this.pendingTimers.set(gem.gem_id, timer);
  }

  /**
   * Resolve send delay — bounded to [0..120] seconds to keep the
   * human-like effect realistic.
   */
  private resolveDelay(requested?: number): number {
    if (requested === undefined) {
      // Default: random 5–20 s for human-like pacing.
      return Math.floor(Math.random() * 15) + 5;
    }
    return Math.min(120, Math.max(0, requested));
  }

  private mapRow(row: {
    id: string;
    guest_id: string;
    session_id: string | null;
    gem_type: string;
    symbolism: string;
    visibility: string;
    status: string;
    send_delay_sec: number;
    sent_at: Date | null;
    correlation_id: string;
    reason_code: string;
    rule_applied_id: string;
    created_at: Date;
  }): GemstoneAwardRecord {
    return {
      gem_id: row.id,
      guest_id: row.guest_id,
      session_id: row.session_id ?? undefined,
      gem_type: row.gem_type as GemType,
      symbolism: row.symbolism,
      visibility: row.visibility as GemVisibility,
      status: row.status as GemStatus,
      send_delay_sec: row.send_delay_sec,
      sent_at_utc: row.sent_at?.toISOString(),
      correlation_id: row.correlation_id,
      reason_code: row.reason_code,
      rule_applied_id: row.rule_applied_id,
      created_at_utc: row.created_at.toISOString(),
    };
  }
}
