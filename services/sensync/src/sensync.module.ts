// HZ: SenSync™ module
// Phase 2.7 + 2.8 — wires the consent service, rate limiter, metrics, and the
// hardware adapter registry (Lovense / WebUSB / WebBluetooth / phone-only).
import { Module } from '@nestjs/common';
import { SenSyncController } from './sensync.controller';
import { SenSyncService } from './sensync.service';
import { SenSyncRateLimitService } from './sensync-rate-limit.service';
import { SenSyncMetrics } from './sensync.metrics';
import { HardwareAdapterRegistry } from './adapters/hardware-adapter.registry';
import { LovenseHardwareAdapter } from './adapters/lovense.adapter';
import { PhoneHapticHardwareAdapter } from './adapters/phone-haptic.adapter';
import { WebBluetoothHardwareAdapter } from './adapters/webble.adapter';
import { WebUsbHardwareAdapter } from './adapters/webusb.adapter';

@Module({
  controllers: [SenSyncController],
  providers: [
    SenSyncService,
    SenSyncRateLimitService,
    SenSyncMetrics,
    HardwareAdapterRegistry,
    LovenseHardwareAdapter,
    WebUsbHardwareAdapter,
    WebBluetoothHardwareAdapter,
    PhoneHapticHardwareAdapter,
  ],
  exports: [
    SenSyncService,
    SenSyncRateLimitService,
    SenSyncMetrics,
    HardwareAdapterRegistry,
  ],
})
export class SenSyncModule {}
