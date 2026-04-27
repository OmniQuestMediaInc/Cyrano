// HZ: SenSync™ — per-session rate limiter
// Phase 2.8 — protects the biometric pipeline from runaway hardware bursts
// and from anomalous client misuse. The service caps both the sustained
// sample rate (sliding window) and the anomaly score (large BPM jumps).
//
// The limiter is in-process and per-session. For multi-replica deployments
// the consent gate already deduplicates samples downstream; this layer
// handles only client-side abuse, not horizontal coordination.

import { Injectable, Logger } from '@nestjs/common';

/** Maximum samples per second per session before the limiter trips. */
export const SENSYNC_MAX_SAMPLES_PER_SECOND = 4;
/** Sliding window for the rate calculation (ms). */
export const SENSYNC_RATE_WINDOW_MS = 1_000;
/** Largest plausible single-tick BPM jump before flagging as anomaly. */
export const SENSYNC_MAX_BPM_DELTA = 50;

/** Result of a rate-limit decision. */
export interface RateLimitDecision {
  allowed: boolean;
  reason_code?:
    | 'RATE_LIMITED_PER_SECOND'
    | 'ANOMALY_BPM_DELTA_EXCEEDED';
  observed_rate?: number;
  observed_delta?: number;
}

interface SessionState {
  /** Monotonic timestamps (ms) of recent samples within the window. */
  timestamps: number[];
  /** Last accepted BPM, used for delta-anomaly detection. */
  last_bpm?: number;
}

@Injectable()
export class SenSyncRateLimitService {
  private readonly logger = new Logger(SenSyncRateLimitService.name);
  private readonly state = new Map<string, SessionState>();

  /**
   * Decide whether to admit the next sample for `session_id`. Side-effecting:
   * on a successful `allowed=true` response the timestamp/last_bpm are
   * recorded for subsequent calls.
   */
  admit(session_id: string, bpm: number, now_ms: number = Date.now()): RateLimitDecision {
    const s = this.ensure(session_id);

    // Drop expired timestamps.
    const cutoff = now_ms - SENSYNC_RATE_WINDOW_MS;
    while (s.timestamps.length > 0 && s.timestamps[0] < cutoff) s.timestamps.shift();

    if (s.timestamps.length >= SENSYNC_MAX_SAMPLES_PER_SECOND) {
      return {
        allowed: false,
        reason_code: 'RATE_LIMITED_PER_SECOND',
        observed_rate: s.timestamps.length,
      };
    }

    if (s.last_bpm !== undefined) {
      const delta = Math.abs(bpm - s.last_bpm);
      if (delta > SENSYNC_MAX_BPM_DELTA) {
        return {
          allowed: false,
          reason_code: 'ANOMALY_BPM_DELTA_EXCEEDED',
          observed_delta: delta,
        };
      }
    }

    s.timestamps.push(now_ms);
    s.last_bpm = bpm;
    return { allowed: true };
  }

  /** Forget any state for a session. Called on session close + consent revoke. */
  forget(session_id: string): void {
    this.state.delete(session_id);
  }

  private ensure(session_id: string): SessionState {
    let s = this.state.get(session_id);
    if (!s) {
      s = { timestamps: [] };
      this.state.set(session_id, s);
    }
    return s;
  }
}
