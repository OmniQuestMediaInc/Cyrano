// services/core-api/src/common/http-client.ts
// CYR: Shared HttpClient — retry, timeout, structured logging, AbortSignal support.
//
// Used by all services that call paid external providers (Banana.dev, ElevenLabs, Flux).
// Satisfies CYR-CORE-001-PROVIDER-RELIABILITY requirements §1.

import { Logger } from '@nestjs/common';

export interface HttpClientOptions {
  /** Request timeout in milliseconds. Default: 30_000 */
  timeoutMs?: number;
  /** Max retry attempts on 5xx / network errors. Default: 3 */
  maxRetries?: number;
  /** Base delay before first retry in milliseconds. Default: 1_000 */
  baseDelayMs?: number;
  /** Name used in structured logs (e.g. 'banana', 'elevenlabs', 'flux'). */
  provider: string;
}

export interface HttpResponse<T = unknown> {
  data: T;
  status: number;
  latencyMs: number;
}

/**
 * Jitter helper — adds up to ±25% random spread to a base delay.
 * Prevents thundering herd on simultaneous retries.
 */
function withJitter(baseMs: number): number {
  const jitterFraction = 0.25;
  const spread = baseMs * jitterFraction;
  return baseMs + (Math.random() * spread * 2 - spread);
}

/**
 * Shared HTTP client with:
 *  - configurable timeout (defaults 30 s)
 *  - exponential backoff retry on 5xx + network errors (3 retries: 1 s → 2 s → 4 s ± jitter)
 *  - per-call structured logging with correlation_id, latency_ms, provider, status_code
 *  - AbortSignal passthrough for cancellation
 */
export class HttpClient {
  private readonly logger: Logger;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private readonly provider: string;

  constructor(options: HttpClientOptions) {
    this.provider = options.provider;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.maxRetries = options.maxRetries ?? 3;
    this.baseDelayMs = options.baseDelayMs ?? 1_000;
    this.logger = new Logger(`HttpClient[${this.provider}]`);
  }

  /**
   * Perform an HTTP request with retry + timeout logic.
   *
   * @param url         Target URL
   * @param init        Fetch RequestInit (method, headers, body, signal, …)
   * @param correlationId  Caller-supplied correlation ID injected into logs
   */
  async request<T = unknown>(
    url: string,
    init: RequestInit = {},
    correlationId = 'unknown',
  ): Promise<HttpResponse<T>> {
    let attempt = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      attempt++;
      const startMs = Date.now();

      // Build a combined AbortController: per-request timeout + optional caller signal
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), this.timeoutMs);

      let combinedSignal: AbortSignal = timeoutController.signal;
      if (init.signal instanceof AbortSignal) {
        // Combine caller signal with timeout signal
        const callerSignal = init.signal;
        if (callerSignal.aborted) {
          clearTimeout(timeoutId);
          throw new Error(`${this.provider}: request cancelled before start`);
        }
        const combined = new AbortController();
        const abortCombined = () => combined.abort();
        callerSignal.addEventListener('abort', abortCombined, { once: true });
        timeoutController.signal.addEventListener('abort', abortCombined, { once: true });
        combinedSignal = combined.signal;
      }

      try {
        const response = await fetch(url, { ...init, signal: combinedSignal });
        const latencyMs = Date.now() - startMs;

        this.logger.log(
          JSON.stringify({
            provider: this.provider,
            url,
            method: init.method ?? 'GET',
            status_code: response.status,
            latency_ms: latencyMs,
            attempt,
            correlation_id: correlationId,
          }),
        );

        if (response.ok) {
          const data = (await response.json()) as T;
          return { data, status: response.status, latencyMs };
        }

        // 4xx errors — do NOT retry (caller error, not provider error)
        if (response.status >= 400 && response.status < 500) {
          const text = await response.text();
          throw new Error(`${this.provider} HTTP ${response.status}: ${text}`);
        }

        // 5xx errors — retry eligible
        if (attempt > this.maxRetries) {
          const text = await response.text();
          throw new Error(
            `${this.provider} HTTP ${response.status} after ${attempt} attempts: ${text}`,
          );
        }

        const delay = withJitter(this.baseDelayMs * Math.pow(2, attempt - 1));
        this.logger.warn(
          `${this.provider} HTTP ${response.status} on attempt ${attempt}; retrying in ${Math.round(delay)}ms (correlation_id=${correlationId})`,
        );
        await sleep(delay);
      } catch (err) {
        clearTimeout(timeoutId);
        const latencyMs = Date.now() - startMs;

        const isTimeout =
          err instanceof Error && (err.name === 'AbortError' || err.message.includes('abort'));

        const isNetworkError =
          err instanceof TypeError && err.message.toLowerCase().includes('fetch');

        const isRetryable = isTimeout || isNetworkError;

        this.logger.error(
          JSON.stringify({
            provider: this.provider,
            url,
            error: err instanceof Error ? err.message : String(err),
            latency_ms: latencyMs,
            attempt,
            retryable: isRetryable,
            correlation_id: correlationId,
          }),
        );

        if (!isRetryable || attempt > this.maxRetries) {
          throw err;
        }

        const delay = withJitter(this.baseDelayMs * Math.pow(2, attempt - 1));
        this.logger.warn(
          `${this.provider} network error on attempt ${attempt}; retrying in ${Math.round(delay)}ms`,
        );
        await sleep(delay);
        continue;
      } finally {
        clearTimeout(timeoutId);
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
