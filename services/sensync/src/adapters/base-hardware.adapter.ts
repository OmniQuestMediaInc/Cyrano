// HZ: SenSync™ — base hardware adapter
// Phase 2.7 — provides the shared lifecycle plumbing (event bus, EWMA latency,
// health snapshot, reconnect back-off) that every concrete adapter inherits.

import { Logger } from '@nestjs/common';
import {
  HARDWARE_RECONNECT_INITIAL_BACKOFF_MS,
  HARDWARE_RECONNECT_MAX_ATTEMPTS,
  HARDWARE_RECONNECT_MAX_BACKOFF_MS,
  type SenSyncAdapterEvent,
  type SenSyncAdapterEventType,
  type SenSyncAdapterHealth,
  type SenSyncEventCallback,
  type SenSyncHardwareAdapter,
  type SenSyncSampleCallback,
} from './hardware-adapter.types';
import type { SenSyncHardwareBridge, SenSyncSample } from '../sensync.types';

const EWMA_ALPHA = 0.3;

export abstract class BaseHardwareAdapter implements SenSyncHardwareAdapter {
  protected readonly logger: Logger;
  abstract readonly bridge: SenSyncHardwareBridge;

  private readonly sampleListeners: SenSyncSampleCallback[] = [];
  private readonly eventListeners: SenSyncEventCallback[] = [];

  private latencyEwma = 0;
  private goodSamples1m = 0;
  private totalSamples1m = 0;
  private windowResetTimer: NodeJS.Timeout | null = null;
  protected reconnectAttempts = 0;

  constructor() {
    this.logger = new Logger(this.constructor.name);
  }

  abstract open(params: import('./hardware-adapter.types').SenSyncAdapterOpenParams): Promise<void>;
  abstract close(session_id: string): Promise<void>;

  onSample(cb: SenSyncSampleCallback): void {
    this.sampleListeners.push(cb);
  }

  onEvent(cb: SenSyncEventCallback): void {
    this.eventListeners.push(cb);
  }

  getHealthSnapshot(): SenSyncAdapterHealth {
    const quality = this.totalSamples1m === 0 ? 1 : this.goodSamples1m / this.totalSamples1m;
    return {
      bridge: this.bridge,
      sample_quality_1m: +quality.toFixed(4),
      latency_ms_ewma: Math.round(this.latencyEwma),
      reconnect_attempts: this.reconnectAttempts,
    };
  }

  // ── Helpers for concrete adapters ──────────────────────────────────────────

  protected emitSample(sample: SenSyncSample, latency_ms: number, plausible: boolean): void {
    this.latencyEwma =
      this.latencyEwma === 0 ? latency_ms : EWMA_ALPHA * latency_ms + (1 - EWMA_ALPHA) * this.latencyEwma;
    this.totalSamples1m += 1;
    if (plausible) this.goodSamples1m += 1;
    this.scheduleWindowReset();
    if (!plausible) return;

    for (const cb of this.sampleListeners) {
      try {
        cb(sample);
      } catch (err) {
        this.logger.warn('BaseHardwareAdapter: sample listener error', { error: String(err) });
      }
    }
  }

  protected emitEvent(event: SenSyncAdapterEvent): void {
    for (const cb of this.eventListeners) {
      try {
        cb(event);
      } catch (err) {
        this.logger.warn('BaseHardwareAdapter: event listener error', { error: String(err) });
      }
    }
  }

  protected backoffMs(): number {
    const exp = Math.min(
      HARDWARE_RECONNECT_MAX_BACKOFF_MS,
      HARDWARE_RECONNECT_INITIAL_BACKOFF_MS * 2 ** this.reconnectAttempts,
    );
    // Equal jitter: half the backoff is fixed, the other half is random in [0, half).
    const half = exp / 2;
    return half + Math.random() * half;
  }

  protected canRetry(): boolean {
    return this.reconnectAttempts < HARDWARE_RECONNECT_MAX_ATTEMPTS;
  }

  protected resetReconnect(): void {
    this.reconnectAttempts = 0;
  }

  protected makeEvent(
    session_id: string,
    event_type: SenSyncAdapterEventType,
    detail?: Record<string, unknown>,
  ): SenSyncAdapterEvent {
    return {
      event_type,
      session_id,
      bridge: this.bridge,
      occurred_at_utc: new Date().toISOString(),
      detail,
    };
  }

  private scheduleWindowReset(): void {
    if (this.windowResetTimer) return;
    this.windowResetTimer = setTimeout(() => {
      this.totalSamples1m = 0;
      this.goodSamples1m = 0;
      this.windowResetTimer = null;
    }, 60_000);
    if (typeof this.windowResetTimer.unref === 'function') this.windowResetTimer.unref();
  }
}
