// NATS: per-topic circuit breaker
// Phase 2.9 — when publish latency for a topic crosses the configured
// threshold (default 300 ms p95 over the last 60 s), the breaker trips
// `OPEN` and `shouldPublish()` returns false until a half-open probe
// succeeds. Callers route blocked publishes to a dead-letter queue or fail
// silently for best-effort subjects.
//
// The breaker stores no NATS connections directly — it is a pure counter
// + state machine. Publishers wrap their `nats.publish()` in
//   if (!breaker.shouldPublish(topic)) return;
//   const t0 = performance.now();
//   nats.publish(topic, payload);
//   breaker.recordLatency(topic, performance.now() - t0);

import { Injectable, Logger } from '@nestjs/common';

export type BreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface TopicBreakerState {
  state: BreakerState;
  /** Latency observations for the current window (ms). */
  observations: number[];
  /** Monotonic ms when the breaker tripped OPEN. */
  opened_at_ms?: number;
  /** Half-open probe count since reset. */
  probe_attempts: number;
}

export const BREAKER_LATENCY_THRESHOLD_MS = 300;
export const BREAKER_WINDOW_MS = 60_000;
export const BREAKER_OPEN_DURATION_MS = 5_000;
export const BREAKER_PROBE_INTERVAL_MS = 2_000;
export const BREAKER_MIN_OBSERVATIONS = 20;

@Injectable()
export class NatsCircuitBreaker {
  private readonly logger = new Logger(NatsCircuitBreaker.name);
  private readonly state = new Map<string, TopicBreakerState>();

  /**
   * Decide whether to publish to `topic`. False = breaker is open AND it is
   * not yet time for a half-open probe.
   */
  shouldPublish(topic: string, now_ms: number = Date.now()): boolean {
    const s = this.ensure(topic);
    if (s.state === 'CLOSED') return true;
    if (s.state === 'OPEN') {
      const openedFor = now_ms - (s.opened_at_ms ?? 0);
      if (openedFor >= BREAKER_OPEN_DURATION_MS) {
        s.state = 'HALF_OPEN';
        s.probe_attempts = 0;
        this.logger.log('NatsCircuitBreaker: OPEN → HALF_OPEN', { topic });
        return true;
      }
      return false;
    }
    // HALF_OPEN — allow one probe at a time, throttled.
    if (s.probe_attempts === 0) {
      s.probe_attempts = 1;
      return true;
    }
    return false;
  }

  /** Record an observed publish latency. Drives state transitions. */
  recordLatency(topic: string, latency_ms: number, now_ms: number = Date.now()): void {
    const s = this.ensure(topic);
    s.observations.push(latency_ms);
    if (s.observations.length > 200) s.observations.shift();

    if (s.state === 'HALF_OPEN') {
      if (latency_ms <= BREAKER_LATENCY_THRESHOLD_MS) {
        s.state = 'CLOSED';
        s.opened_at_ms = undefined;
        s.observations = [];
        s.probe_attempts = 0;
        this.logger.log('NatsCircuitBreaker: HALF_OPEN → CLOSED', { topic, latency_ms });
      } else {
        s.state = 'OPEN';
        s.opened_at_ms = now_ms;
        s.probe_attempts = 0;
        this.logger.warn('NatsCircuitBreaker: HALF_OPEN → OPEN (probe failed)', {
          topic,
          latency_ms,
        });
      }
      return;
    }

    if (s.observations.length >= BREAKER_MIN_OBSERVATIONS) {
      const p95 = this.percentile(s.observations, 0.95);
      if (p95 > BREAKER_LATENCY_THRESHOLD_MS && s.state === 'CLOSED') {
        s.state = 'OPEN';
        s.opened_at_ms = now_ms;
        this.logger.warn('NatsCircuitBreaker: CLOSED → OPEN', { topic, p95_ms: Math.round(p95) });
      }
    }
  }

  /** Diagnostic snapshot for the metrics endpoint. */
  snapshot(): Record<string, { state: BreakerState; p95_ms: number; observations: number }> {
    const out: Record<string, { state: BreakerState; p95_ms: number; observations: number }> = {};
    for (const [topic, s] of this.state) {
      out[topic] = {
        state: s.state,
        p95_ms: Math.round(this.percentile(s.observations, 0.95)),
        observations: s.observations.length,
      };
    }
    return out;
  }

  /** Reset every breaker. Test seam. */
  reset(): void {
    this.state.clear();
  }

  private ensure(topic: string): TopicBreakerState {
    let s = this.state.get(topic);
    if (!s) {
      s = { state: 'CLOSED', observations: [], probe_attempts: 0 };
      this.state.set(topic, s);
    }
    return s;
  }

  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
    return sorted[idx];
  }
}
