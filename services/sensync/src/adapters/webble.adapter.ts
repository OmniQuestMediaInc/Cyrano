// HZ: SenSync™ — Web Bluetooth (BLE) heart-rate adapter
// Phase 2.7 — generic Web Bluetooth bridge for GATT 0x180D (Heart Rate
// Service) compliant peripherals.
//
// Implementation status: STUB. Same renderer-shim pattern as the WebUSB
// adapter — all GATT decoding happens in the browser; this adapter receives
// pre-normalised BPM frames.

import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { BaseHardwareAdapter } from './base-hardware.adapter';
import {
  HARDWARE_RECONNECT_MAX_ATTEMPTS,
  type SenSyncAdapterOpenParams,
  type SenSyncRendererBridgeAdapter,
} from './hardware-adapter.types';
import {
  SENSYNC_BPM_MAX,
  SENSYNC_BPM_MIN,
  type SenSyncHardwareBridge,
  type SenSyncSample,
} from '../sensync.types';

@Injectable()
export class WebBluetoothHardwareAdapter
  extends BaseHardwareAdapter
  implements SenSyncRendererBridgeAdapter
{
  readonly bridge: SenSyncHardwareBridge = 'WEB_BLUETOOTH';

  private readonly active = new Map<string, SenSyncAdapterOpenParams>();

  async open(params: SenSyncAdapterOpenParams): Promise<void> {
    if (this.active.has(params.session_id)) return;
    this.active.set(params.session_id, params);
    this.resetReconnect();
    this.emitEvent(
      this.makeEvent(params.session_id, 'CONNECTED', {
        device_id: params.device_id ?? null,
        gatt_service: '0x180D',
      }),
    );
  }

  async close(session_id: string): Promise<void> {
    if (!this.active.delete(session_id)) return;
    this.emitEvent(this.makeEvent(session_id, 'DISCONNECTED', { initiator: 'service' }));
  }

  ingestRendererFrame(args: { session_id: string; bpm: number; captured_device_ms: number }): void {
    const params = this.active.get(args.session_id);
    if (!params) return;
    const sample: SenSyncSample = {
      sample_id: randomUUID(),
      session_id: args.session_id,
      creator_id: params.creator_id,
      guest_id: params.guest_id,
      bridge: this.bridge,
      bpm_raw: args.bpm,
      captured_device_ms: args.captured_device_ms,
      received_at_utc: new Date().toISOString(),
      tier: params.tier,
      domain: params.domain,
    };
    const plausible = args.bpm >= SENSYNC_BPM_MIN && args.bpm <= SENSYNC_BPM_MAX;
    const latency_ms = Math.max(0, Date.now() - args.captured_device_ms);
    this.emitSample(sample, latency_ms, plausible);
  }

  notifyRendererDisconnect(args: { session_id: string; reason: string }): void {
    if (!this.active.has(args.session_id)) return;
    this.emitEvent(this.makeEvent(args.session_id, 'DISCONNECTED', { reason: args.reason }));
    if (this.canRetry()) {
      this.reconnectAttempts += 1;
      this.emitEvent(
        this.makeEvent(args.session_id, 'RECONNECT_ATTEMPT', {
          attempt: this.reconnectAttempts,
        }),
      );
    } else {
      this.emitEvent(
        this.makeEvent(args.session_id, 'RECONNECT_FAILED', {
          attempts: this.reconnectAttempts,
          max: HARDWARE_RECONNECT_MAX_ATTEMPTS,
        }),
      );
      this.active.delete(args.session_id);
    }
  }
}
