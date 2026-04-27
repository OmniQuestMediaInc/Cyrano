// HZ: SenSync™ — Prometheus-style metrics registry
// Phase 2.8 — counters and gauges that the SenSync service emits whenever it
// admits, rejects, or rotates a sample. The SenSyncMetrics object is wired by
// the module so consumers (Grafana exporters) can scrape via a single getter.
//
// We intentionally do not add a hard dependency on `prom-client` here — the
// platform exporter consumes the snapshot via `snapshot()` and translates
// names. Keeping the surface JSON-only avoids pinning an exporter library
// inside core services.

import { Injectable } from '@nestjs/common';
import type { SenSyncDomain, SenSyncHardwareBridge } from './sensync.types';

export interface SenSyncMetricsSnapshot {
  samples_admitted_total: Record<string, number>;
  samples_rejected_total: Record<string, number>;
  /** Phase 4 — per-domain sample counters (non-adult extension visibility). */
  samples_by_domain_total: Record<string, number>;
  consent_grants_total: number;
  consent_revocations_total: number;
  purges_requested_total: number;
  purges_completed_total: number;
  hardware_connected_total: Record<string, number>;
  hardware_disconnected_total: Record<string, number>;
  hardware_reconnect_attempts_total: Record<string, number>;
  rate_limit_trips_total: Record<string, number>;
  /** Latest end-to-end latency EWMA (ms) for each adapter. */
  latency_ms_ewma: Record<string, number>;
}

type RejectReason =
  | 'BPM_BELOW_MIN'
  | 'BPM_ABOVE_MAX'
  | 'NO_CONSENT'
  | 'NO_SESSION'
  | 'RATE_LIMITED_PER_SECOND'
  | 'ANOMALY_BPM_DELTA_EXCEEDED';

@Injectable()
export class SenSyncMetrics {
  private samplesAdmitted = new Map<SenSyncHardwareBridge, number>();
  private samplesRejected = new Map<RejectReason, number>();
  private samplesByDomain = new Map<SenSyncDomain, number>();
  private consentGrants = 0;
  private consentRevocations = 0;
  private purgesRequested = 0;
  private purgesCompleted = 0;
  private hardwareConnected = new Map<SenSyncHardwareBridge, number>();
  private hardwareDisconnected = new Map<SenSyncHardwareBridge, number>();
  private hardwareReconnectAttempts = new Map<SenSyncHardwareBridge, number>();
  private rateLimitTrips = new Map<RejectReason, number>();
  private latencyEwma = new Map<SenSyncHardwareBridge, number>();

  recordSampleAdmitted(bridge: SenSyncHardwareBridge): void {
    this.samplesAdmitted.set(bridge, (this.samplesAdmitted.get(bridge) ?? 0) + 1);
  }

  /** Phase 4 — per-domain admitted-sample counter (non-adult extension visibility). */
  recordSampleByDomain(domain: SenSyncDomain): void {
    this.samplesByDomain.set(domain, (this.samplesByDomain.get(domain) ?? 0) + 1);
  }

  recordSampleRejected(reason: RejectReason): void {
    this.samplesRejected.set(reason, (this.samplesRejected.get(reason) ?? 0) + 1);
  }

  recordConsentGranted(): void {
    this.consentGrants += 1;
  }

  recordConsentRevoked(): void {
    this.consentRevocations += 1;
  }

  recordPurgeRequested(): void {
    this.purgesRequested += 1;
  }

  recordPurgeCompleted(): void {
    this.purgesCompleted += 1;
  }

  recordHardwareConnected(bridge: SenSyncHardwareBridge): void {
    this.hardwareConnected.set(bridge, (this.hardwareConnected.get(bridge) ?? 0) + 1);
  }

  recordHardwareDisconnected(bridge: SenSyncHardwareBridge): void {
    this.hardwareDisconnected.set(bridge, (this.hardwareDisconnected.get(bridge) ?? 0) + 1);
  }

  recordReconnectAttempt(bridge: SenSyncHardwareBridge): void {
    this.hardwareReconnectAttempts.set(
      bridge,
      (this.hardwareReconnectAttempts.get(bridge) ?? 0) + 1,
    );
  }

  recordRateLimitTrip(reason: RejectReason): void {
    this.rateLimitTrips.set(reason, (this.rateLimitTrips.get(reason) ?? 0) + 1);
  }

  setLatencyEwma(bridge: SenSyncHardwareBridge, ms: number): void {
    this.latencyEwma.set(bridge, ms);
  }

  snapshot(): SenSyncMetricsSnapshot {
    return {
      samples_admitted_total: mapToObj(this.samplesAdmitted),
      samples_rejected_total: mapToObj(this.samplesRejected),
      samples_by_domain_total: mapToObj(this.samplesByDomain),
      consent_grants_total: this.consentGrants,
      consent_revocations_total: this.consentRevocations,
      purges_requested_total: this.purgesRequested,
      purges_completed_total: this.purgesCompleted,
      hardware_connected_total: mapToObj(this.hardwareConnected),
      hardware_disconnected_total: mapToObj(this.hardwareDisconnected),
      hardware_reconnect_attempts_total: mapToObj(this.hardwareReconnectAttempts),
      rate_limit_trips_total: mapToObj(this.rateLimitTrips),
      latency_ms_ewma: mapToObj(this.latencyEwma),
    };
  }

  /** Test seam: zero every counter. */
  reset(): void {
    this.samplesAdmitted.clear();
    this.samplesRejected.clear();
    this.samplesByDomain.clear();
    this.consentGrants = 0;
    this.consentRevocations = 0;
    this.purgesRequested = 0;
    this.purgesCompleted = 0;
    this.hardwareConnected.clear();
    this.hardwareDisconnected.clear();
    this.hardwareReconnectAttempts.clear();
    this.rateLimitTrips.clear();
    this.latencyEwma.clear();
  }
}

function mapToObj<K extends string>(m: Map<K, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of m) out[k] = v;
  return out;
}
