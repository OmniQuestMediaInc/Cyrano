/**
 * nats-circuit-breaker.spec.ts
 * Phase 2.9 — per-topic circuit breaker state machine.
 */
import {
  BREAKER_LATENCY_THRESHOLD_MS,
  BREAKER_MIN_OBSERVATIONS,
  BREAKER_OPEN_DURATION_MS,
  NatsCircuitBreaker,
} from '../../services/nats/optim/circuit-breaker.service';

describe('NatsCircuitBreaker', () => {
  it('starts CLOSED and admits publishes', () => {
    const b = new NatsCircuitBreaker();
    expect(b.shouldPublish('topic.x')).toBe(true);
  });

  it('trips OPEN when sustained latency exceeds the threshold', () => {
    const b = new NatsCircuitBreaker();
    const now = 1_000;
    for (let i = 0; i < BREAKER_MIN_OBSERVATIONS; i++) {
      b.recordLatency('topic.x', BREAKER_LATENCY_THRESHOLD_MS + 50, now + i);
    }
    expect(b.shouldPublish('topic.x', now + BREAKER_MIN_OBSERVATIONS + 1)).toBe(false);
    expect(b.snapshot()['topic.x'].state).toBe('OPEN');
  });

  it('moves to HALF_OPEN after the open-duration window elapses', () => {
    const b = new NatsCircuitBreaker();
    // Trip the breaker — opened_at_ms is the timestamp of the *last* sample.
    let lastTs = 0;
    for (let i = 0; i < BREAKER_MIN_OBSERVATIONS; i++) {
      lastTs = 1_000 + i;
      b.recordLatency('topic.x', BREAKER_LATENCY_THRESHOLD_MS + 50, lastTs);
    }
    // Right after tripping — still OPEN.
    expect(b.shouldPublish('topic.x', lastTs + 1)).toBe(false);
    // After the open-duration — first probe is admitted (HALF_OPEN).
    expect(b.shouldPublish('topic.x', lastTs + BREAKER_OPEN_DURATION_MS + 1)).toBe(true);
    expect(b.snapshot()['topic.x'].state).toBe('HALF_OPEN');
  });

  it('returns to CLOSED after a healthy probe', () => {
    const b = new NatsCircuitBreaker();
    let lastTs = 0;
    for (let i = 0; i < BREAKER_MIN_OBSERVATIONS; i++) {
      lastTs = 1_000 + i;
      b.recordLatency('topic.x', BREAKER_LATENCY_THRESHOLD_MS + 50, lastTs);
    }
    b.shouldPublish('topic.x', lastTs + BREAKER_OPEN_DURATION_MS + 1); // → HALF_OPEN probe
    b.recordLatency('topic.x', 50, lastTs + BREAKER_OPEN_DURATION_MS + 2); // healthy probe
    expect(b.snapshot()['topic.x'].state).toBe('CLOSED');
  });
});
