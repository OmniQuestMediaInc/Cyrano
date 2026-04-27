// services/narrative-engine/src/narrative.service.ts
// CYR: Narrative Engine Service — persistent memory + cinematic branching
//
// Responsibilities:
//   1. Store and recall long-term user memory (facts, preferences, story beats)
//   2. Score memory entries by importance for prioritised recall
//   3. Present cinematic branching points to users and resolve their choices
//   4. Assemble persona-context injections for the Cyrano LLM layer
//   5. Emit NATS events on story milestones

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core-api/src/prisma.module';
import { NatsService } from '../../core-api/src/nats/nats.service';
import {
  BranchDecision,
  BranchResolution,
  BuildContextRequest,
  MemoryEntry,
  MemoryType,
  NarrativeBranch,
  NarrativeContext,
} from './narrative.types';

const NATS_STORY_BEAT = 'cyrano.narrative.story-beat';
const NATS_BRANCH_RESOLVED = 'cyrano.narrative.branch.resolved';

/** Default memory retention window in days — configurable per tier */
const rawTtl = parseInt(process.env.NARRATIVE_MEMORY_TTL_DAYS ?? '365', 10);
const MEMORY_TTL_DAYS = Number.isFinite(rawTtl) && rawTtl > 0 ? rawTtl : 365;

/**
 * System instruction prefix injected into every Cyrano session prompt.
 * Override via NARRATIVE_PERSONA_HEADER env var (must be a single-line string;
 * use \n literals for newlines).
 */
const SYSTEM_PERSONA_HEADER =
  process.env.NARRATIVE_PERSONA_HEADER ??
  'You are a Cyrano™ AI character. You have a continuous, persistent relationship with ' +
    'this user. Recall the following memories and honour them in every response. Never break ' +
    'character. Speak with emotional depth, warmth, and narrative continuity.\n\n';

@Injectable()
export class NarrativeService {
  private readonly logger = new Logger(NarrativeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly nats: NatsService,
  ) {}

  /**
   * Store a new memory for a user+twin pair.
   * importance_score drives recall priority — STORY_BEAT and SECRET are
   * pinned at high importance; FACT and PREFERENCE are user-defined or inferred.
   */
  async storeMemory(params: {
    session_id: string;
    twin_id: string;
    user_id: string;
    memory_type: MemoryType;
    content: string;
    importance_score?: number;
    expires_in_days?: number;
    correlation_id: string;
  }): Promise<MemoryEntry> {
    const defaultScore = this.defaultImportanceScore(params.memory_type);
    const ttlDays = params.expires_in_days ?? MEMORY_TTL_DAYS;
    const expiresAt = new Date(Date.now() + ttlDays * 86_400_000);

    const record = await this.prisma.memoryBank.create({
      data: {
        session_id: params.session_id,
        twin_id: params.twin_id,
        user_id: params.user_id,
        memory_type: params.memory_type,
        content: params.content,
        importance_score: params.importance_score ?? defaultScore,
        expires_at: expiresAt,
        correlation_id: params.correlation_id,
        reason_code: 'MEMORY_STORE',
      },
    });

    if (params.memory_type === 'STORY_BEAT') {
      await this.nats.publish(NATS_STORY_BEAT, {
        twin_id: params.twin_id,
        user_id: params.user_id,
        content: params.content,
      });
    }

    return this.toMemoryEntry(record);
  }

  /**
   * Recall the top N most important memories for a user+twin pair.
   * Filters out expired entries. Used for context window injection.
   */
  async recallMemories(
    twin_id: string,
    user_id: string,
    limit = 20,
  ): Promise<MemoryEntry[]> {
    const records = await this.prisma.memoryBank.findMany({
      where: {
        twin_id,
        user_id,
        OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
      },
      orderBy: { importance_score: 'desc' },
      take: limit,
    });

    return records.map((r) => this.toMemoryEntry(r));
  }

  /**
   * Build a fully assembled narrative context for injection into the LLM.
   * Recalls memories, loads any active branch, and assembles the prompt string.
   */
  async buildContext(req: BuildContextRequest): Promise<NarrativeContext> {
    const memories = await this.recallMemories(
      req.twin_id,
      req.user_id,
      req.max_memory_entries ?? 20,
    );

    const activeBranchRecord = await this.prisma.narrativeBranch.findFirst({
      where: { twin_id: req.twin_id, user_id: req.user_id, resolved: false },
      orderBy: { created_at: 'desc' },
    });

    const activeBranch = activeBranchRecord
      ? this.toBranchSummary(activeBranchRecord)
      : null;

    const memoryBlock =
      memories.length > 0
        ? 'MEMORY BANK:\n' +
          memories
            .map((m) => `[${m.memory_type}] ${m.content}`)
            .join('\n')
        : '';

    const branchBlock = activeBranch
      ? `\nACTIVE STORY BRANCH: "${activeBranch.branch_title}" — ${activeBranch.branch_premise}`
      : '';

    const personaPromptInjection =
      SYSTEM_PERSONA_HEADER + memoryBlock + branchBlock;

    return {
      twin_id: req.twin_id,
      user_id: req.user_id,
      recalled_memories: memories,
      active_branch: activeBranch,
      persona_prompt_injection: personaPromptInjection,
    };
  }

