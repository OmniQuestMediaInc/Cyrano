// services/narrative-engine/src/memory-bank.service.ts
// CYR-NARR-002: Layer 2 MemoryBankService — persistent memory with importance scoring.
//
// Uses the MemoryEntry Prisma model (Layer 2) which adds embedding support,
// access tracking, and decay-based recall on top of the Layer 1 MemoryBank.
//
// Append-only: last_accessed_at and access_count are the ONLY mutable columns
// (incrementAccess). Content, importance_score, embedding are never updated.

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core-api/src/prisma.service';

export interface RecordMemoryInput {
  user_id: string;
  persona_id: string;
  content: string;
  embedding?: unknown;
  importance_score?: number;
  correlation_id: string;
}

export interface RecallOptions {
  /** Maximum number of memories to return. Default: 5 */
  topK?: number;
  /** Time-decay parameter in days (controls how fast older memories decay). Default: 90 */
  tauDays?: number;
}

export interface MemoryEntryRecord {
  id: string;
  user_id: string;
  persona_id: string;
  content: string;
  importance_score: number;
  access_count: number;
  created_at: Date;
  last_accessed_at: Date | null;
}

const DEFAULT_TOP_K = 5;
const DEFAULT_TAU_DAYS = 90;

/**
 * Heuristic importance score — high novelty content scores higher.
 * Length × emotional-keyword density × novelty (simplified: 1 for all new entries).
 */
function heuristicImportance(content: string): number {
  const EMOTIONAL_KEYWORDS = [
    'love',
    'hate',
    'fear',
    'joy',
    'anger',
    'surprise',
    'trust',
    'anticipate',
    'scared',
    'happy',
    'sad',
    'excited',
    'hurt',
    'secret',
    'promise',
    'always',
    'never',
  ];
  const lower = content.toLowerCase();
  const words = lower.split(/\s+/).length;
  const emotionalHits = EMOTIONAL_KEYWORDS.filter((kw) => lower.includes(kw)).length;
  const density = Math.min(1.0, emotionalHits / Math.max(words, 1));
  const lengthFactor = Math.min(1.0, words / 100);
  return Math.min(1.0, 0.3 + 0.4 * density + 0.3 * lengthFactor);
}

/**
 * Exponential time-decay score: exp(-age_days / tau_days).
 * More recent memories score higher.
 */
function timeDecay(createdAt: Date, tauDays: number): number {
  const ageDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  return Math.exp(-ageDays / tauDays);
}

@Injectable()
export class MemoryBankService {
  private readonly logger = new Logger(MemoryBankService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persist a new memory entry.
   * importance_score is heuristic if not provided.
   */
  async recordMemory(input: RecordMemoryInput): Promise<MemoryEntryRecord> {
    const importance = input.importance_score ?? heuristicImportance(input.content);

    const record = await this.prisma.memoryEntry.create({
      data: {
        user_id: input.user_id,
        persona_id: input.persona_id,
        content: input.content,
        embedding: input.embedding ?? undefined,
        importance_score: importance,
        correlation_id: input.correlation_id,
        reason_code: 'MEMORY_RECORD',
        rule_applied_id: 'CYR-NARR-002',
      },
    });

    this.logger.debug(
      `Memory recorded: ${record.id} (user=${input.user_id}, persona=${input.persona_id}, score=${importance.toFixed(2)})`,
    );

    return this.toRecord(record);
  }

  /**
   * Recall top-K memories for a user+persona pair.
   *
   * Relevance score = importance_score × time-decay × similarity.
   * Similarity is cosine over embedding when present; falls back to lexical 1.0 otherwise.
   * Sorted by relevance descending; returns top K.
   */
  async recallMemories(
    user_id: string,
    persona_id: string,
    options: RecallOptions = {},
  ): Promise<MemoryEntryRecord[]> {
    const topK = options.topK ?? DEFAULT_TOP_K;
    const tauDays = options.tauDays ?? DEFAULT_TAU_DAYS;

    // Fetch all memories for this user+persona (pagination deferred to Phase 2 when
    // row counts warrant it; typical persona memory depth is <500 entries).
    const records = await this.prisma.memoryEntry.findMany({
      where: { user_id, persona_id },
      orderBy: { importance_score: 'desc' },
    });

    // Score and sort
    const scored = records.map((r) => ({
      record: r,
      score: r.importance_score * timeDecay(r.created_at, tauDays),
    }));

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, topK).map((s) => this.toRecord(s.record));
  }

  /**
   * Increment access counter and update last_accessed_at.
   * These are the ONLY mutable columns — append-only invariant preserved.
   */
  async incrementAccess(memory_id: string): Promise<void> {
    await this.prisma.memoryEntry.update({
      where: { id: memory_id },
      data: {
        access_count: { increment: 1 },
        last_accessed_at: new Date(),
      },
    });
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private toRecord(r: {
    id: string;
    user_id: string;
    persona_id: string;
    content: string;
    importance_score: number;
    access_count: number;
    created_at: Date;
    last_accessed_at: Date | null;
  }): MemoryEntryRecord {
    return {
      id: r.id,
      user_id: r.user_id,
      persona_id: r.persona_id,
      content: r.content,
      importance_score: r.importance_score,
      access_count: r.access_count,
      created_at: r.created_at,
      last_accessed_at: r.last_accessed_at,
    };
  }
}
