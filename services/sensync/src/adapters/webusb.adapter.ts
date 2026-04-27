// HZ: SenSync™ — WebUSB heart-rate adapter
// Phase 2.7 — generic WebUSB bridge for vendor-agnostic heart-rate monitors
// (e.g. medical-grade USB pulse oximeters, future OQMInc™ wristbands).
//
// Implementation status: STUB. Browser-side WebUSB requires the renderer
// process and a vendor descriptor. This service-side adapter exposes the
// hooks the browser shim invokes once a USB endpoint is bound.

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
export class WebUsbHardwareAdapter
  extends BaseHardwareAdapter
  implements SenSyncRendererBridgeAdapter
{
  readonly bridge: SenSyncHardwareBridge = 'WEB_USB';

  private readonly active = new Map<string, SenSyncAdapterOpenParams>();

  async open(params: SenSyncAdapterOpenParams): Promise<void> {
    if (this.active.has(params.session_id)) return;
    if (!params.device_id) {
      this.emitEvent(
        this.makeEvent(params.session_id, 'UNSUPPORTED_DEVICE', {
          reason: 'WEB_USB_DEVICE_ID_REQUIRED',
        }),
      );
      return;
    }
    this.active.set(params.session_id, params);
    this.resetReconnect();
    this.emitEvent(
      this.makeEvent(params.session_id, 'CONNECTED', {
        device_id: params.device_id,
        domain: params.domain,
      }),
    );
  }

  async close(session_id: string): Promise<void> {
    if (!this.active.delete(session_id)) return;
    this.emitEvent(this.makeEvent(session_id, 'DISCONNECTED', { initiator: 'service' }));
  }

  /**
   * Browser-side shim entry point. Called once per USB report frame after the
   * renderer has decoded the descriptor. Adapters never read raw USB bytes —
   * they only consume normalized BPM frames from the renderer.
   */
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

  /** Browser-side shim entry point — disconnect notification from renderer. */
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
