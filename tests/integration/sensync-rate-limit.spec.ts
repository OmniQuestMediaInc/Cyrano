/**
 * sensync-rate-limit.spec.ts
 * Phase 2.8 — sliding-window rate limiter + delta-anomaly gate.
 *
 * Hermetic — no broker or database. Exercises only the in-process limiter.
 */
import {
  SENSYNC_MAX_BPM_DELTA,
  SENSYNC_MAX_SAMPLES_PER_SECOND,
  SenSyncRateLimitService,
} from '../../services/sensync/src/sensync-rate-limit.service';

describe('SenSyncRateLimitService — sliding window', () => {
  it('admits the first N samples within the window', () => {
    const limiter = new SenSyncRateLimitService();
    const now = 1_000_000;
    for (let i = 0; i < SENSYNC_MAX_SAMPLES_PER_SECOND; i++) {
      const decision = limiter.admit('s1', 80 + i, now + i);
      expect(decision.allowed).toBe(true);
    }
  });

  it('rejects the (N+1)-th sample within the same second', () => {
    const limiter = new SenSyncRateLimitService();
    const now = 1_000_000;
    for (let i = 0; i < SENSYNC_MAX_SAMPLES_PER_SECOND; i++) {
      limiter.admit('s1', 80, now + i);
    }
    const decision = limiter.admit('s1', 80, now + SENSYNC_MAX_SAMPLES_PER_SECOND);
    expect(decision.allowed).toBe(false);
    expect(decision.reason_code).toBe('RATE_LIMITED_PER_SECOND');
  });

  it('admits samples again after the window slides forward', () => {
    const limiter = new SenSyncRateLimitService();
    const now = 1_000_000;
    for (let i = 0; i < SENSYNC_MAX_SAMPLES_PER_SECOND; i++) {
      limiter.admit('s1', 80, now + i);
    }
    const later = limiter.admit('s1', 80, now + 2_000);
    expect(later.allowed).toBe(true);
  });
});

describe('SenSyncRateLimitService — anomaly delta', () => {
  it('rejects a single tick that jumps more than the cap', () => {
    const limiter = new SenSyncRateLimitService();
    expect(limiter.admit('s1', 70).allowed).toBe(true);
    const decision = limiter.admit('s1', 70 + SENSYNC_MAX_BPM_DELTA + 1);
    expect(decision.allowed).toBe(false);
    expect(decision.reason_code).toBe('ANOMALY_BPM_DELTA_EXCEEDED');
  });

  it('forget() drops state so a new session restarts cleanly', () => {
    const limiter = new SenSyncRateLimitService();
    expect(limiter.admit('s1', 70).allowed).toBe(true);
    limiter.forget('s1');
    expect(limiter.admit('s1', 70 + SENSYNC_MAX_BPM_DELTA + 1).allowed).toBe(true);
  });
});
