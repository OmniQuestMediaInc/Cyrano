// HZ: SenSync™ — hardware adapter contract
// Phase 2.7 — every concrete bridge (Lovense, WebUSB, WebBluetooth, phone-only)
// implements this interface. The registry resolves an adapter for a session
// based on its declared bridge type. Adapters never persist data — they only
// translate vendor-specific events into domain-neutral SenSyncSample frames
// and surface lifecycle callbacks for connect/disconnect.
//
// Strict design rules:
//   • Adapters are stateless w.r.t. consent/payment — those are the
//     SenSyncService's concern. They MUST NOT publish to NATS directly.
//   • Reconnection back-off is implemented by the adapter (exponential, capped
//     at HARDWARE_RECONNECT_MAX_BACKOFF_MS). The registry exposes the
//     resulting SenSyncHardwareEvent stream to the service.
//   • Adapters report quality telemetry (latency, drop-rate) via
//     `getHealthSnapshot()` — surfaced to Prometheus metrics by the service.

import type {
  SenSyncDomain,
  SenSyncHardwareBridge,
  SenSyncSample,
  MembershipTier,
} from '../sensync.types';

/** Vendor-specific opaque connection parameters supplied at session open. */
export interface SenSyncAdapterOpenParams {
  session_id: string;
  creator_id: string;
  guest_id: string;
  tier: MembershipTier;
  domain: SenSyncDomain;
  /** Optional vendor-specific token (e.g. Lovense Connect short-code). */
  vendor_token?: string;
  /** Optional WebUSB / WebBluetooth device ID supplied by the browser. */
  device_id?: string;
}

/** Connection lifecycle reason codes. */
export type SenSyncAdapterEventType =
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'RECONNECT_ATTEMPT'
  | 'RECONNECT_FAILED'
  | 'PERMISSION_DENIED'
  | 'UNSUPPORTED_DEVICE';

/** Lifecycle event surfaced by an adapter. */
export interface SenSyncAdapterEvent {
  event_type: SenSyncAdapterEventType;
  session_id: string;
  bridge: SenSyncHardwareBridge;
  occurred_at_utc: string;
  detail?: Record<string, unknown>;
}

/** Health/quality snapshot returned by `getHealthSnapshot()`. */
export interface SenSyncAdapterHealth {
  bridge: SenSyncHardwareBridge;
  /** Ratio of plausible samples received in the last minute (0..1). */
  sample_quality_1m: number;
  /** EWMA of end-to-end latency (device → service ingestion) in ms. */
  latency_ms_ewma: number;
  /** Cumulative reconnect attempts since session open. */
  reconnect_attempts: number;
}

/** Sample callback registered by the SenSyncService. */
export type SenSyncSampleCallback = (sample: SenSyncSample) => void;
/** Lifecycle callback registered by the SenSyncService. */
export type SenSyncEventCallback = (event: SenSyncAdapterEvent) => void;

/** Hardware adapter contract. */
export interface SenSyncHardwareAdapter {
  readonly bridge: SenSyncHardwareBridge;

  /**
   * Open a hardware session. The implementation negotiates with the vendor
   * SDK or browser API and arms its sample/event streams. Must be idempotent
   * for the same `session_id`.
   */
  open(params: SenSyncAdapterOpenParams): Promise<void>;

  /** Close the hardware session and release all resources. */
  close(session_id: string): Promise<void>;

  /** Subscribe to plausibility-eligible samples. */
  onSample(cb: SenSyncSampleCallback): void;

  /** Subscribe to lifecycle events (connect/disconnect/reconnect). */
  onEvent(cb: SenSyncEventCallback): void;

  /** Current health snapshot for monitoring. */
  getHealthSnapshot(): SenSyncAdapterHealth;
}

/** Reconnection policy applied by every concrete adapter. */
export const HARDWARE_RECONNECT_INITIAL_BACKOFF_MS = 500;
export const HARDWARE_RECONNECT_MAX_BACKOFF_MS = 30_000;
export const HARDWARE_RECONNECT_MAX_ATTEMPTS = 10;

/**
 * Phase 1 — renderer-shim contract. WebUSB / WebBluetooth / future renderer-
 * driven bridges decode the device descriptor in the browser and POST a
 * normalised BPM frame to the service. Adapters that implement this surface
 * accept those frames via `ingestRendererFrame`.
 */
export interface SenSyncRendererBridgeAdapter extends SenSyncHardwareAdapter {
  ingestRendererFrame(args: {
    session_id: string;
    bpm: number;
    captured_device_ms: number;
  }): void;
  notifyRendererDisconnect(args: { session_id: string; reason: string }): void;
}

export function isRendererBridgeAdapter(
  a: SenSyncHardwareAdapter,
): a is SenSyncRendererBridgeAdapter {
  return (
    typeof (a as Partial<SenSyncRendererBridgeAdapter>).ingestRendererFrame === 'function' &&
    typeof (a as Partial<SenSyncRendererBridgeAdapter>).notifyRendererDisconnect === 'function'
  );
}
