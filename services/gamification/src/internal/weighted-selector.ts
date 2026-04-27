// services/gamification/src/internal/weighted-selector.ts
// Pure, deterministic-on-RNG weighted selector. The RNG is injected so unit
// tests can pin draws without touching `crypto`. In production the RNG is
// `crypto.randomInt`. **Math.random() is forbidden.**

import { randomInt } from 'crypto';
import {
  RARITY_RANK,
  type PrizePoolEntry,
  type WeightedSelectionResult,
} from '../types/gamification.types';

/**
 * RNG contract: returns an integer in `[0, max)`. Caller passes a positive
 * `max`. Implementations MUST be uniform (rejection-sampled) — the production
 * default delegates to `crypto.randomInt(0, max)`.
 */
export type IntRng = (max: number) => number;

export const cryptoIntRng: IntRng = (max) => randomInt(0, max);

/**
 * Bias the rarity dimension by token tier. Higher token tier within the
 * creator's configured tier ordinal `tierIndex` (0 = lowest, up to 2)
 * multiplies rare-tier weights monotonically.
 *
 * Multiplier table (canonical — do not change without governance review):
 *
 *   tierIndex | COMMON | RARE | EPIC | LEGENDARY
 *   ---------+--------+------+------+----------
 *   0 (low)  | 1.00   | 0.50 | 0.20 | 0.05
 *   1 (mid)  | 1.00   | 1.00 | 0.60 | 0.20
 *   2 (high) | 1.00   | 1.50 | 1.40 | 0.80
 *
 * Any prize remains reachable at any tier (no zero), matching the spec
 * requirement: "Any prize can technically be won at any price point".
 */
export const RARITY_TIER_MULTIPLIERS: ReadonlyArray<readonly [number, number, number, number]> = [
  [1.0, 0.5, 0.2, 0.05],
  [1.0, 1.0, 0.6, 0.2],
  [1.0, 1.5, 1.4, 0.8],
] as const;

/**
 * Resolve the multiplier row for a given creator-configured tier index.
 * Tier indices outside [0, 2] are clamped — defensively, any caller passing
 * 3+ tiers is a configuration bug, but the selector should not crash.
 */
export function multiplierFor(tierIndex: number, rarity: keyof typeof RARITY_RANK): number {
  const safeIndex = Math.max(0, Math.min(2, tierIndex));
  const row = RARITY_TIER_MULTIPLIERS[safeIndex];
  return row[RARITY_RANK[rarity]];
}

/**
 * Compute the effective weight = base_weight × tier_rarity_multiplier.
 * Inactive entries contribute zero.
 */
export function effectiveWeight(entry: PrizePoolEntry, tierIndex: number): number {
  if (!entry.is_active) return 0;
  if (entry.base_weight <= 0) return 0;
  return entry.base_weight * multiplierFor(tierIndex, entry.rarity);
}

/**
 * Weighted draw against a list of prize entries. Returns the selected entry
 * plus the raw draw value for audit.
 *
 * @throws if the entries list is empty or sums to a non-positive total.
 */
export function selectWeighted(
  entries: ReadonlyArray<PrizePoolEntry>,
  tierIndex: number,
  rng: IntRng = cryptoIntRng,
): WeightedSelectionResult {
  if (entries.length === 0) {
    throw new Error('WEIGHTED_SELECTOR_EMPTY: prize pool has no entries');
  }

  const weights: number[] = entries.map((e) => effectiveWeight(e, tierIndex));
  // Quantize to integers (×1000) for the integer-only RNG. Caller-supplied
  // base_weights are floats; we take three decimals of precision.
  const scaled = weights.map((w) => Math.max(0, Math.round(w * 1000)));
  const total = scaled.reduce((a, b) => a + b, 0);
  if (total <= 0) {
    throw new Error('WEIGHTED_SELECTOR_ZERO_TOTAL: all entries have zero effective weight');
  }

  const draw = rng(total);
  let cursor = 0;
  for (let i = 0; i < entries.length; i += 1) {
    cursor += scaled[i];
    if (draw < cursor) {
      return { entry: entries[i], draw, total_weight: total };
    }
  }
  // Unreachable in a correctly summed table; defensive return on the last entry.
  return { entry: entries[entries.length - 1], draw, total_weight: total };
}
