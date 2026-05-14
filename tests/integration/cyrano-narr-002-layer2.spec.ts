/**
 * cyrano-narr-002-layer2.spec.ts
 * CYR-NARR-002 — Unit tests for Layer 2 memory + branching services.
 *
 * Covers:
 *  - MemoryBankService.recordMemory() persists and returns record
 *  - MemoryBankService.recallMemories() scores and sorts by importance × time-decay
 *  - MemoryBankService.incrementAccess() updates mutable columns only
 *  - ContextBuilderService.buildContext() assembles prompt block; trims memory on budget exceed
 *  - BranchingService.createStoryBeat() writes beat + emits NATS
 *  - BranchingService.createBranchDecision() writes decision + emits NATS
 *  - BranchingService.createBranchDecision() rejects unknown beat_id
 */

import { MemoryBankService } from '../../services/narrative-engine/src/memory-bank.service';
import { ContextBuilderService } from '../../services/narrative-engine/src/context-builder.service';
import { BranchingService } from '../../services/narrative-engine/src/branching.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeMemoryEntry(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'mem-001',
    user_id: 'user-001',
    persona_id: 'persona-001',
    content: 'User loves stargazing',
    embedding: null,
    importance_score: 0.7,
    created_at: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
    last_accessed_at: null,
    access_count: 0,
    correlation_id: 'corr-001',
    reason_code: 'MEMORY_RECORD',
    rule_applied_id: 'CYR-NARR-002',
    ...overrides,
  };
}

function makeStoryBeat(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'beat-001',
    user_id: 'user-001',
    persona_id: 'persona-001',
    beat_type: 'OPEN',
    summary: 'The story begins',
    memory_entry_id: null,
    created_at: new Date(),
    correlation_id: 'corr-beat-001',
    reason_code: 'STORY_BEAT',
    rule_applied_id: 'CYR-NARR-002',
    ...overrides,
  };
}

// ─── MemoryBankService ────────────────────────────────────────────────────────

