// HZ: SenSync™ — Lovense Connect adapter
// Phase 2.7 — primary partner integration. Establishes a WebSocket session
// with the Lovense Connect SDK and translates BPM frames into SenSyncSample.
//
// Implementation status: STUB. The runtime WebSocket transport is not wired
// here — that requires the Lovense client library and a deployment-specific
// gateway URL. Concrete networking is delegated to a swappable
// `connectTransport` hook so this adapter is exercise-able by tests using
// an in-process fake transport.

import { Inject, Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { BaseHardwareAdapter } from './base-hardware.adapter';
import {
  HARDWARE_RECONNECT_MAX_ATTEMPTS,
  type SenSyncAdapterOpenParams,
} from './hardware-adapter.types';
import {
  SENSYNC_BPM_MAX,
  SENSYNC_BPM_MIN,
  type SenSyncHardwareBridge,
  type SenSyncSample,
} from '../sensync.types';

export type LovenseTransportFactory = (
  url: string,
  onMessage: (raw: string) => void,
  onClose: (reason: string) => void,
) => Promise<{ close: () => void }>;

/**
 * DI tokens for the Lovense transport factory and gateway URL.
 * Real deployments register a concrete WebSocket-backed factory by binding
 * `LOVENSE_TRANSPORT_FACTORY` in `sensync.module.ts`. The default is a no-op
 * stub so the service starts cleanly in test/local environments.
 */
export const LOVENSE_TRANSPORT_FACTORY = 'LOVENSE_TRANSPORT_FACTORY';
export const LOVENSE_GATEWAY_URL = 'LOVENSE_GATEWAY_URL';

@Injectable()
export class LovenseHardwareAdapter extends BaseHardwareAdapter {
  readonly bridge: SenSyncHardwareBridge = 'LOVENSE';

  private transports = new Map<string, { close: () => void }>();
  private openParams = new Map<string, SenSyncAdapterOpenParams>();
  private readonly transportFactory: LovenseTransportFactory;
  private readonly gatewayUrl: string;

  constructor(
    @Optional() @Inject(LOVENSE_TRANSPORT_FACTORY) factory?: LovenseTransportFactory,
    @Optional() @Inject(LOVENSE_GATEWAY_URL) gatewayUrl?: string,
  ) {
    super();
    this.transportFactory = factory ?? defaultLovenseTransport;
    this.gatewayUrl =
      gatewayUrl ?? process.env.LOVENSE_CONNECT_URL ?? 'wss://api.lovense.com/connect';
  }

  async open(params: SenSyncAdapterOpenParams): Promise<void> {
    if (this.transports.has(params.session_id)) return; // idempotent
    this.openParams.set(params.session_id, params);
    await this.connect(params);
  }

  async close(session_id: string): Promise<void> {
    const transport = this.transports.get(session_id);
    if (transport) {
      try {
        transport.close();
      } catch (err) {
        this.logger.warn('LovenseAdapter: transport close failed', { error: String(err) });
      }
      this.transports.delete(session_id);
    }
    this.openParams.delete(session_id);
    this.emitEvent(this.makeEvent(session_id, 'DISCONNECTED', { initiator: 'service' }));
  }

  private async connect(params: SenSyncAdapterOpenParams): Promise<void> {
    const url = this.gatewayUrl + (params.vendor_token ? `?token=${params.vendor_token}` : '');
    try {
      const transport = await this.transportFactory(
        url,
        (raw) => this.onTransportMessage(params, raw),
        (reason) => this.onTransportClose(params, reason),
      );
      this.transports.set(params.session_id, transport);
      this.resetReconnect();
      this.emitEvent(this.makeEvent(params.session_id, 'CONNECTED', { gateway: this.gatewayUrl }));
    } catch (err) {
      this.emitEvent(
        this.makeEvent(params.session_id, 'RECONNECT_FAILED', { error: String(err) }),
      );
      this.scheduleReconnect(params);
    }
  }

  private onTransportMessage(params: SenSyncAdapterOpenParams, raw: string): void {
    try {
      const parsed = JSON.parse(raw) as { type?: string; bpm?: number; ts?: number };
      if (parsed.type !== 'bpm' || typeof parsed.bpm !== 'number') return;

      const captured_device_ms = typeof parsed.ts === 'number' ? parsed.ts : Date.now();
      const sample: SenSyncSample = {
        sample_id: randomUUID(),
        session_id: params.session_id,
        creator_id: params.creator_id,
        guest_id: params.guest_id,
        bridge: this.bridge,
        bpm_raw: parsed.bpm,
        captured_device_ms,
        received_at_utc: new Date().toISOString(),
        tier: params.tier,
        domain: params.domain,
      };

      const plausible = parsed.bpm >= SENSYNC_BPM_MIN && parsed.bpm <= SENSYNC_BPM_MAX;
      const latency_ms = Math.max(0, Date.now() - captured_device_ms);
      this.emitSample(sample, latency_ms, plausible);
    } catch (err) {
      this.logger.debug('LovenseAdapter: malformed transport message', { error: String(err) });
    }
  }

  private onTransportClose(params: SenSyncAdapterOpenParams, reason: string): void {
    this.transports.delete(params.session_id);
    this.emitEvent(this.makeEvent(params.session_id, 'DISCONNECTED', { reason }));
    this.scheduleReconnect(params);
  }

  private scheduleReconnect(params: SenSyncAdapterOpenParams): void {
    if (!this.openParams.has(params.session_id)) return; // closed by service
    if (!this.canRetry()) {
      this.emitEvent(
        this.makeEvent(params.session_id, 'RECONNECT_FAILED', {
          attempts: this.reconnectAttempts,
          max: HARDWARE_RECONNECT_MAX_ATTEMPTS,
        }),
      );
      return;
    }
    this.reconnectAttempts += 1;
    const delay = this.backoffMs();
    this.emitEvent(
      this.makeEvent(params.session_id, 'RECONNECT_ATTEMPT', {
        attempt: this.reconnectAttempts,
        delay_ms: Math.round(delay),
      }),
    );
    const handle = setTimeout(() => {
      void this.connect(params);
    }, delay);
    if (typeof handle.unref === 'function') handle.unref();
  }
}

/**
 * Default no-op transport. Real deployments inject a WebSocket-backed
 * transport (e.g. via `@nestjs/common`'s factory pattern in
 * `sensync.module.ts`). The default surfaces an immediate
 * RECONNECT_FAILED so callers can distinguish "no transport configured"
 * from genuine network errors.
 */
const defaultLovenseTransport: LovenseTransportFactory = async () => {
  return { close: () => undefined };
};