  /**
   * Create a cinematic branching point for a user to choose their next
   * story direction. Surfaced in the Cyrano UI as a choice card.
   */
  async createBranch(params: {
    twin_id: string;
    user_id: string;
    branch_title: string;
    branch_premise: string;
    decision_prompt: string;
    options: Array<{ option_key: string; label: string; consequence_hint: string }>;
    correlation_id: string;
  }): Promise<NarrativeBranch> {
    const record = await this.prisma.narrativeBranch.create({
      data: {
        twin_id: params.twin_id,
        user_id: params.user_id,
        branch_title: params.branch_title,
        branch_premise: params.branch_premise,
        decision_prompt: params.decision_prompt,
        options_json: JSON.stringify(params.options),
        resolved: false,
        correlation_id: params.correlation_id,
        reason_code: 'BRANCH_CREATE',
      },
    });

    return this.toBranchSummary(record);
  }

  /**
   * Resolve a branch choice. Writes a STORY_BEAT memory capturing the
   * narrative consequence and marks the branch resolved.
   */
  async resolveBranch(
    branch_id: string,
    chosen_option_key: string,
    correlation_id: string,
  ): Promise<BranchResolution> {
    const branch = await this.prisma.narrativeBranch.findUniqueOrThrow({ where: { branch_id } });
    const parsedOptions = this.parseOptionsJson(branch.options_json, branch_id);
    const options = parsedOptions;

    const chosen = options.find((o) => o.option_key === chosen_option_key);
    if (!chosen) {
      throw new Error(`Unknown option key: ${chosen_option_key}`);
    }

    const consequence = `Story branch "${branch.branch_title}" resolved: ${chosen.label}. ${chosen.consequence_hint}`;

    await this.prisma.narrativeBranch.update({
      where: { branch_id },
      data: { resolved: true, chosen_option_key, resolved_at: new Date() },
    });

    await this.storeMemory({
      session_id: `branch:${branch_id}`,
      twin_id: branch.twin_id,
      user_id: branch.user_id,
      memory_type: 'STORY_BEAT',
      content: consequence,
      importance_score: 0.9,
      correlation_id,
    });

    await this.nats.publish(NATS_BRANCH_RESOLVED, { branch_id, chosen_option_key });

    return {
      branch_id,
      chosen_option_key,
      decision: 'ACCEPT' as BranchDecision,
      narrative_consequence: consequence,
      resolved_at_utc: new Date().toISOString(),
    };
  }

  /**
   * Inject a system upgrade nudge as a pinned STORY_BEAT memory entry.
   * Called by the chat layer when a Spark user crosses the nudge threshold
   * so the nudge is contextually recalled in subsequent LLM prompts.
   */
  async storeUpgradeNudge(params: {
    twin_id: string;
    user_id: string;
    content: string;
    correlation_id: string;
  }): Promise<MemoryEntry> {
    return this.storeMemory({
      session_id: `nudge:${params.user_id}:${params.twin_id}`,
      twin_id: params.twin_id,
      user_id: params.user_id,
      memory_type: 'STORY_BEAT',
      content: params.content,
      importance_score: 0.95,
      correlation_id: params.correlation_id,
    });
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private defaultImportanceScore(type: MemoryType): number {
    const scores: Record<MemoryType, number> = {
      SECRET: 1.0,
      STORY_BEAT: 0.9,
      RELATIONSHIP: 0.85,
      EMOTION: 0.6,
      FACT: 0.7,
      PREFERENCE: 0.5,
    };
    return scores[type] ?? 0.5;
  }

  private toMemoryEntry(r: {
    memory_id: string;
    session_id: string;
    twin_id: string;
    user_id: string;
    memory_type: string;
    content: string;
    importance_score: number;
    created_at: Date;
    expires_at: Date | null;
  }): MemoryEntry {
    return {
      memory_id: r.memory_id,
      session_id: r.session_id,
      twin_id: r.twin_id,
      user_id: r.user_id,
      memory_type: r.memory_type as MemoryType,
      content: r.content,
      importance_score: r.importance_score,
      created_at_utc: r.created_at.toISOString(),
      expires_at_utc: r.expires_at?.toISOString() ?? null,
    };
  }

  private toBranchSummary(r: {
    branch_id: string;
    twin_id: string;
    user_id: string;
    branch_title: string;
    branch_premise: string;
    decision_prompt: string;
    options_json: unknown;
    created_at: Date;
  }): NarrativeBranch {
    return {
      branch_id: r.branch_id,
      twin_id: r.twin_id,
      user_id: r.user_id,
      branch_title: r.branch_title,
      branch_premise: r.branch_premise,
      decision_prompt: r.decision_prompt,
      options: this.parseOptionsJson(r.options_json, r.branch_id),
      created_at_utc: r.created_at.toISOString(),
    };
  }

  /**
   * Safely parse the options_json column. Validates that the result is a
   * non-empty array of objects with the expected keys to guard against
   * malformed data written by older code paths.
   */
  private parseOptionsJson(
    raw: unknown,
    contextId: string,
  ): Array<{ option_key: string; label: string; consequence_hint: string }> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw));
    } catch {
      throw new Error(`NarrativeBranch ${contextId}: options_json is not valid JSON`);
    }

    if (!Array.isArray(parsed)) {
      throw new Error(`NarrativeBranch ${contextId}: options_json must be an array`);
    }

    for (const item of parsed) {
      if (
        typeof item !== 'object' ||
        item === null ||
        typeof (item as Record<string, unknown>).option_key !== 'string' ||
        typeof (item as Record<string, unknown>).label !== 'string' ||
        typeof (item as Record<string, unknown>).consequence_hint !== 'string'
      ) {
        throw new Error(
          `NarrativeBranch ${contextId}: options_json contains an invalid option entry`,
        );
      }
    }

    return parsed as Array<{ option_key: string; label: string; consequence_hint: string }>;
  }
}
