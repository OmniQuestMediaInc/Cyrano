// PAYLOAD 5 — Cyrano persistent session memory
// Keyed by (creator_id, guest_id) — facts, arcs, inferences persist across
// sessions so Cyrano can surface callback suggestions and recovery nudges.
//
// Layer 1 hardening (Phase 1.6):
//   • In-memory cache backs synchronous reads (no breaking change).
//   • PrismaService is injected lazily via @Optional() — when present, every
//     upsert is persisted to `cyrano_session_memory` asynchronously and
//     the store is rehydrated lazily on first read for a (creator,guest)
//     pair.
//   • Hermetic tests construct the store with `new SessionMemoryStore()`
//     and continue to operate purely in-memory.

import { Injectable, Logger, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../core-api/src/prisma.service';
import type { MemoryFact } from './cyrano.types';

export interface SessionArc {
  arc_id: string;
  started_at_utc: string;
  topic: string;
  last_touched_at_utc: string;
}

interface MemoryRecord {
  facts: Map<string, MemoryFact>;
  arcs: Map<string, SessionArc>;
}

export const CYRANO_MEMORY_RULE_ID = 'CYRANO_MEMORY_v1';

function memKey(creatorId: string, guestId: string): string {
  return `${creatorId}::${guestId}`;
}

@Injectable()
export class SessionMemoryStore {
  private readonly logger = new Logger(SessionMemoryStore.name);
  private readonly store = new Map<string, MemoryRecord>();
  /** Tracks pairs that have been hydrated from Postgres at least once. */
  private readonly hydrated = new Set<string>();

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  private ensure(creatorId: string, guestId: string): MemoryRecord {
    const key = memKey(creatorId, guestId);
    let rec = this.store.get(key);
    if (!rec) {
      rec = { facts: new Map(), arcs: new Map() };
      this.store.set(key, rec);
    }
    return rec;
  }

  upsertFact(args: {
    creator_id: string;
    guest_id: string;
    fact: MemoryFact;
    correlation_id?: string;
    reason_code?: string;
  }): void {
    const rec = this.ensure(args.creator_id, args.guest_id);
    rec.facts.set(args.fact.key, args.fact);
    this.logger.debug('SessionMemoryStore: fact upserted', {
      creator_id: args.creator_id,
      guest_id: args.guest_id,
      key: args.fact.key,
    });
    void this.persistFact(args);
  }

  listFacts(creatorId: string, guestId: string): MemoryFact[] {
    void this.hydrateIfNeeded(creatorId, guestId);
    const rec = this.store.get(memKey(creatorId, guestId));
    if (!rec) return [];
    return Array.from(rec.facts.values());
  }

  getFact(creatorId: string, guestId: string, key: string): MemoryFact | null {
    void this.hydrateIfNeeded(creatorId, guestId);
    const rec = this.store.get(memKey(creatorId, guestId));
    return rec?.facts.get(key) ?? null;
  }

  upsertArc(args: {
    creator_id: string;
    guest_id: string;
    arc: SessionArc;
    correlation_id?: string;
    reason_code?: string;
  }): void {
    const rec = this.ensure(args.creator_id, args.guest_id);
    rec.arcs.set(args.arc.arc_id, args.arc);
    void this.persistArc(args);
  }

  listArcs(creatorId: string, guestId: string): SessionArc[] {
    void this.hydrateIfNeeded(creatorId, guestId);
    const rec = this.store.get(memKey(creatorId, guestId));
    if (!rec) return [];
    return Array.from(rec.arcs.values());
  }

  /**
   * Soft-delete every memory row for a guest (Law 25 / Cyrano-side purge).
   * Marks rows as `is_purged = true` and clears the in-memory cache for any
   * (creator, guest) pair. Idempotent.
   */
  async purgeGuest(args: { guest_id: string; correlation_id: string }): Promise<number> {
    // Drop the in-memory cache for this guest across every creator pair.
    for (const [key] of this.store) {
      if (key.endsWith(`::${args.guest_id}`)) this.store.delete(key);
      if (key.endsWith(`::${args.guest_id}`)) this.hydrated.delete(key);
    }

    if (!this.prisma) return 0;
    try {
      const result = await this.prisma.cyranoSessionMemory.updateMany({
        where: { guest_id: args.guest_id, is_purged: false },
        data: {
          is_purged: true,
          correlation_id: args.correlation_id,
          reason_code: 'CYRANO_MEMORY_PURGED',
        },
      });
      this.logger.log('SessionMemoryStore: guest memory purged', {
        guest_id: args.guest_id,
        rows_affected: result.count,
      });
      return result.count;
    } catch (err) {
      this.logger.warn('SessionMemoryStore: purge failed', {
        guest_id: args.guest_id,
        error: String(err),
      });
      return 0;
    }
  }

  /** Test seam. Clears in-memory cache only — does not touch the DB. */
  reset(): void {
    this.store.clear();
    this.hydrated.clear();
  }

  // ── DB persistence (no-op when PrismaService is not injected) ──────────────

  private async persistFact(args: {
    creator_id: string;
    guest_id: string;
    fact: MemoryFact;
    correlation_id?: string;
    reason_code?: string;
  }): Promise<void> {
    if (!this.prisma) return;
    const correlation_id = args.correlation_id ?? `cyrano-fact-${randomUUID()}`;
    const reason_code = args.reason_code ?? 'CYRANO_MEMORY_FACT_UPSERT';
    try {
      await this.prisma.cyranoSessionMemory.upsert({
        where: {
          creator_id_guest_id_memory_type_memory_key: {
            creator_id: args.creator_id,
            guest_id: args.guest_id,
            memory_type: 'FACT',
            memory_key: args.fact.key,
          },
        },
        update: {
          memory_value: args.fact as unknown as object,
          confidence: args.fact.confidence,
          last_touched_at: new Date(),
          is_purged: false,
          correlation_id,
          reason_code,
        },
        create: {
          creator_id: args.creator_id,
          guest_id: args.guest_id,
          memory_type: 'FACT',
          memory_key: args.fact.key,
          memory_value: args.fact as unknown as object,
          confidence: args.fact.confidence,
          last_touched_at: new Date(),
          correlation_id,
          reason_code,
          rule_applied_id: CYRANO_MEMORY_RULE_ID,
        },
      });
    } catch (err) {
      this.logger.warn('SessionMemoryStore: fact persist failed', {
        creator_id: args.creator_id,
        guest_id: args.guest_id,
        key: args.fact.key,
        error: String(err),
      });
    }
  }

  private async persistArc(args: {
    creator_id: string;
    guest_id: string;
    arc: SessionArc;
    correlation_id?: string;
    reason_code?: string;
  }): Promise<void> {
    if (!this.prisma) return;
    const correlation_id = args.correlation_id ?? `cyrano-arc-${randomUUID()}`;
    const reason_code = args.reason_code ?? 'CYRANO_MEMORY_ARC_UPSERT';
    try {
      await this.prisma.cyranoSessionMemory.upsert({
        where: {
          creator_id_guest_id_memory_type_memory_key: {
            creator_id: args.creator_id,
            guest_id: args.guest_id,
            memory_type: 'ARC',
            memory_key: args.arc.arc_id,
          },
        },
        update: {
          memory_value: args.arc as unknown as object,
          last_touched_at: new Date(args.arc.last_touched_at_utc),
          is_purged: false,
          correlation_id,
          reason_code,
        },
        create: {
          creator_id: args.creator_id,
          guest_id: args.guest_id,
          memory_type: 'ARC',
          memory_key: args.arc.arc_id,
          memory_value: args.arc as unknown as object,
          last_touched_at: new Date(args.arc.last_touched_at_utc),
          correlation_id,
          reason_code,
          rule_applied_id: CYRANO_MEMORY_RULE_ID,
        },
      });
    } catch (err) {
      this.logger.warn('SessionMemoryStore: arc persist failed', {
        creator_id: args.creator_id,
        guest_id: args.guest_id,
        arc_id: args.arc.arc_id,
        error: String(err),
      });
    }
  }

  /**
   * Lazily rehydrate the in-memory cache for a (creator, guest) pair from
   * Postgres on first read. Fire-and-forget — synchronous callers see the
   * (possibly empty) cache; subsequent reads benefit from the populated rows.
   */
  private async hydrateIfNeeded(creatorId: string, guestId: string): Promise<void> {
    if (!this.prisma) return;
    const key = memKey(creatorId, guestId);
    if (this.hydrated.has(key)) return;
    this.hydrated.add(key);
    try {
      const rows = await this.prisma.cyranoSessionMemory.findMany({
        where: { creator_id: creatorId, guest_id: guestId, is_purged: false },
      });
      const rec = this.ensure(creatorId, guestId);
      for (const row of rows) {
        if (row.memory_type === 'FACT') {
          const fact = row.memory_value as unknown as MemoryFact;
          if (fact && typeof fact.key === 'string') rec.facts.set(fact.key, fact);
        } else if (row.memory_type === 'ARC') {
          const arc = row.memory_value as unknown as SessionArc;
          if (arc && typeof arc.arc_id === 'string') rec.arcs.set(arc.arc_id, arc);
        }
      }
      this.logger.debug('SessionMemoryStore: hydrated from Postgres', {
        creator_id: creatorId,
        guest_id: guestId,
        rows: rows.length,
      });
    } catch (err) {
      // Hydration failure is non-fatal — the cache stays empty until the next
      // upsert. Drop the marker so the next read may retry.
      this.hydrated.delete(key);
      this.logger.warn('SessionMemoryStore: hydration failed', {
        creator_id: creatorId,
        guest_id: guestId,
        error: String(err),
      });
    }
  }
}
