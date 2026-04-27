// PHASE-G1 — PrizePoolService tests. Verifies validation rules + active
// resolution precedence (scoped > shared).

import {
  PrizePoolService,
  PrizePoolValidationError,
  type PrizePoolRepository,
} from '../../services/gamification/src/services/prize-pool.service';
import type { PrizePool } from '../../services/gamification/src';

class InMemoryPrizePoolRepo implements PrizePoolRepository {
  public pools: PrizePool[] = [];
  async insertPool(pool: PrizePool): Promise<void> {
    this.pools.push(pool);
  }
  async findPoolById(pool_id: string) {
    return this.pools.find((p) => p.pool_id === pool_id) ?? null;
  }
  async listActiveByCreator(creator_id: string) {
    return this.pools
      .filter((p) => p.creator_id === creator_id && p.is_active)
      .sort((a, b) => b.created_at_utc.localeCompare(a.created_at_utc));
  }
  async deactivatePool(creator_id: string, pool_id: string, version: string) {
    const i = this.pools.findIndex((p) => p.creator_id === creator_id && p.pool_id === pool_id);
    if (i >= 0) {
      this.pools[i] = { ...this.pools[i], is_active: false, version };
    }
  }
}

describe('PrizePoolService — validation', () => {
  let repo: InMemoryPrizePoolRepo;
  let svc: PrizePoolService;

  beforeEach(() => {
    repo = new InMemoryPrizePoolRepo();
    svc = new PrizePoolService(repo);
  });

  it('rejects pools with no entries', async () => {
    await expect(
      svc.upsert('creator-1', { name: 'P', scoped_game_type: null, entries: [] }),
    ).rejects.toBeInstanceOf(PrizePoolValidationError);
  });

  it('rejects duplicate prize_slot', async () => {
    await expect(
      svc.upsert('creator-1', {
        name: 'P',
        scoped_game_type: null,
        entries: [
          {
            prize_slot: 'A', name: 'a', description: 'a',
            rarity: 'COMMON', base_weight: 1,
          },
          {
            prize_slot: 'A', name: 'b', description: 'b',
            rarity: 'RARE', base_weight: 2,
          },
        ],
      }),
    ).rejects.toThrow(/duplicate prize_slot A/);
  });

  it('rejects non-positive base_weight', async () => {
    await expect(
      svc.upsert('creator-1', {
        name: 'P',
        scoped_game_type: null,
        entries: [
          {
            prize_slot: 'A', name: 'a', description: 'a',
            rarity: 'COMMON', base_weight: 0,
          },
        ],
      }),
    ).rejects.toThrow(/base_weight must be > 0/);
  });

  it('persists a valid pool', async () => {
    const pool = await svc.upsert('creator-1', {
      name: 'Headline pool',
      scoped_game_type: null,
      entries: [
        {
          prize_slot: 'A', name: 'A', description: 'a',
          rarity: 'COMMON', base_weight: 1,
        },
      ],
    });
    expect(pool.entries).toHaveLength(1);
    expect(pool.is_active).toBe(true);
    expect(repo.pools).toHaveLength(1);
  });
});

describe('PrizePoolService — resolveForPlay precedence', () => {
  let repo: InMemoryPrizePoolRepo;
  let svc: PrizePoolService;

  beforeEach(async () => {
    repo = new InMemoryPrizePoolRepo();
    svc = new PrizePoolService(repo);
    await svc.upsert('creator-1', {
      name: 'Shared', scoped_game_type: null,
      entries: [{ prize_slot: 'X', name: 'x', description: 'x', rarity: 'COMMON', base_weight: 1 }],
    });
  });

  it('returns the scoped pool when one matches the game_type', async () => {
    await svc.upsert('creator-1', {
      name: 'Dice-only', scoped_game_type: 'DICE',
      entries: [{ prize_slot: '7', name: 'lucky 7', description: 'jackpot',
        rarity: 'LEGENDARY', base_weight: 1 }],
    });
    const resolved = await svc.resolveForPlay('creator-1', 'DICE');
    expect(resolved?.scoped_game_type).toBe('DICE');
  });

  it('falls back to the shared pool when no scoped pool exists', async () => {
    const resolved = await svc.resolveForPlay('creator-1', 'SPIN_WHEEL');
    expect(resolved?.scoped_game_type).toBeNull();
  });

  it('returns null when the creator has no pools', async () => {
    const resolved = await svc.resolveForPlay('creator-other', 'DICE');
    expect(resolved).toBeNull();
  });
});
