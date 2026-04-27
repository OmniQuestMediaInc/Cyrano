/**
 * sensync-metrics.spec.ts
 * Phase 2.8 — counter/gauge surface that the platform Prometheus exporter
 * scrapes via SenSyncMetrics.snapshot().
 */
import { SenSyncMetrics } from '../../services/sensync/src/sensync.metrics';

describe('SenSyncMetrics', () => {
  it('starts with empty counters', () => {
    const m = new SenSyncMetrics();
    const snap = m.snapshot();
    expect(snap.consent_grants_total).toBe(0);
    expect(snap.samples_admitted_total).toEqual({});
  });

  it('accumulates per-bridge sample counts', () => {
    const m = new SenSyncMetrics();
    m.recordSampleAdmitted('LOVENSE');
    m.recordSampleAdmitted('LOVENSE');
    m.recordSampleAdmitted('WEB_BLUETOOTH');
    expect(m.snapshot().samples_admitted_total).toEqual({
      LOVENSE: 2,
      WEB_BLUETOOTH: 1,
    });
  });

  it('tracks consent + purge lifecycle events', () => {
    const m = new SenSyncMetrics();
    m.recordConsentGranted();
    m.recordConsentRevoked();
    m.recordPurgeRequested();
    m.recordPurgeCompleted();
    const snap = m.snapshot();
    expect(snap.consent_grants_total).toBe(1);
    expect(snap.consent_revocations_total).toBe(1);
    expect(snap.purges_requested_total).toBe(1);
    expect(snap.purges_completed_total).toBe(1);
  });

  it('reset() zeroes every counter', () => {
    const m = new SenSyncMetrics();
    m.recordSampleAdmitted('LOVENSE');
    m.recordConsentGranted();
    m.reset();
    const snap = m.snapshot();
    expect(snap.consent_grants_total).toBe(0);
    expect(snap.samples_admitted_total).toEqual({});
  });
});
