// HZ: SenSync™ — hardware adapter registry
// Phase 2.7 — central DI-managed lookup that maps a bridge enum value to a
// concrete adapter instance. Consumed by SenSyncService when opening or
// closing a hardware session.

import { Injectable, Logger } from '@nestjs/common';
import { LovenseHardwareAdapter } from './lovense.adapter';
import { PhoneHapticHardwareAdapter } from './phone-haptic.adapter';
import { WebBluetoothHardwareAdapter } from './webble.adapter';
import { WebUsbHardwareAdapter } from './webusb.adapter';
import type { SenSyncHardwareAdapter } from './hardware-adapter.types';
import type { SenSyncHardwareBridge } from '../sensync.types';

@Injectable()
export class HardwareAdapterRegistry {
  private readonly logger = new Logger(HardwareAdapterRegistry.name);
  private readonly registry: ReadonlyMap<SenSyncHardwareBridge, SenSyncHardwareAdapter>;

  constructor(
    private readonly lovense: LovenseHardwareAdapter,
    private readonly webusb: WebUsbHardwareAdapter,
    private readonly webble: WebBluetoothHardwareAdapter,
    private readonly phone: PhoneHapticHardwareAdapter,
  ) {
    this.registry = new Map<SenSyncHardwareBridge, SenSyncHardwareAdapter>([
      ['LOVENSE', this.lovense],
      ['WEB_USB', this.webusb],
      ['WEB_BLUETOOTH', this.webble],
      ['PHONE_HAPTIC', this.phone],
    ]);
  }

  /** Resolve the adapter for a given bridge type. Throws on unknown bridges. */
  resolve(bridge: SenSyncHardwareBridge): SenSyncHardwareAdapter {
    const adapter = this.registry.get(bridge);
    if (!adapter) {
      throw new Error(`HardwareAdapterRegistry: unknown bridge ${bridge}`);
    }
    return adapter;
  }

  /** All adapters — used for health snapshots and Prometheus exposition. */
  all(): SenSyncHardwareAdapter[] {
    return Array.from(this.registry.values());
  }
}
