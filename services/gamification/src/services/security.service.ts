// services/gamification/src/services/security.service.ts
// Anti-bot guards: mouse-shake proof verification + per-IP/session rate limit
// + CAPTCHA escalation. The actual CAPTCHA solver is delegated to an injected
// verifier so production wiring (hCaptcha / Turnstile) stays out of this file.

import { Injectable, Logger } from '@nestjs/common';

/** Suggested floor — pure UX guideline; rejection thresholds live below. */
export const SHAKE_PROOF_THRESHOLDS = {
  min_duration_ms: 400,
  min_samples: 6,
  min_avg_amplitude_px: 12,
} as const;

export const RATE_LIMIT = {
  /** Max plays per ip+session within the rolling window before CAPTCHA is required. */
  plays_before_captcha: 8,
  window_seconds: 60,
} as const;

export interface ShakeProof {
  duration_ms: number;
  samples: number;
  avg_amplitude_px: number;
}

export interface CaptchaVerifier {
  verify(token: string): Promise<boolean>;
}

export interface RateLimitWindow {
  user_id: string;
  ip: string;
  count: number;
  window_started_at_ms: number;
}

export interface RateLimitStore {
  read(user_id: string, ip: string): Promise<RateLimitWindow | null>;
  upsert(window: RateLimitWindow): Promise<void>;
  reset(user_id: string, ip: string): Promise<void>;
}

export class SecurityViolationError extends Error {
  public readonly code:
    | 'SHAKE_PROOF_MISSING'
    | 'SHAKE_PROOF_INVALID'
    | 'RATE_LIMIT_EXCEEDED'
    | 'CAPTCHA_REQUIRED'
    | 'CAPTCHA_FAILED';
  constructor(code: SecurityViolationError['code'], detail: string) {
    super(`SECURITY_VIOLATION: ${code} — ${detail}`);
    this.name = 'SecurityViolationError';
    this.code = code;
  }
}

@Injectable()
export class GameSecurityService {
  private readonly logger = new Logger(GameSecurityService.name);

  constructor(
    private readonly rateLimitStore: RateLimitStore,
    private readonly captchaVerifier: CaptchaVerifier,
  ) {}

  /**
   * Validate the mouse-shake proof attached to a play request. Pass the
   * `enforce` flag from `process.env.GAMIFICATION_MOUSE_SHAKE_REQUIRED`. When
   * disabled, malformed proofs are tolerated (dev / mobile-tap fallback).
   */
  assertShakeProof(proof: ShakeProof | undefined, enforce: boolean): void {
    if (!enforce) return;
    if (!proof) {
      throw new SecurityViolationError('SHAKE_PROOF_MISSING', 'no shake_proof in payload');
    }
    if (
      proof.duration_ms < SHAKE_PROOF_THRESHOLDS.min_duration_ms ||
      proof.samples < SHAKE_PROOF_THRESHOLDS.min_samples ||
      proof.avg_amplitude_px < SHAKE_PROOF_THRESHOLDS.min_avg_amplitude_px
    ) {
      throw new SecurityViolationError(
        'SHAKE_PROOF_INVALID',
        `proof did not meet thresholds (got ${JSON.stringify(proof)})`,
      );
    }
  }

  /**
   * Check rate limit and escalate to CAPTCHA when the per-window quota is
   * tripped. Mutates the store; safe under append-only-by-overwrite-window
   * since the window is small and write-only.
   */
  async checkRateAndCaptcha(args: {
    user_id: string;
    ip: string;
    captcha_token: string | undefined;
    enforce_captcha: boolean;
    clock?: () => Date;
  }): Promise<{ remaining: number; captcha_consumed: boolean }> {
    const clock = args.clock ?? (() => new Date());
    const now = clock().getTime();
    const existing = await this.rateLimitStore.read(args.user_id, args.ip);
    const windowMs = RATE_LIMIT.window_seconds * 1000;
    let next: RateLimitWindow;
    if (!existing || now - existing.window_started_at_ms > windowMs) {
      next = { user_id: args.user_id, ip: args.ip, count: 1, window_started_at_ms: now };
    } else {
      next = { ...existing, count: existing.count + 1 };
    }

    let captcha_consumed = false;
    if (next.count > RATE_LIMIT.plays_before_captcha && args.enforce_captcha) {
      if (!args.captcha_token) {
        throw new SecurityViolationError(
          'CAPTCHA_REQUIRED',
          `rate limit exceeded — provide captcha_token (count=${next.count})`,
        );
      }
      const ok = await this.captchaVerifier.verify(args.captcha_token);
      if (!ok) {
        throw new SecurityViolationError('CAPTCHA_FAILED', 'captcha did not verify');
      }
      // CAPTCHA cleared — reset the window so the user is not perpetually challenged.
      await this.rateLimitStore.reset(args.user_id, args.ip);
      captcha_consumed = true;
      this.logger.log('GameSecurityService: CAPTCHA cleared, window reset', {
        user_id: args.user_id,
        ip: args.ip,
      });
      return { remaining: RATE_LIMIT.plays_before_captcha, captcha_consumed };
    }
    await this.rateLimitStore.upsert(next);
    return {
      remaining: Math.max(0, RATE_LIMIT.plays_before_captcha - next.count),
      captcha_consumed,
    };
  }
}

/** No-op verifier used in tests + dev. Never deploy to production. */
export class AlwaysAllowCaptchaVerifier implements CaptchaVerifier {
  async verify(_token: string): Promise<boolean> {
    return true;
  }
}

/** In-memory store for tests + single-process dev. Production uses Redis. */
export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly map = new Map<string, RateLimitWindow>();
  private key(user_id: string, ip: string): string {
    return `${user_id}::${ip}`;
  }
  async read(user_id: string, ip: string): Promise<RateLimitWindow | null> {
    return this.map.get(this.key(user_id, ip)) ?? null;
  }
  async upsert(window: RateLimitWindow): Promise<void> {
    this.map.set(this.key(window.user_id, window.ip), window);
  }
  async reset(user_id: string, ip: string): Promise<void> {
    this.map.delete(this.key(user_id, ip));
  }
}
