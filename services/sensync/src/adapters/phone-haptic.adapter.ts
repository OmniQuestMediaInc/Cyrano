// HZ: SenSync™ — phone-haptic fallback adapter
// Phase 2.7 — non-Diamond tiers and devices without hardware BPM bridges still
// route through the SenSync registry. This adapter never produces samples; it
// exposes only a CONNECTED → DISCONNECTED lifecycle so the rest of the
// pipeline (consent, audit, FFS fallback) is identical regardless of bridge.

import { Injectable } from '@nestjs/common';
import { BaseHardwareAdapter } from './base-hardware.adapter';
import type { SenSyncAdapterOpenParams } from './hardware-adapter.types';
import type { SenSyncHardwareBridge } from '../sensync.types';

@Injectable()
export class PhoneHapticHardwareAdapter extends BaseHardwareAdapter {
  readonly bridge: SenSyncHardwareBridge = 'PHONE_HAPTIC';

  private readonly active = new Set<string>();

  async open(params: SenSyncAdapterOpenParams): Promise<void> {
    if (this.active.has(params.session_id)) return;
    this.active.add(params.session_id);
    this.emitEvent(this.makeEvent(params.session_id, 'CONNECTED', { mode: 'phone_only' }));
  }

  async close(session_id: string): Promise<void> {
    if (!this.active.delete(session_id)) return;
    this.emitEvent(this.makeEvent(session_id, 'DISCONNECTED', { initiator: 'service' }));
  }
}
