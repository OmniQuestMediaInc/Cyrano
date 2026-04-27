// FIZ: PAYLOAD-012 — Creator Points Bundles (deduct from payout)
// Canonical bundle catalog. Pricing is fixed at the source — controllers and
// services MUST resolve a bundle by id, never accept a free-form priceUsd.

export interface PointsBundle {
  id: string;
  name: string;
  points: number;
  priceUsd: number;
  discountPercent: number;
}

export const POINTS_BUNDLES: readonly PointsBundle[] = [
  { id: 'starter', name: 'Starter', points: 1000, priceUsd: 12, discountPercent: 0 },
  { id: 'popular', name: 'Popular', points: 5000, priceUsd: 55, discountPercent: 8 },
  { id: 'value', name: 'Value', points: 10000, priceUsd: 95, discountPercent: 20 },
  { id: 'elite', name: 'Elite', points: 25000, priceUsd: 200, discountPercent: 33 },
] as const;

export function findBundle(bundleId: string): PointsBundle | undefined {
  return POINTS_BUNDLES.find((b) => b.id === bundleId);
}
