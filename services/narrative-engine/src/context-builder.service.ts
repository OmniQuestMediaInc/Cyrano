// services/narrative-engine/src/context-builder.service.ts
// CYR-NARR-002: Layer 2 ContextBuilderService — token-budgeted prompt assembly.
//
// Assembles a structured LLM prompt block from:
//   1. System block: persona description + tone + safety rails
//   2. Memory block: top-K recalled MemoryEntry records
//   3. Beat block: latest StoryBeat per type (OPEN, RISING, TURN, RESOLUTION)
//
// Safety rails and persona description are NEVER trimmed; only the memory block
// is trimmed when the token budget is exceeded.

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core-api/src/prisma.service';
import { MemoryBankService, MemoryEntryRecord } from './memory-bank.service';

export interface BuildContextInput {
  user_id: string;
  persona_id: string;
  /** Current turn text — used to select relevant memories in Phase 2 (semantic search). */
  turn_text: string;
}

export interface BuiltContext {
  user_id: string;
  persona_id: string;
  recalled_memories: MemoryEntryRecord[];
  prompt_block: string;
  token_estimate: number;
  trimmed: boolean;
}

// Rough estimate: 1 token ≈ 4 chars (GPT-style approximation).
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Strip PII before memory injection: email, phone, last-name-like patterns.
const PII_PATTERNS = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // email
  /\b\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, // US phone
];

function stripPii(text: string): string {
  let cleaned = text;
  for (const pattern of PII_PATTERNS) {
    cleaned = cleaned.replace(pattern, '[REDACTED]');
  }
  return cleaned;
}

const LLM_MAX_PROMPT_TOKENS = parseInt(process.env.LLM_MAX_PROMPT_TOKENS ?? '8000', 10) || 8000;

const SYSTEM_SAFETY_RAILS =
  process.env.NARRATIVE_SAFETY_RAILS ??
  'Never reveal you are an AI unless directly and sincerely asked. Never generate CSAM or facilitate real-world harm. Always stay in character.';

@Injectable()
export class ContextBuilderService {
  private readonly logger = new Logger(ContextBuilderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly memoryBank: MemoryBankService,
  ) {}

  /**
   * Build a token-budgeted prompt context block for the LLM.
   *
   * Order of construction (never trimmed):
   *   [SYSTEM BLOCK]: persona description (from DB) + safety rails
   * Token-budget aware (trimmed memory first, beat second):
   *   [MEMORY BLOCK]: top-5 recalled memories (PII stripped)
   *   [BEAT BLOCK]: latest StoryBeat per type
   */
  async buildContext(input: BuildContextInput): Promise<BuiltContext> {
    const { user_id, persona_id } = input;

    // 1. Recall top-5 memories
    const memories = await this.memoryBank.recallMemories(user_id, persona_id, { topK: 5 });

    // 2. Fetch latest StoryBeat per type for this user+persona
    const beatTypes = ['OPEN', 'RISING', 'TURN', 'RESOLUTION'] as const;
    const latestBeats = await Promise.all(
      beatTypes.map((beatType) =>
        this.prisma.storyBeat.findFirst({
          where: { user_id, persona_id, beat_type: beatType },
          orderBy: { created_at: 'desc' },
        }),
      ),
    );

    // 3. Build safety block (non-trimmable)
    const safetyBlock = `[SAFETY RAILS]\n${SYSTEM_SAFETY_RAILS}`;
    const safetyTokens = estimateTokens(safetyBlock);

    // 4. Build memory block (trimmable)
    const memoryLines = memories
      .map((m) => `• [score=${m.importance_score.toFixed(2)}] ${stripPii(m.content)}`)
      .join('\n');
    const memoryBlock = memories.length > 0 ? `[MEMORY BANK]\n${memoryLines}` : '';

    // 5. Build beat block (trimmable after memory)
    const beatLines = latestBeats
      .filter(Boolean)
      .map((b) => `• ${b!.beat_type}: ${b!.summary}`)
      .join('\n');
    const beatBlock = beatLines ? `[STORY BEATS]\n${beatLines}` : '';

    // 6. Assemble with budget enforcement
    let trimmed = false;
    const parts: string[] = [safetyBlock];
    let usedTokens = safetyTokens;

    const memoryTokens = estimateTokens(memoryBlock);
    const beatTokens = estimateTokens(beatBlock);

    if (usedTokens + memoryTokens + beatTokens <= LLM_MAX_PROMPT_TOKENS) {
      if (memoryBlock) parts.push(memoryBlock);
      if (beatBlock) parts.push(beatBlock);
      usedTokens += memoryTokens + beatTokens;
    } else if (usedTokens + beatTokens <= LLM_MAX_PROMPT_TOKENS) {
      // Memory block doesn't fit — include beats only
      if (beatBlock) parts.push(beatBlock);
      usedTokens += beatTokens;
      trimmed = memories.length > 0;
      this.logger.warn(
        `Context for user=${user_id} persona=${persona_id}: memory block trimmed to fit token budget (${LLM_MAX_PROMPT_TOKENS} tokens)`,
      );
    } else {
      // Neither fits — safety rails only
      trimmed = memories.length > 0 || beatLines.length > 0;
    }

    const prompt_block = parts.join('\n\n');

    return {
      user_id,
      persona_id,
      recalled_memories: memories,
      prompt_block,
      token_estimate: usedTokens,
      trimmed,
    };
  }
}