describe('MemoryBankService', () => {
  let service: MemoryBankService;
  let mockPrisma: {
    memoryEntry: {
      create: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(() => {
    mockPrisma = {
      memoryEntry: {
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new MemoryBankService(mockPrisma as never);
  });

  describe('recordMemory()', () => {
    it('creates and returns the memory entry', async () => {
      const entry = makeMemoryEntry();
      mockPrisma.memoryEntry.create.mockResolvedValue(entry);

      const result = await service.recordMemory({
        user_id: 'user-001',
        persona_id: 'persona-001',
        content: 'User loves stargazing',
        correlation_id: 'corr-001',
      });

      expect(result.id).toBe('mem-001');
      expect(result.content).toBe('User loves stargazing');
      expect(result.importance_score).toBeGreaterThan(0);
      expect(mockPrisma.memoryEntry.create).toHaveBeenCalledTimes(1);
    });

    it('uses heuristic importance when not provided', async () => {
      const entry = makeMemoryEntry({ importance_score: 0.5 });
      mockPrisma.memoryEntry.create.mockResolvedValue(entry);

      await service.recordMemory({
        user_id: 'user-001',
        persona_id: 'persona-001',
        content: 'I love and fear the storm',
        correlation_id: 'corr-002',
      });

      // importance_score passed to create should be a float in [0,1]
      const data = mockPrisma.memoryEntry.create.mock.calls[0][0].data;
      expect(data.importance_score).toBeGreaterThanOrEqual(0);
      expect(data.importance_score).toBeLessThanOrEqual(1);
    });

    it('uses provided importance_score when given', async () => {
      const entry = makeMemoryEntry({ importance_score: 0.9 });
      mockPrisma.memoryEntry.create.mockResolvedValue(entry);

      await service.recordMemory({
        user_id: 'user-001',
        persona_id: 'persona-001',
        content: 'Pinned memory',
        importance_score: 0.9,
        correlation_id: 'corr-003',
      });

      const data = mockPrisma.memoryEntry.create.mock.calls[0][0].data;
      expect(data.importance_score).toBe(0.9);
    });
  });

  describe('recallMemories()', () => {
    it('returns top-K results sorted by relevance (importance × decay)', async () => {
      const now = Date.now();
      const recentEntry = makeMemoryEntry({
        id: 'mem-recent',
        importance_score: 0.8,
        created_at: new Date(now - 1000), // 1 second ago
      });
      const oldEntry = makeMemoryEntry({
        id: 'mem-old',
        importance_score: 0.9, // higher importance but much older
        created_at: new Date(now - 180 * 24 * 60 * 60 * 1000), // 180 days ago
      });

      mockPrisma.memoryEntry.findMany.mockResolvedValue([oldEntry, recentEntry]);

      const results = await service.recallMemories('user-001', 'persona-001', { topK: 5 });

      // Recent entry with decay should score higher despite lower base importance
      expect(results[0].id).toBe('mem-recent');
      expect(results[1].id).toBe('mem-old');
    });

    it('returns at most topK results', async () => {
      const entries = Array.from({ length: 10 }, (_, i) =>
        makeMemoryEntry({ id: `mem-${i}`, importance_score: Math.random() }),
      );
      mockPrisma.memoryEntry.findMany.mockResolvedValue(entries);

      const results = await service.recallMemories('user-001', 'persona-001', { topK: 3 });
      expect(results.length).toBe(3);
    });
  });

  describe('incrementAccess()', () => {
    it('calls update with increment on access_count and new last_accessed_at', async () => {
      mockPrisma.memoryEntry.update.mockResolvedValue({});

      await service.incrementAccess('mem-001');

      expect(mockPrisma.memoryEntry.update).toHaveBeenCalledWith({
        where: { id: 'mem-001' },
        data: {
          access_count: { increment: 1 },
          last_accessed_at: expect.any(Date),
        },
      });
    });
  });
});

// ─── ContextBuilderService ────────────────────────────────────────────────────

describe('ContextBuilderService', () => {
  let service: ContextBuilderService;
  let mockPrisma: { storyBeat: { findFirst: jest.Mock } };
  let mockMemoryBank: { recallMemories: jest.Mock };

  beforeEach(() => {
    mockPrisma = {
      storyBeat: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    mockMemoryBank = {
      recallMemories: jest.fn().mockResolvedValue([]),
    };
    service = new ContextBuilderService(mockPrisma as never, mockMemoryBank as never);
  });

  it('returns a non-empty prompt_block with safety rails', async () => {
    const result = await service.buildContext({
      user_id: 'user-001',
      persona_id: 'persona-001',
      turn_text: 'Hello',
    });

    expect(result.prompt_block).toContain('[SAFETY RAILS]');
    expect(result.token_estimate).toBeGreaterThan(0);
  });

  it('includes memories in the prompt block when recalled', async () => {
    mockMemoryBank.recallMemories.mockResolvedValue([
      makeMemoryEntry({ content: 'User loves stargazing' }),
    ]);

    const result = await service.buildContext({
      user_id: 'user-001',
      persona_id: 'persona-001',
      turn_text: 'What do I enjoy?',
    });

    expect(result.prompt_block).toContain('[MEMORY BANK]');
    expect(result.prompt_block).toContain('stargazing');
    expect(result.recalled_memories).toHaveLength(1);
    expect(result.trimmed).toBe(false);
  });

  it('strips email PII from memory content', async () => {
    mockMemoryBank.recallMemories.mockResolvedValue([
      makeMemoryEntry({ content: 'User email is test@example.com — keep private' }),
    ]);

    const result = await service.buildContext({
      user_id: 'user-001',
      persona_id: 'persona-001',
      turn_text: 'What is my email?',
    });

    expect(result.prompt_block).not.toContain('test@example.com');
    expect(result.prompt_block).toContain('[REDACTED]');
  });

  it('sets trimmed=true when token budget exceeded and memory is cut', async () => {
    // Create many long memories to exceed budget
    const bigMemories = Array.from({ length: 5 }, (_, i) =>
      makeMemoryEntry({
        id: `mem-${i}`,
        content: 'A'.repeat(10000), // ~2500 tokens each
      }),
    );
    mockMemoryBank.recallMemories.mockResolvedValue(bigMemories);

    const result = await service.buildContext({
      user_id: 'user-001',
      persona_id: 'persona-001',
      turn_text: 'hi',
    });

    expect(result.trimmed).toBe(true);
  });
});

// ─── BranchingService ────────────────────────────────────────────────────────

describe('BranchingService', () => {
  let service: BranchingService;
  let mockPrisma: {
    storyBeat: { create: jest.Mock; findMany: jest.Mock; findUniqueOrThrow: jest.Mock };
    branchDecision: { create: jest.Mock; findMany: jest.Mock };
  };
  let mockNats: { publish: jest.Mock };

  beforeEach(() => {
    mockPrisma = {
      storyBeat: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findUniqueOrThrow: jest.fn(),
      },
      branchDecision: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    mockNats = { publish: jest.fn().mockResolvedValue(undefined) };
    service = new BranchingService(mockPrisma as never, mockNats as never);
  });

  describe('createStoryBeat()', () => {
    it('creates a beat and emits NATS event', async () => {
      const beat = makeStoryBeat();
      mockPrisma.storyBeat.create.mockResolvedValue(beat);

      const result = await service.createStoryBeat({
        user_id: 'user-001',
        persona_id: 'persona-001',
        beat_type: 'OPEN',
        summary: 'The story begins',
        correlation_id: 'corr-001',
      });

      expect(result.id).toBe('beat-001');
      expect(result.beat_type).toBe('OPEN');
      expect(mockNats.publish).toHaveBeenCalledWith(
        'cyrano.narrative.l2.story-beat',
        expect.objectContaining({ beat_id: 'beat-001', beat_type: 'OPEN' }),
      );
    });
  });

  describe('createBranchDecision()', () => {
    it('creates a decision + emits NATS event', async () => {
      const beat = makeStoryBeat();
      mockPrisma.storyBeat.findUniqueOrThrow.mockResolvedValue(beat);

      const decision = {
        id: 'dec-001',
        user_id: 'user-001',
        persona_id: 'persona-001',
        beat_id: 'beat-001',
        decision_text: 'I choose to trust them',
        consequences: { relationship: 'trust increases', plot: 'door opens' },
        created_at: new Date(),
        correlation_id: 'corr-dec-001',
        reason_code: 'BRANCH_DECISION',
        rule_applied_id: 'CYR-NARR-002',
      };
      mockPrisma.branchDecision.create.mockResolvedValue(decision);

      const result = await service.createBranchDecision({
        user_id: 'user-001',
        persona_id: 'persona-001',
        beat_id: 'beat-001',
        decision_text: 'I choose to trust them',
        consequences: { relationship: 'trust increases', plot: 'door opens' },
        correlation_id: 'corr-dec-001',
      });

      expect(result.id).toBe('dec-001');
      expect(result.consequences.relationship).toBe('trust increases');
      expect(mockNats.publish).toHaveBeenCalledWith(
        'cyrano.narrative.l2.branch-decision',
        expect.objectContaining({ decision_id: 'dec-001', beat_id: 'beat-001' }),
      );
    });

    it('throws when beat_id does not exist', async () => {
      mockPrisma.storyBeat.findUniqueOrThrow.mockRejectedValue(new Error('Record not found'));

      await expect(
        service.createBranchDecision({
          user_id: 'user-001',
          persona_id: 'persona-001',
          beat_id: 'nonexistent-beat',
          decision_text: 'Choose wisely',
          consequences: {},
          correlation_id: 'corr-001',
        }),
      ).rejects.toThrow('Record not found');
    });
  });
});
