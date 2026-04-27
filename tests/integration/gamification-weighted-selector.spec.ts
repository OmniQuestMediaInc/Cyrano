// PHASE-G1 — Unit tests for the weighted prize selector. Pure RNG; no DI,
// no DB, no network. Verifies:
//   • effectiveWeight respects rarity × token-tier multipliers
//   • selectWeighted picks the only viable entry deterministically
//   • a high token tier biases toward LEGENDARY
//   • inactive entries never win

import {
  effectiveWeight,
  multiplierFor,
  RARITY_TIER_MULTIPLIERS,
  selectWeighted,
} from '../../services/gamification/src/internal/weighted-selector';
import type { PrizePoolEntry } from '../../services/gamification/src';

const E = (overrides: Partial<PrizePoolEntry>): PrizePoolEntry => ({
  entry_id: overrides.entry_id ?? `id-${Math.random()}`,
  pool_id: 'p1',
  prize_slot: 'SEG_A',
  name: 'x',
  description: 'x',
  rarity: 'COMMON',
  base_weight: 1,
  asset_url: undefined,
  created_at_utc: '2026-04-27T00:00:00.000Z',
  is_active: true,
  ...overrides,
});

describe('weighted-selector — multiplier matrix', () => {
  it('keeps COMMON weight at 1.0 across all three tier indices', () => {
    expect(multiplierFor(0, 'COMMON')).toBe(1);
    expect(multiplierFor(1, 'COMMON')).toBe(1);
    expect(multiplierFor(2, 'COMMON')).toBe(1);
  });

  it('LEGENDARY multiplier strictly increases with token tier', () => {
    const low = multiplierFor(0, 'LEGENDARY');
    const mid = multiplierFor(1, 'LEGENDARY');
    const high = multiplierFor(2, 'LEGENDARY');
    expect(low).toBeLessThan(mid);
    expect(mid).toBeLessThan(high);
  });

  it('matrix has the canonical shape (3 rows × 4 rarities)', () => {
    expect(RARITY_TIER_MULTIPLIERS).toHaveLength(3);
    for (const row of RARITY_TIER_MULTIPLIERS) {
      expect(row).toHaveLength(4);
    }
  });

  it('clamps tierIndex outside [0,2] without crashing', () => {
    expect(multiplierFor(-1, 'EPIC')).toBe(multiplierFor(0, 'EPIC'));
    expect(multiplierFor(99, 'EPIC')).toBe(multiplierFor(2, 'EPIC'));
  });
});

describe('weighted-selector — effectiveWeight', () => {
  it('returns zero for inactive entries', () => {
    expect(effectiveWeight(E({ is_active: false, base_weight: 100 }), 0)).toBe(0);
  });

  it('returns zero for non-positive base_weight', () => {
    expect(effectiveWeight(E({ base_weight: 0 }), 1)).toBe(0);
  });

  it('multiplies base_weight by the rarity-tier coefficient', () => {
    const e = E({ rarity: 'LEGENDARY', base_weight: 10 });
    const high = multiplierFor(2, 'LEGENDARY');
    expect(effectiveWeight(e, 2)).toBe(10 * high);
  });
});

describe('weighted-selector — selectWeighted', () => {
  it('picks the only positive-weight entry deterministically', () => {
    const entries = [
      E({ entry_id: 'a', rarity: 'COMMON', base_weight: 1, is_active: false }),
      E({ entry_id: 'b', rarity: 'EPIC', base_weight: 5 }),
    ];
    const result = selectWeighted(entries, 1, () => 0);
    expect(result.entry.entry_id).toBe('b');
  });

  it('biases LEGENDARY heavily on the high tier vs. low tier', () => {
    // Two entries: one COMMON weight 100, one LEGENDARY weight 100.
    // Legendary multiplier:  low=0.05  → 100 / (10000+500)  ≈ 4.76% wins
    //                        high=0.80 → 100*0.8 / (10000+8000) ≈ 44.4% wins
    // Use a fixed-call RNG that returns the midpoint of total_weight to
    // simulate a "fair" draw and verify which entry the cursor lands on.
    const entries = [
      E({ entry_id: 'common', rarity: 'COMMON', base_weight: 100 }),
      E({ entry_id: 'legendary', rarity: 'LEGENDARY', base_weight: 100 }),
    ];
    // A draw at 95% of total_weight always lands on LEGENDARY in high tier
    // (because LEGENDARY occupies the back ~44% of weight) but on COMMON
    // in low tier (LEGENDARY occupies only the back ~5% there).
    const draw95 = (max: number) => Math.floor(max * 0.95) - 1;
    const high = selectWeighted(entries, 2, draw95);
    const low = selectWeighted(entries, 0, draw95);
    expect(high.entry.entry_id).toBe('legendary');
    expect(low.entry.entry_id).toBe('common');
  });

  it('throws on an empty entry list', () => {
    expect(() => selectWeighted([], 0, () => 0)).toThrow(/WEIGHTED_SELECTOR_EMPTY/);
  });

  it('throws when every weight is zero', () => {
    const entries = [E({ is_active: false }), E({ base_weight: 0 })];
    expect(() => selectWeighted(entries, 0, () => 0)).toThrow(/WEIGHTED_SELECTOR_ZERO_TOTAL/);
  });
});
