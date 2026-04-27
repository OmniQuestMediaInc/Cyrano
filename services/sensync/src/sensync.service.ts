// HZ: SenSync™ biometric layer — core service
// Business Plan §HZ — Diamond-tier opt-in BPM pipeline with persistent consent,
// Law 25 / PIPEDA / GDPR compliance, and non-adult domain extension points.
//
// Contract:
//   • openSession: validates tier, registers ephemeral session state.
//   • grantConsent: persists SenSyncConsent to Postgres; emits NATS event.
//   • revokeConsent: marks consent revoked in DB; clears session state.
//   • submitSample: plausibility filter [30..220], normalize, publish
//     sensync.biometric.data for FFS scoring (only if consent is active).
//   • requestPurge: Law 25 §28 data deletion — writes purge_requested_at
//     on all consent rows for the guest, emits SENSYNC_PURGE_REQUESTED.
//   • Hardware tiers: only VIP_DIAMOND may use hardware bridges. Other tiers
//     receive TIER_SENSYNC_HARDWARE_DISABLED and the session is rejected.

import {
  BadRequestException,
  Injectable,
  Logger,
  Optional,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { PrismaService } from '../../core-api/src/prisma.service';
import { NATS_TOPICS } from '../../nats/topics.registry';
import { HardwareAdapterRegistry } from './adapters/hardware-adapter.registry';
import { SenSyncRateLimitService } from './sensync-rate-limit.service';
import { SenSyncMetrics } from './sensync.metrics';
import {
  SENSYNC_BPM_MAX,
  SENSYNC_BPM_MIN,
  SENSYNC_CONSENT_VERSION,
  SENSYNC_DEFAULT_CONSENT_SCOPES,
  SENSYNC_DEFAULT_CONSENT_TTL_SECONDS,
  SENSYNC_FFS_BOOST_MAX,
  SENSYNC_FFS_BOOST_MIN,
  SENSYNC_HARDWARE_TIERS,
  SENSYNC_MAX_CONSENT_TTL_SECONDS,
  SENSYNC_MIN_CONSENT_TTL_SECONDS,
  SENSYNC_RULE_ID,
  type MembershipTier,
  type SenSyncAuditEvent,
  type SenSyncBiometricPayload,
  type SenSyncBpmUpdatePayload,
  type SenSyncConsentBasis,
  type SenSyncConsentRecord,
  type SenSyncConsentScope,
  type SenSyncDomain,
  type SenSyncHardwareBridge,
  type SenSyncHardwareEvent,
  type SenSyncPlausibilityRejection,
  type SenSyncPurgeCompleted,
  type SenSyncPurgeRequest,
  type SenSyncSample,
  type SenSyncSessionState,
  type SenSyncTierDisabledEvent,
  type SenSyncValidSample,
} from './sensync.types';

/** Phase 4 — interval at which the in-memory consent cache is swept for expired rows. */
const SENSYNC_EXPIRY_SWEEP_INTERVAL_MS = 60_000;

@Injectable()
export class SenSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SenSyncService.name);
  private expirySweepTimer: NodeJS.Timeout | null = null;

  /** Ephemeral in-session state — never persisted directly. */
  private readonly sessions = new Map<string, SenSyncSessionState>();

  /**
   * Phase 5.3 — scope-aware consent cache.
   * Key: `${session_id}:${guest_id}`.
   * Value: an object containing the granted scope set + UTC ms expiry. A
   * missing entry forces a DB lookup; a present entry with empty scope set
   * means "consent revoked / not granted" and short-circuits the gate.
   */
  private readonly consentCache = new Map<
    string,
    { scopes: Set<SenSyncConsentScope>; expires_at_ms: number | null }
  >();

  constructor(
    private readonly nats: NatsService,
    private readonly prisma: PrismaService,
    @Optional() private readonly rateLimiter?: SenSyncRateLimitService,
    @Optional() private readonly metrics?: SenSyncMetrics,
    @Optional() private readonly hardware?: HardwareAdapterRegistry,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('SenSyncService: initialized', {
      consent_version: SENSYNC_CONSENT_VERSION,
      hardware_tiers: SENSYNC_HARDWARE_TIERS,
      hardware_registry: this.hardware ? 'present' : 'absent',
      rate_limit: this.rateLimiter ? 'enabled' : 'disabled',
      metrics: this.metrics ? 'enabled' : 'disabled',
    });
    this.bindHardwareAdapters();
    this.startExpirySweep();
  }

  onModuleDestroy(): void {
    if (this.expirySweepTimer) {
      clearInterval(this.expirySweepTimer);
      this.expirySweepTimer = null;
    }
  }

  /**
   * Phase 4 — periodic expiry sweep. Walks the in-memory consent cache and
   * tears down entries whose TTL has elapsed, even when no sample has been
   * submitted recently. Emits a CONSENT_EXPIRED audit event per evicted row.
   */
  private startExpirySweep(): void {
    const handle = setInterval(() => {
      const now = Date.now();
      for (const [key, cached] of this.consentCache) {
        if (cached.expires_at_ms !== null && now >= cached.expires_at_ms) {
          this.consentCache.delete(key);
          const [session_id, guest_id] = key.split(':');
          const state = this.sessions.get(session_id);
          if (state) {
            state.consent_granted = false;
            state.consent_scopes.clear();
            state.consent_expires_at_ms = undefined;
            state.last_bpm = undefined;
            state.last_sample_at_utc = undefined;
          }
          this.rateLimiter?.forget(session_id);
          this.emitAudit({
            event_type: 'CONSENT_EXPIRED',
            session_id,
            guest_id,
            creator_id: state?.creator_id,
            domain: state?.domain ?? 'ADULT_ENTERTAINMENT',
            correlation_id: `sensync-expiry-sweep-${session_id}`,
            reason_code: 'SENSYNC_CONSENT_EXPIRED',
          });
        }
      }
    }, SENSYNC_EXPIRY_SWEEP_INTERVAL_MS);
    if (typeof handle.unref === 'function') handle.unref();
    this.expirySweepTimer = handle;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Open a SenSync session. Hardware bridge sessions are Diamond-tier only.
   * Returns the initial session state or null if tier is ineligible.
   */
  openSession(
    session_id: string,
    creator_id: string,
    guest_id: string,
    tier: MembershipTier,
    bridge: SenSyncHardwareBridge,
    domain: SenSyncDomain = 'ADULT_ENTERTAINMENT',
    vendor_token?: string,
    device_id?: string,
  ): SenSyncSessionState | null {
    // Hardware bridges (Lovense, WebUSB, WebBluetooth) require VIP_DIAMOND.
    const isHardware = bridge !== 'PHONE_HAPTIC';
    if (isHardware && !this.isTierEligible(tier)) {
      this.emitTierDisabled(session_id, guest_id, tier);
      return null;
    }

    const state: SenSyncSessionState = {
      session_id,
      creator_id,
      guest_id,
      tier,
      domain,
      bridge,
      consent_granted: false,
      consent_scopes: new Set<SenSyncConsentScope>(),
    };

    this.sessions.set(session_id, state);
    this.logger.log('SenSyncService: session opened', { session_id, tier, bridge, domain });

    // Open the hardware adapter for this bridge if the registry is wired.
    if (this.hardware) {
      const adapter = this.hardware.resolve(bridge);
      void adapter
        .open({ session_id, creator_id, guest_id, tier, domain, vendor_token, device_id })
        .catch((err: unknown) => {
          this.logger.warn('SenSyncService: hardware adapter open failed', {
            session_id,
            bridge,
            error: String(err),
          });
        });
    }

    return state;
  }

  /**
   * Grant SenSync consent for a session.
   * Phase 5.3 — explicit opt-in with granular scopes and ephemerality TTL.
   * Persists a SenSyncConsent row to Postgres and emits SENSYNC_CONSENT_GRANTED
   * on NATS. Also publishes a SenSyncAuditEvent for the immutable audit log.
   */
  async grantConsent(args: {
    session_id: string;
    creator_id: string;
    guest_id: string;
    domain?: SenSyncDomain;
    ip_hash?: string;
    device_fingerprint?: string;
    correlation_id: string;
    scopes?: SenSyncConsentScope[];
    ttl_seconds?: number;
  }): Promise<SenSyncConsentRecord> {
    const now = new Date();

    if (args.ip_hash !== undefined && !/^[0-9a-fA-F]{64}$/.test(args.ip_hash)) {
      throw new BadRequestException(
        'ip_hash must be a 64-character hex-encoded SHA-256 digest — never a raw IP address',
      );
    }

    const scopes = (args.scopes && args.scopes.length > 0
      ? Array.from(new Set(args.scopes))
      : [...SENSYNC_DEFAULT_CONSENT_SCOPES]) as SenSyncConsentScope[];

    const ttl = clampTtlSeconds(args.ttl_seconds);
    const consent_expires_at = new Date(now.getTime() + ttl * 1000);

    const row = await this.prisma.senSyncConsent.create({
      data: {
        session_id: args.session_id,
        creator_id: args.creator_id,
        guest_id: args.guest_id,
        consent_version: SENSYNC_CONSENT_VERSION,
        basis: 'EXPLICIT_OPT_IN' satisfies SenSyncConsentBasis,
        consent_granted_at: now,
        consent_scopes: scopes,
        consent_expires_at,
        ip_hash: args.ip_hash ?? null,
        device_fingerprint: args.device_fingerprint ?? null,
        domain: args.domain ?? 'ADULT_ENTERTAINMENT',
        correlation_id: args.correlation_id,
        reason_code: 'SENSYNC_CONSENT_GRANTED',
        rule_applied_id: SENSYNC_RULE_ID,
      },
    });

    // Update ephemeral session state.
    const state = this.sessions.get(args.session_id);
    if (state) {
      state.consent_granted = true;
      state.consent_scopes = new Set(scopes);
      state.consent_expires_at_ms = consent_expires_at.getTime();
    }
    this.consentCache.set(`${args.session_id}:${args.guest_id}`, {
      scopes: new Set(scopes),
      expires_at_ms: consent_expires_at.getTime(),
    });

    const record: SenSyncConsentRecord = {
      consent_id: row.id,
      session_id: row.session_id,
      creator_id: row.creator_id,
      guest_id: row.guest_id,
      consent_version: row.consent_version,
      basis: row.basis as SenSyncConsentBasis,
      consent_granted_at: row.consent_granted_at.toISOString(),
      consent_scopes: scopes,
      consent_expires_at: consent_expires_at.toISOString(),
      ip_hash: row.ip_hash ?? undefined,
      device_fingerprint: row.device_fingerprint ?? undefined,
      domain: row.domain as SenSyncDomain,
      correlation_id: row.correlation_id,
      reason_code: row.reason_code,
      rule_applied_id: row.rule_applied_id,
    };

    this.nats.publish(NATS_TOPICS.SENSYNC_CONSENT_GRANTED, {
      ...record,
    } as unknown as Record<string, unknown>);
    this.emitAudit({
      event_type: 'CONSENT_GRANTED',
      session_id: args.session_id,
      guest_id: args.guest_id,
      creator_id: args.creator_id,
      domain: args.domain ?? 'ADULT_ENTERTAINMENT',
      correlation_id: args.correlation_id,
      reason_code: 'SENSYNC_CONSENT_GRANTED',
    });

    this.metrics?.recordConsentGranted();

    this.logger.log('SenSyncService: consent granted', {
      session_id: args.session_id,
      guest_id: args.guest_id,
      scopes,
      ttl_seconds: ttl,
    });

    return record;
  }

  /**
   * Phase 5.3 — granular scope revocation.
   * Removes the named scope from every active consent row for this
   * session+guest. If no scopes remain after the operation, the row is
   * fully revoked (basis=REVOKED) and ephemeral data is cleared. Emits
   * SENSYNC_CONSENT_REVOKED on full revocation, otherwise emits an audit
   * event with reason_code=SENSYNC_CONSENT_SCOPE_REVOKED.
   */
  async revokeConsentScope(args: {
    session_id: string;
    creator_id: string;
    guest_id: string;
    scope: SenSyncConsentScope;
    correlation_id: string;
  }): Promise<void> {
    const rows = await this.prisma.senSyncConsent.findMany({
      where: {
        session_id: args.session_id,
        guest_id: args.guest_id,
        consent_revoked_at: null,
      },
    });

    if (rows.length === 0) {
      this.logger.warn('SenSyncService: scope revoke — no active consent', {
        session_id: args.session_id,
        guest_id: args.guest_id,
        scope: args.scope,
      });
      return;
    }

    const now = new Date();
    let fullyRevokedAny = false;

    for (const row of rows) {
      const current = parseScopeArray(row.consent_scopes);
      if (!current.includes(args.scope)) continue;
      const next = current.filter((s) => s !== args.scope);
      const fullyRevoked = next.length === 0;
      await this.prisma.senSyncConsent.update({
        where: { id: row.id },
        data: {
          consent_scopes: next,
          basis: (fullyRevoked
            ? 'REVOKED'
            : 'PARTIALLY_REVOKED') satisfies SenSyncConsentBasis,
          consent_revoked_at: fullyRevoked ? now : null,
          reason_code: fullyRevoked
            ? 'SENSYNC_CONSENT_REVOKED'
            : 'SENSYNC_CONSENT_SCOPE_REVOKED',
          correlation_id: args.correlation_id,
        },
      });
      if (fullyRevoked) fullyRevokedAny = true;
    }

    // Update ephemeral state.
    const state = this.sessions.get(args.session_id);
    if (state) {
      state.consent_scopes.delete(args.scope);
      if (state.consent_scopes.size === 0) {
        state.consent_granted = false;
        state.last_bpm = undefined;
        state.last_sample_at_utc = undefined;
      }
    }
    const cacheKey = `${args.session_id}:${args.guest_id}`;
    const cached = this.consentCache.get(cacheKey);
    if (cached) {
      cached.scopes.delete(args.scope);
      if (cached.scopes.size === 0) this.consentCache.delete(cacheKey);
    }

    if (fullyRevokedAny) {
      this.nats.publish(NATS_TOPICS.SENSYNC_CONSENT_REVOKED, {
        event_id: randomUUID(),
        session_id: args.session_id,
        creator_id: args.creator_id,
        guest_id: args.guest_id,
        basis: 'REVOKED',
        revoked_at_utc: now.toISOString(),
        correlation_id: args.correlation_id,
        reason_code: 'SENSYNC_CONSENT_REVOKED',
        rule_applied_id: SENSYNC_RULE_ID,
      } as unknown as Record<string, unknown>);
      this.rateLimiter?.forget(args.session_id);
      this.metrics?.recordConsentRevoked();
    }

    this.emitAudit({
      event_type: fullyRevokedAny ? 'CONSENT_REVOKED' : 'CONSENT_SCOPE_REVOKED',
      session_id: args.session_id,
      guest_id: args.guest_id,
      creator_id: args.creator_id,
      scope: args.scope,
      domain: state?.domain ?? 'ADULT_ENTERTAINMENT',
      correlation_id: args.correlation_id,
      reason_code: fullyRevokedAny
        ? 'SENSYNC_CONSENT_REVOKED'
        : 'SENSYNC_CONSENT_SCOPE_REVOKED',
    });

    this.logger.log('SenSyncService: scope revoked', {
      session_id: args.session_id,
      guest_id: args.guest_id,
      scope: args.scope,
      fully_revoked: fullyRevokedAny,
    });
  }

  /**
   * Revoke SenSync consent.
   * Stamps consent_revoked_at on all active consent rows for this session+guest.
   * Clears ephemeral BPM state.
   * Emits SENSYNC_CONSENT_REVOKED on NATS.
   */
  async revokeConsent(args: {
    session_id: string;
    creator_id: string;
    guest_id: string;
    correlation_id: string;
  }): Promise<void> {
    const now = new Date();

    await this.prisma.senSyncConsent.updateMany({
      where: {
        session_id: args.session_id,
        guest_id: args.guest_id,
        consent_revoked_at: null,
      },
      data: {
        consent_revoked_at: now,
        basis: 'REVOKED' satisfies SenSyncConsentBasis,
        consent_scopes: [],
        reason_code: 'SENSYNC_CONSENT_REVOKED',
        correlation_id: args.correlation_id,
      },
    });

    // Clear ephemeral state — Phase 5.3 ephemerality requirement: BPM and
    // last-sample timestamps are dropped immediately on revocation, even if
    // the session itself stays open.
    const state = this.sessions.get(args.session_id);
    if (state) {
      state.consent_granted = false;
      state.consent_scopes.clear();
      state.consent_expires_at_ms = undefined;
      state.last_bpm = undefined;
      state.last_sample_at_utc = undefined;
    }
    this.consentCache.delete(`${args.session_id}:${args.guest_id}`);

    this.nats.publish(NATS_TOPICS.SENSYNC_CONSENT_REVOKED, {
      event_id: randomUUID(),
      session_id: args.session_id,
      creator_id: args.creator_id,
      guest_id: args.guest_id,
      basis: 'REVOKED',
      revoked_at_utc: now.toISOString(),
      correlation_id: args.correlation_id,
      reason_code: 'SENSYNC_CONSENT_REVOKED',
      rule_applied_id: SENSYNC_RULE_ID,
    } as unknown as Record<string, unknown>);

    // Drop any in-process rate-limit/anomaly state for this session.
    this.rateLimiter?.forget(args.session_id);
    this.metrics?.recordConsentRevoked();

    this.emitAudit({
      event_type: 'CONSENT_REVOKED',
      session_id: args.session_id,
      guest_id: args.guest_id,
      creator_id: args.creator_id,
      domain: state?.domain ?? 'ADULT_ENTERTAINMENT',
      correlation_id: args.correlation_id,
      reason_code: 'SENSYNC_CONSENT_REVOKED',
    });

    this.logger.log('SenSyncService: consent revoked', {
      session_id: args.session_id,
      guest_id: args.guest_id,
    });
  }

  /**
   * Submit a raw BPM sample.
   * 1. Plausibility filter [30..220].
   * 2. Consent check.
   * 3. Normalize (BPM passthrough — extension point for future smoothing).
   * 4. Publish sensync.biometric.data to NATS for FFS scoring.
   * Returns the normalized payload or null if rejected.
   */
  submitSample(sample: SenSyncSample): Promise<SenSyncBiometricPayload | null> {
    return this._submitSample(sample);
  }

  private async _submitSample(sample: SenSyncSample): Promise<SenSyncBiometricPayload | null> {
    // Plausibility filter.
    if (sample.bpm_raw < SENSYNC_BPM_MIN || sample.bpm_raw > SENSYNC_BPM_MAX) {
      this.rejectSample(sample);
      return null;
    }

    const state = this.sessions.get(sample.session_id);
    if (!state) {
      this.logger.warn('SenSyncService: no active session', { session_id: sample.session_id });
      this.metrics?.recordSampleRejected('NO_SESSION');
      return null;
    }

    // Rate-limit & anomaly gate (Phase 2.8).
    if (this.rateLimiter) {
      const decision = this.rateLimiter.admit(sample.session_id, sample.bpm_raw);
      if (!decision.allowed) {
        this.logger.warn('SenSyncService: sample rejected by rate-limit', {
          session_id: sample.session_id,
          reason_code: decision.reason_code,
          observed_rate: decision.observed_rate,
          observed_delta: decision.observed_delta,
        });
        if (decision.reason_code) {
          this.metrics?.recordSampleRejected(decision.reason_code);
          this.metrics?.recordRateLimitTrip(decision.reason_code);
        }
        return null;
      }
    }

    // Phase 5.3 — scope-aware consent gate. Resolve scopes from cache, falling
    // back to DB; enforce TTL; and refuse samples with an empty scope set.
    const consentKey = `${sample.session_id}:${sample.guest_id}`;
    let cached = this.consentCache.get(consentKey);
    if (!cached) {
      const dbConsent = await this.prisma.senSyncConsent.findFirst({
        where: {
          session_id: sample.session_id,
          guest_id: sample.guest_id,
          consent_revoked_at: null,
          purge_requested_at: null,
        },
      });
      if (dbConsent) {
        cached = {
          scopes: new Set(parseScopeArray(dbConsent.consent_scopes)),
          expires_at_ms: dbConsent.consent_expires_at?.getTime() ?? null,
        };
        this.consentCache.set(consentKey, cached);
      }
    }
    if (!cached || cached.scopes.size === 0) {
      this.logger.warn('SenSyncService: sample rejected — no consent', {
        session_id: sample.session_id,
        guest_id: sample.guest_id,
      });
      this.metrics?.recordSampleRejected('NO_CONSENT');
      return null;
    }
    // Phase 5.3 — TTL / ephemerality gate.
    if (cached.expires_at_ms !== null && Date.now() >= cached.expires_at_ms) {
      this.logger.warn('SenSyncService: sample rejected — consent expired', {
        session_id: sample.session_id,
        guest_id: sample.guest_id,
      });
      this.metrics?.recordSampleRejected('NO_CONSENT');
      this.consentCache.delete(consentKey);
      // Mirror state.
      state.consent_granted = false;
      state.consent_scopes.clear();
      this.emitAudit({
        event_type: 'CONSENT_EXPIRED',
        session_id: sample.session_id,
        guest_id: sample.guest_id,
        creator_id: sample.creator_id,
        domain: sample.domain,
        correlation_id: `sensync-expiry-${sample.session_id}`,
        reason_code: 'SENSYNC_CONSENT_EXPIRED',
      });
      return null;
    }

    const valid: SenSyncValidSample = {
      ...sample,
      bpm_normalized: sample.bpm_raw, // Extension point: smoothing/filtering here.
    };

    // Update ephemeral state.
    state.last_bpm = valid.bpm_normalized;
    state.last_sample_at_utc = new Date().toISOString();

    // Phase 3 — derive quality_boost_points (10..25) from adapter quality.
    const quality_score = this.deriveQualityScore(sample.bridge);
    const quality_boost_points = Math.round(
      SENSYNC_FFS_BOOST_MIN +
        (SENSYNC_FFS_BOOST_MAX - SENSYNC_FFS_BOOST_MIN) * quality_score,
    );

    const activeScopes = Array.from(cached.scopes) as SenSyncConsentScope[];

    const payload: SenSyncBiometricPayload = {
      event_id: randomUUID(),
      session_id: valid.session_id,
      creator_id: valid.creator_id,
      guest_id: valid.guest_id,
      bpm_normalized: valid.bpm_normalized,
      bridge: valid.bridge,
      domain: valid.domain,
      consent_version: SENSYNC_CONSENT_VERSION,
      consent_scopes: activeScopes,
      quality_score,
      quality_boost_points,
      emitted_at_utc: state.last_sample_at_utc,
      rule_applied_id: SENSYNC_RULE_ID,
    };

    // Canonical payload — every consumer.
    this.nats.publish(NATS_TOPICS.SENSYNC_BIOMETRIC_DATA, {
      ...payload,
    } as unknown as Record<string, unknown>);

    // Phase 3 — FFS-shaped narrow payload. ONLY published when BPM_TO_FFS scope
    // is active. FFS subscribes to SENSYNC_BPM_UPDATE and folds the BPM into
    // its score input frame; without this scope the BPM stays out of FFS.
    if (cached.scopes.has('BPM_TO_FFS')) {
      const ffsPayload: SenSyncBpmUpdatePayload = {
        session_id: valid.session_id,
        creator_id: valid.creator_id,
        guest_id: valid.guest_id,
        bpm: valid.bpm_normalized,
        bridge: valid.bridge,
        consent_version: SENSYNC_CONSENT_VERSION,
        emitted_at_utc: state.last_sample_at_utc,
        rule_applied_id: SENSYNC_RULE_ID,
      };
      this.nats.publish(NATS_TOPICS.SENSYNC_BPM_UPDATE, {
        ...ffsPayload,
        // FFS service reads quality_boost_points to apply the +10..25 bonus.
        quality_boost_points,
      } as unknown as Record<string, unknown>);
    }

    this.metrics?.recordSampleAdmitted(sample.bridge);
    this.metrics?.recordSampleByDomain(sample.domain);

    return payload;
  }

  /**
   * Phase 3 — derive the FFS quality boost in [0,1] from the adapter health
   * snapshot. Falls back to 0.5 (mid-band) when no health data is available
   * (e.g. PHONE_HAPTIC fallback or adapter registry not wired).
   */
  private deriveQualityScore(bridge: SenSyncHardwareBridge): number {
    if (!this.hardware) return 0.5;
    try {
      const adapter = this.hardware.resolve(bridge);
      const health = adapter.getHealthSnapshot();
      // Clamp to [0,1] in case of NaN from a no-sample window.
      const q = Number.isFinite(health.sample_quality_1m)
        ? Math.min(1, Math.max(0, health.sample_quality_1m))
        : 0.5;
      return q;
    } catch {
      return 0.5;
    }
  }

  /**
   * Close a SenSync session — purges all ephemeral state.
   */
  closeSession(session_id: string): void {
    const state = this.sessions.get(session_id);
    if (state) {
      // Remove consent cache entries for this session.
      this.consentCache.delete(`${session_id}:${state.guest_id}`);
      if (this.hardware) {
        const adapter = this.hardware.resolve(state.bridge);
        void adapter.close(session_id).catch((err: unknown) => {
          this.logger.warn('SenSyncService: hardware adapter close failed', {
            session_id,
            error: String(err),
          });
        });
      }
    }
    this.sessions.delete(session_id);
    this.rateLimiter?.forget(session_id);
    this.logger.log('SenSyncService: session closed', { session_id });
  }

  /**
   * Return current ephemeral session state.
   */
  getSessionState(session_id: string): SenSyncSessionState | undefined {
    return this.sessions.get(session_id);
  }

  /**
   * Record a hardware lifecycle event (connected/disconnected).
   * Emits SENSYNC_HARDWARE_CONNECTED or SENSYNC_HARDWARE_DISCONNECTED on NATS.
   */
  recordHardwareEvent(args: {
    session_id: string;
    creator_id: string;
    guest_id: string;
    bridge: SenSyncHardwareBridge;
    event_type: 'CONNECTED' | 'DISCONNECTED';
  }): void {
    const event: SenSyncHardwareEvent = {
      event_id: randomUUID(),
      session_id: args.session_id,
      creator_id: args.creator_id,
      guest_id: args.guest_id,
      bridge: args.bridge,
      event_type: args.event_type,
      occurred_at_utc: new Date().toISOString(),
      rule_applied_id: SENSYNC_RULE_ID,
    };

    const topic =
      args.event_type === 'CONNECTED'
        ? NATS_TOPICS.SENSYNC_HARDWARE_CONNECTED
        : NATS_TOPICS.SENSYNC_HARDWARE_DISCONNECTED;

    this.nats.publish(topic, { ...event } as unknown as Record<string, unknown>);

    if (args.event_type === 'CONNECTED') this.metrics?.recordHardwareConnected(args.bridge);
    else this.metrics?.recordHardwareDisconnected(args.bridge);
  }

  /**
   * Request a Law 25 / GDPR Art. 17 data purge for a guest.
   * Stamps purge_requested_at on all consent rows for the guest.
   * Emits SENSYNC_PURGE_REQUESTED on NATS.
   * Actual deletion of sensitive fields is completed asynchronously by a
   * scheduled purge job that listens on SENSYNC_PURGE_REQUESTED.
   */
  async requestPurge(args: {
    guest_id: string;
    requested_by: string;
    correlation_id: string;
    reason_code: string;
  }): Promise<SenSyncPurgeRequest> {
    const now = new Date();
    const purge_id = randomUUID();

    await this.prisma.senSyncConsent.updateMany({
      where: {
        guest_id: args.guest_id,
        purge_requested_at: null,
      },
      data: {
        purge_requested_at: now,
        reason_code: args.reason_code,
      },
    });

    const purgeRequest: SenSyncPurgeRequest = {
      purge_id,
      guest_id: args.guest_id,
      requested_by: args.requested_by,
      requested_at_utc: now.toISOString(),
      correlation_id: args.correlation_id,
      reason_code: args.reason_code,
      rule_applied_id: SENSYNC_RULE_ID,
    };

    this.nats.publish(NATS_TOPICS.SENSYNC_PURGE_REQUESTED, {
      ...purgeRequest,
    } as unknown as Record<string, unknown>);
    this.emitAudit({
      event_type: 'PURGE_REQUESTED',
      guest_id: args.guest_id,
      domain: 'ADULT_ENTERTAINMENT',
      correlation_id: args.correlation_id,
      reason_code: args.reason_code,
    });

    this.metrics?.recordPurgeRequested();

    this.logger.log('SenSyncService: purge requested', {
      guest_id: args.guest_id,
      purge_id,
    });

    return purgeRequest;
  }

  /**
   * Complete a purge — called by the async purge job after data minimization.
   * Stamps purge_completed_at and nullifies sensitive fields (ip_hash,
   * device_fingerprint) on all pending purge rows for the guest.
   * Emits SENSYNC_PURGE_COMPLETED on NATS.
   */
  async completePurge(args: {
    purge_id: string;
    guest_id: string;
    correlation_id: string;
  }): Promise<SenSyncPurgeCompleted> {
    const now = new Date();

    const result = await this.prisma.senSyncConsent.updateMany({
      where: {
        guest_id: args.guest_id,
        purge_requested_at: { not: null },
        purge_completed_at: null,
      },
      data: {
        purge_completed_at: now,
        ip_hash: null,
        device_fingerprint: null,
        reason_code: 'SENSYNC_PURGE_COMPLETED',
      },
    });

    const purgeCompleted: SenSyncPurgeCompleted = {
      purge_id: args.purge_id,
      guest_id: args.guest_id,
      rows_affected: result.count,
      completed_at_utc: now.toISOString(),
      rule_applied_id: SENSYNC_RULE_ID,
    };

    this.nats.publish(NATS_TOPICS.SENSYNC_PURGE_COMPLETED, {
      ...purgeCompleted,
    } as unknown as Record<string, unknown>);
    this.emitAudit({
      event_type: 'PURGE_COMPLETED',
      guest_id: args.guest_id,
      domain: 'ADULT_ENTERTAINMENT',
      correlation_id: args.correlation_id,
      reason_code: 'SENSYNC_PURGE_COMPLETED',
    });

    this.metrics?.recordPurgeCompleted();

    this.logger.log('SenSyncService: purge completed', {
      guest_id: args.guest_id,
      rows_affected: result.count,
    });

    return purgeCompleted;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private isTierEligible(tier: MembershipTier): boolean {
    return (SENSYNC_HARDWARE_TIERS as readonly string[]).includes(tier);
  }

  private rejectSample(sample: SenSyncSample): void {
    const rejection: SenSyncPlausibilityRejection = {
      rejection_id: randomUUID(),
      session_id: sample.session_id,
      guest_id: sample.guest_id,
      bpm_raw: sample.bpm_raw,
      reason_code: sample.bpm_raw < SENSYNC_BPM_MIN ? 'BPM_BELOW_MIN' : 'BPM_ABOVE_MAX',
      rejected_at_utc: new Date().toISOString(),
      rule_applied_id: SENSYNC_RULE_ID,
    };

    this.nats.publish(NATS_TOPICS.SENSYNC_PLAUSIBILITY_REJECTED, {
      ...rejection,
    } as unknown as Record<string, unknown>);

    this.metrics?.recordSampleRejected(rejection.reason_code);

    this.logger.warn('SenSyncService: plausibility rejection', rejection);
  }

  private emitTierDisabled(
    session_id: string,
    guest_id: string,
    tier: MembershipTier,
  ): void {
    const event: SenSyncTierDisabledEvent = {
      event_id: randomUUID(),
      session_id,
      guest_id,
      tier,
      reason_code: 'TIER_SENSYNC_HARDWARE_DISABLED',
      occurred_at_utc: new Date().toISOString(),
      rule_applied_id: SENSYNC_RULE_ID,
    };

    this.nats.publish(NATS_TOPICS.SENSYNC_TIER_DISABLED, {
      ...event,
    } as unknown as Record<string, unknown>);
  }

  /**
   * Phase 5.3 — emit an immutable audit event onto NATS for the platform
   * audit pipeline. Best-effort; never throws.
   */
  private emitAudit(args: Omit<SenSyncAuditEvent, 'audit_id' | 'occurred_at_utc' | 'rule_applied_id'>): void {
    try {
      const event: SenSyncAuditEvent = {
        audit_id: randomUUID(),
        occurred_at_utc: new Date().toISOString(),
        rule_applied_id: SENSYNC_RULE_ID,
        ...args,
      };
      this.nats.publish(
        NATS_TOPICS.SENSYNC_BIOMETRIC_DATA, // canonical bus; audit consumers filter on event_type
        { ...event, _kind: 'SENSYNC_AUDIT' } as unknown as Record<string, unknown>,
      );
    } catch (err) {
      this.logger.warn('SenSyncService: audit emit failed', { error: String(err) });
    }
  }

  /**
   * Bridge every adapter's sample/event streams into the service:
   *   • samples are routed through the consent + plausibility + rate-limit
   *     gate via `submitSample()`,
   *   • lifecycle events are translated into NATS hardware events and
   *     adapter-quality metrics.
   * Called once on module init.
   */
  private bindHardwareAdapters(): void {
    if (!this.hardware) return;
    for (const adapter of this.hardware.all()) {
      adapter.onSample((sample) => {
        void this._submitSample(sample);
      });
      adapter.onEvent((event) => {
        const state = this.sessions.get(event.session_id);
        if (!state) return;
        if (event.event_type === 'CONNECTED' || event.event_type === 'DISCONNECTED') {
          this.recordHardwareEvent({
            session_id: event.session_id,
            creator_id: state.creator_id,
            guest_id: state.guest_id,
            bridge: event.bridge,
            event_type: event.event_type,
          });
        } else if (event.event_type === 'RECONNECT_ATTEMPT') {
          this.metrics?.recordReconnectAttempt(event.bridge);
        }
        // Refresh the adapter's latency EWMA into metrics.
        const health = adapter.getHealthSnapshot();
        this.metrics?.setLatencyEwma(event.bridge, health.latency_ms_ewma);
      });
    }
  }
}

/**
 * Coerce a TTL hint into the [MIN..MAX] window. Falls back to the default when
 * the hint is undefined / NaN.
 */
function clampTtlSeconds(hint: number | undefined): number {
  if (typeof hint !== 'number' || !Number.isFinite(hint)) {
    return SENSYNC_DEFAULT_CONSENT_TTL_SECONDS;
  }
  return Math.max(
    SENSYNC_MIN_CONSENT_TTL_SECONDS,
    Math.min(SENSYNC_MAX_CONSENT_TTL_SECONDS, Math.round(hint)),
  );
}

/**
 * Parse a Prisma Json column into a SenSyncConsentScope[] safely. Returns the
 * default scope set when the value is malformed or empty.
 */
function parseScopeArray(raw: unknown): SenSyncConsentScope[] {
  const KNOWN: ReadonlyArray<SenSyncConsentScope> = [
    'BPM_TO_FFS',
    'BPM_TO_HAPTIC',
    'BPM_TO_CYRANO',
    'BPM_TO_PARTNER',
  ];
  if (!Array.isArray(raw)) return [];
  const filtered = raw.filter(
    (s): s is SenSyncConsentScope => typeof s === 'string' && (KNOWN as readonly string[]).includes(s),
  );
  return filtered;
}
