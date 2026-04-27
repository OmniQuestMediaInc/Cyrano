// NATS: subject-sharding helper
// Phase 2.9 — high-volume topics (FFS_SCORE_UPDATE, SENSYNC_BPM_UPDATE) are
// fanned across N shards using a stable djb2 hash of the session_id. Each
// shard subscriber consumes a dedicated subject suffix so no consumer is
// dragged down by another's slow handler.

/**
 * Stable, fast, dependency-free hash. Djb2 (Bernstein) is a coordinate
 * function with good distribution for short ASCII keys (which session_ids
 * always are: UUIDv4 / ULID).
 */
export function djb2(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

export const NATS_DEFAULT_SHARD_COUNT = 16;

/**
 * Derive the shard subject for a base topic and a sharding key.
 * Example:
 *   shardedSubject('ffs.score.update', 'sess_123', 16) → 'ffs.score.update.7'
 */
export function shardedSubject(baseTopic: string, key: string, shardCount = NATS_DEFAULT_SHARD_COUNT): string {
  const safeShardCount = Math.max(1, shardCount | 0);
  const shard = djb2(key) % safeShardCount;
  return `${baseTopic}.${shard}`;
}

/** Wildcard subject pattern that matches every shard (`*`-style NATS token). */
export function shardSubscriptionPattern(baseTopic: string): string {
  return `${baseTopic}.*`;
}
