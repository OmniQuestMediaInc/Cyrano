/**
 * nats-sharding.spec.ts
 * Phase 2.9 — djb2 + sharded subject helpers.
 */
import {
  djb2,
  NATS_DEFAULT_SHARD_COUNT,
  shardedSubject,
  shardSubscriptionPattern,
} from '../../services/nats/optim/sharding.util';

describe('djb2 hash', () => {
  it('is deterministic for the same input', () => {
    expect(djb2('session-abc')).toBe(djb2('session-abc'));
  });

  it('is non-zero for non-empty input', () => {
    expect(djb2('x')).not.toBe(0);
  });
});

describe('shardedSubject', () => {
  it('routes the same key to the same shard', () => {
    const a = shardedSubject('ffs.score.update', 'sess-1');
    const b = shardedSubject('ffs.score.update', 'sess-1');
    expect(a).toBe(b);
  });

  it('produces a shard index within [0, shardCount)', () => {
    for (let i = 0; i < 100; i++) {
      const subject = shardedSubject('ffs.score.update', `sess-${i}`);
      const shard = Number(subject.split('.').pop());
      expect(shard).toBeGreaterThanOrEqual(0);
      expect(shard).toBeLessThan(NATS_DEFAULT_SHARD_COUNT);
    }
  });

  it('shardSubscriptionPattern matches every shard with a single wildcard token', () => {
    expect(shardSubscriptionPattern('ffs.score.update')).toBe('ffs.score.update.*');
  });
});
