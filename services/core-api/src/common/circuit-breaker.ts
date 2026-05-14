// services/core-api/src/common/circuit-breaker.ts
// CYR: CircuitBreaker — closed → open → half-open state machine.
//
// One instance per provider (banana, elevenlabs, flux).
// Satisfies CYR-CORE-001-PROVIDER-RELIABILITY requirements §2.

import { Logger } from '@nestjs/common';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  /** Provider name for logging. */
  provider: string;
  /** Consecutive failures before tripping. Default: 5 */
  failureThreshold?: number;
  /** Milliseconds before attempting half-open probe. Default: 30_000 */
  resetTimeoutMs?: number;
}

/**
 * CircuitBreaker guards a provider call site.
 *
 * States:
 *  - CLOSED  — normal; calls pass through; failure counter increments on each failure.
 *  - OPEN    — tripped; calls are rejected immediately to protect downstream; resets after
 *              `resetTimeoutMs`.
 *  - HALF_OPEN — one probe call is allowed; success → CLOSED; failure → OPEN again.
 *
 * Usage:
 *   const breaker = new CircuitBreaker({ provider: 'banana' });
 *   const result = await breaker.execute(() => httpClient.request(...));
 */
export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private openedAt: number | null = null;

  private readonly logger: Logger;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly provider: string;

  constructor(options: CircuitBreakerOptions) {
    this.provider = options.provider;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30_000;
    this.logger = new Logger(`CircuitBreaker[${this.provider}]`);
  }

  /** Current circuit state — useful for health checks. */
  getState(): CircuitState {
    this.maybeTransitionToHalfOpen();
    return this.state;
  }

  /**
   * Execute a call through the circuit breaker.
   *
   * @throws Error with code `CIRCUIT_OPEN` when the circuit is tripped.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.maybeTransitionToHalfOpen();

    if (this.state === 'OPEN') {
      this.logger.warn(`${this.provider} circuit OPEN — request rejected`);
      const err = new Error(
        `${this.provider} circuit breaker is OPEN; service temporarily unavailable`,
      );
      (err as Error & { code: string }).code = 'CIRCUIT_OPEN';
      throw err;
    }

    if (this.state === 'HALF_OPEN') {
      this.logger.log(`${this.provider} circuit HALF_OPEN — probing`);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.logger.log(`${this.provider} circuit probe succeeded → CLOSED`);
    }
    this.state = 'CLOSED';
    this.consecutiveFailures = 0;
    this.openedAt = null;
  }

  private onFailure(): void {
    this.consecutiveFailures++;

    if (this.state === 'HALF_OPEN') {
      this.logger.warn(`${this.provider} probe failed → OPEN`);
      this.trip();
      return;
    }

    if (this.consecutiveFailures >= this.failureThreshold) {
      this.logger.error(`${this.provider} hit failure threshold (${this.failureThreshold}) → OPEN`);
      this.trip();
    }
  }

  private trip(): void {
    this.state = 'OPEN';
    this.openedAt = Date.now();
  }

  private maybeTransitionToHalfOpen(): void {
    if (
      this.state === 'OPEN' &&
      this.openedAt !== null &&
      Date.now() - this.openedAt >= this.resetTimeoutMs
    ) {
      this.logger.log(`${this.provider} reset timeout elapsed → HALF_OPEN`);
      this.state = 'HALF_OPEN';
    }
  }
}

/**
 * Module-scoped registry — one CircuitBreaker instance per provider.
 * Import and use `getCircuitBreaker('banana')` instead of constructing directly.
 */
const registry = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(
  provider: string,
  options?: Partial<CircuitBreakerOptions>,
): CircuitBreaker {
  if (!registry.has(provider)) {
    registry.set(provider, new CircuitBreaker({ provider, ...options }));
  }
  return registry.get(provider)!;
}
