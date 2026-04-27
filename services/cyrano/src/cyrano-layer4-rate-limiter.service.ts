// PAYLOAD 5+ — Cyrano Layer 4 rate limiter
// Phase 0 placeholder (Layer 4 v1) — fixed-window per-tenant token-bucket
// equivalent. The bucket resets every 60 seconds; capacity is the
// tenant's contractual rate_limit_per_minute. Phase 2 swaps this for a
// Redis-backed distributed leaky bucket; the consume() surface stays
// identical so callers do not change.

import { Injectable, Logger } from '@nestjs/common';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { NATS_TOPICS } from '../../nats/topics.registry';
import { CYRANO_LAYER4_RULE_ID } from './cyrano-layer4.types';

interface TenantBucket {
  /** Window start (epoch ms). */
  window_started_at_ms: number;
  /** Tokens consumed within the current window. */
  consumed: number;
}

const WINDOW_MS = 60_000;
/** Per-API-key sliding burst window (1 second). Defends against single-key abuse. */
const BURST_WINDOW_MS = 1_000;
/**
 * Default per-key burst ceiling — ~10 requests/sec/key. Tenants that need
 * higher bursts contractually configure this via the limit_per_minute
 * input (which scales the burst proportionally).
 */
const DEFAULT_BURST_CEILING = 10;

export interface ConsumeRateLimitInput {
  tenant_id: string;
  limit_per_minute: number;
  /**
   * Optional API key id — when present the burst window is also enforced
   * per-key. Tenants with multiple keys can therefore parallelise without
   * starving each other on the per-tenant minute window.
   */
  api_key_id?: string | null;
}

export interface ConsumeRateLimitResult {
  allowed: boolean;
  remaining: number;
  retry_after_ms: number;
  /** Layer of the rate limit that fired (only when allowed = false). */
  scope?: 'tenant' | 'key_burst';
  rule_applied_id: string;
}

@Injectable()
export class CyranoLayer4RateLimiterService {
  private readonly logger = new Logger(CyranoLayer4RateLimiterService.name);
  private readonly tenantBuckets = new Map<string, TenantBucket>();
  /** key_id → 1-second burst bucket. */
  private readonly keyBurstBuckets = new Map<string, TenantBucket>();

  constructor(
    private readonly nats: NatsService,
    private readonly clock: () => number = () => Date.now(),
  ) {}

  consume(input: ConsumeRateLimitInput): ConsumeRateLimitResult {
    const now = this.clock();

    // Per-API-key burst check (1-second window) — enforced first so abuse
    // by a single rogue key cannot exhaust the tenant's minute budget.
    if (input.api_key_id) {
      const burstCeiling = this.computeBurstCeiling(input.limit_per_minute);
      let burst = this.keyBurstBuckets.get(input.api_key_id);
      if (!burst || now - burst.window_started_at_ms >= BURST_WINDOW_MS) {
        burst = { window_started_at_ms: now, consumed: 0 };
        this.keyBurstBuckets.set(input.api_key_id, burst);
      }
      if (burst.consumed >= burstCeiling) {
        const retry_after_ms = BURST_WINDOW_MS - (now - burst.window_started_at_ms);
        this.emitDeny({
          tenant_id: input.tenant_id,
          api_key_id: input.api_key_id,
          consumed: burst.consumed,
          ceiling: burstCeiling,
          scope: 'key_burst',
          retry_after_ms,
          now,
        });
        return {
          allowed: false,
          remaining: 0,
          retry_after_ms,
          scope: 'key_burst',
          rule_applied_id: CYRANO_LAYER4_RULE_ID,
        };
      }
      burst.consumed += 1;
    }

    // Per-tenant minute window check.
    let tenantBucket = this.tenantBuckets.get(input.tenant_id);
    if (!tenantBucket || now - tenantBucket.window_started_at_ms >= WINDOW_MS) {
      tenantBucket = { window_started_at_ms: now, consumed: 0 };
      this.tenantBuckets.set(input.tenant_id, tenantBucket);
    }

    if (tenantBucket.consumed >= input.limit_per_minute) {
      const retry_after_ms = WINDOW_MS - (now - tenantBucket.window_started_at_ms);
      this.emitDeny({
        tenant_id: input.tenant_id,
        api_key_id: input.api_key_id ?? null,
        consumed: tenantBucket.consumed,
        ceiling: input.limit_per_minute,
        scope: 'tenant',
        retry_after_ms,
        now,
      });
      return {
        allowed: false,
        remaining: 0,
        retry_after_ms,
        scope: 'tenant',
        rule_applied_id: CYRANO_LAYER4_RULE_ID,
      };
    }

    tenantBucket.consumed += 1;
    return {
      allowed: true,
      remaining: Math.max(0, input.limit_per_minute - tenantBucket.consumed),
      retry_after_ms: 0,
      rule_applied_id: CYRANO_LAYER4_RULE_ID,
    };
  }

  /**
   * Burst ceiling scales with the tenant's per-minute limit but never
   * drops below the default minimum.  Formula keeps a steady rate of
   * (limit_per_minute / 60) but always allows the default short-burst
   * grace so well-behaved callers with low minute budgets aren't starved.
   */
  private computeBurstCeiling(limit_per_minute: number): number {
    return Math.max(DEFAULT_BURST_CEILING, Math.ceil(limit_per_minute / 60));
  }

  private emitDeny(args: {
    tenant_id: string;
    api_key_id: string | null;
    consumed: number;
    ceiling: number;
    scope: 'tenant' | 'key_burst';
    retry_after_ms: number;
    now: number;
  }): void {
    this.logger.warn('CyranoLayer4RateLimiterService: rate limit exceeded', {
      ...args,
      rule_applied_id: CYRANO_LAYER4_RULE_ID,
    });
    this.nats.publish(NATS_TOPICS.CYRANO_LAYER4_RATE_LIMITED, {
      tenant_id: args.tenant_id,
      api_key_id: args.api_key_id,
      scope: args.scope,
      consumed: args.consumed,
      ceiling: args.ceiling,
      retry_after_ms: args.retry_after_ms,
      rule_applied_id: CYRANO_LAYER4_RULE_ID,
      emitted_at_utc: new Date(args.now).toISOString(),
    });
  }

  /** Test seam — clear all buckets. */
  reset(): void {
    this.tenantBuckets.clear();
    this.keyBurstBuckets.clear();
  }
}
