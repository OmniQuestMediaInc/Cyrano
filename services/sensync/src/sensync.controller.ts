// HZ: SenSync™ REST controller — session lifecycle, consent, samples, purge
import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Optional,
  Param,
  Post,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SenSyncService } from './sensync.service';
import { SenSyncMetrics, type SenSyncMetricsSnapshot } from './sensync.metrics';
import { HardwareAdapterRegistry } from './adapters/hardware-adapter.registry';
import {
  isRendererBridgeAdapter,
  type SenSyncAdapterHealth,
} from './adapters/hardware-adapter.types';
import type {
  MembershipTier,
  SenSyncBiometricPayload,
  SenSyncConsentRecord,
  SenSyncConsentScope,
  SenSyncDomain,
  SenSyncHardwareBridge,
  SenSyncPurgeRequest,
  SenSyncSample,
  SenSyncSessionState,
} from './sensync.types';

// ── REST DTOs ─────────────────────────────────────────────────────────────────

export interface OpenSessionDto {
  session_id: string;
  creator_id: string;
  guest_id: string;
  tier: MembershipTier;
  bridge: SenSyncHardwareBridge;
  domain?: SenSyncDomain;
  /** Vendor short-code (e.g. Lovense Connect token). */
  vendor_token?: string;
  /** WebUSB / WebBluetooth device identifier supplied by the renderer. */
  device_id?: string;
}

export interface GrantConsentDto {
  session_id: string;
  creator_id: string;
  guest_id: string;
  domain?: SenSyncDomain;
  ip_hash?: string;
  device_fingerprint?: string;
  correlation_id: string;
  /** Phase 5.3 — granular scopes; defaults to all scopes when omitted. */
  scopes?: SenSyncConsentScope[];
  /** Phase 5.3 — TTL hint in seconds (server-side default applies when omitted). */
  ttl_seconds?: number;
}

export interface RevokeConsentDto {
  session_id: string;
  creator_id: string;
  guest_id: string;
  correlation_id: string;
  /** Phase 5.3 — when supplied, only the named scope is revoked. */
  scope?: SenSyncConsentScope;
}

export interface SubmitSampleDto {
  session_id: string;
  creator_id: string;
  guest_id: string;
  bridge: SenSyncHardwareBridge;
  bpm_raw: number;
  tier: MembershipTier;
  domain?: SenSyncDomain;
}

export interface HardwareEventDto {
  session_id: string;
  creator_id: string;
  guest_id: string;
  bridge: SenSyncHardwareBridge;
  event_type: 'CONNECTED' | 'DISCONNECTED';
}

export interface PurgeRequestDto {
  guest_id: string;
  requested_by: string;
  correlation_id: string;
  reason_code: string;
}

export interface PurgeCompleteDto {
  purge_id: string;
  guest_id: string;
  correlation_id: string;
}

/** Phase 1 — renderer-shim BPM frame body (WebUSB / WebBluetooth). */
export interface RendererFrameDto {
  session_id: string;
  bridge: 'WEB_USB' | 'WEB_BLUETOOTH';
  bpm: number;
  captured_device_ms: number;
}

/** Phase 1 — renderer-shim disconnect notification body. */
export interface RendererDisconnectDto {
  session_id: string;
  bridge: 'WEB_USB' | 'WEB_BLUETOOTH';
  reason: string;
}

// ── Controller ────────────────────────────────────────────────────────────────

@Controller('sensync')
export class SenSyncController {
  private readonly logger = new Logger(SenSyncController.name);

  constructor(
    private readonly senSync: SenSyncService,
    @Optional() private readonly metrics?: SenSyncMetrics,
    @Optional() private readonly adapters?: HardwareAdapterRegistry,
  ) {}

  /** GET /sensync/metrics — JSON snapshot for the platform Prometheus exporter. */
  @Get('metrics')
  getMetrics(): SenSyncMetricsSnapshot | { error: string } {
    if (!this.metrics) return { error: 'METRICS_DISABLED' };
    return this.metrics.snapshot();
  }

  /** GET /sensync/hardware/health — per-adapter quality snapshot. */
  @Get('hardware/health')
  getHardwareHealth(): SenSyncAdapterHealth[] | { error: string } {
    if (!this.adapters) return { error: 'HARDWARE_REGISTRY_DISABLED' };
    return this.adapters.all().map((a) => a.getHealthSnapshot());
  }

  /**
   * GET /sensync/healthz
   * Phase 4 — aggregate readiness for Kubernetes / load-balancer probes.
   * Returns 200 with `ok:true` when every wired adapter has a positive
   * sample_quality_1m or no samples have been seen yet (cold start), and
   * the rate-limiter / metrics services are reachable.
   */
  @Get('healthz')
  healthz(): {
    ok: boolean;
    adapters?: SenSyncAdapterHealth[];
    metrics?: 'enabled' | 'disabled';
    reason_code: string;
  } {
    const adapters = this.adapters?.all().map((a) => a.getHealthSnapshot()) ?? [];
    const ok = adapters.every((h) => h.sample_quality_1m >= 0.5 || h.sample_quality_1m === 1);
    return {
      ok,
      adapters,
      metrics: this.metrics ? 'enabled' : 'disabled',
      reason_code: ok ? 'SENSYNC_HEALTHY' : 'SENSYNC_DEGRADED',
    };
  }

  /**
   * POST /sensync/hardware/frame
   * Phase 1 — browser shim ingest. The renderer (Chrome WebUSB / WebBluetooth)
   * decodes the device descriptor and POSTs a normalised BPM frame.
   * The service routes the frame into the correct adapter, which surfaces it
   * to SenSyncService via its sample callback (consent + plausibility +
   * rate-limit gates apply downstream — never bypassed here).
   */
  @Post('hardware/frame')
  ingestRendererFrame(@Body() dto: RendererFrameDto): { ok: true } | { error: string } {
    if (!this.adapters) return { error: 'HARDWARE_REGISTRY_DISABLED' };
    const adapter = this.adapters.resolve(dto.bridge);
    if (!isRendererBridgeAdapter(adapter)) {
      return { error: 'BRIDGE_NOT_RENDERER_BACKED' };
    }
    adapter.ingestRendererFrame({
      session_id: dto.session_id,
      bpm: dto.bpm,
      captured_device_ms: dto.captured_device_ms,
    });
    return { ok: true };
  }

  /**
   * POST /sensync/hardware/disconnect
   * Phase 1 — browser shim disconnect notification. Triggers the adapter's
   * reconnect lifecycle (RECONNECT_ATTEMPT then RECONNECT_FAILED on exhaust).
   */
  @Post('hardware/disconnect')
  notifyRendererDisconnect(
    @Body() dto: RendererDisconnectDto,
  ): { ok: true } | { error: string } {
    if (!this.adapters) return { error: 'HARDWARE_REGISTRY_DISABLED' };
    const adapter = this.adapters.resolve(dto.bridge);
    if (!isRendererBridgeAdapter(adapter)) {
      return { error: 'BRIDGE_NOT_RENDERER_BACKED' };
    }
    adapter.notifyRendererDisconnect({
      session_id: dto.session_id,
      reason: dto.reason,
    });
    return { ok: true };
  }

  /** POST /sensync/sessions */
  @Post('sessions')
  openSession(@Body() dto: OpenSessionDto): SenSyncSessionState | { error: string } {
    const state = this.senSync.openSession(
      dto.session_id,
      dto.creator_id,
      dto.guest_id,
      dto.tier,
      dto.bridge,
      dto.domain,
      dto.vendor_token,
      dto.device_id,
    );
    if (!state) {
      return { error: 'SENSYNC_TIER_HARDWARE_DISABLED' };
    }
    return state;
  }

  /** POST /sensync/consent/grant */
  @Post('consent/grant')
  async grantConsent(@Body() dto: GrantConsentDto): Promise<SenSyncConsentRecord> {
    return this.senSync.grantConsent({
      session_id: dto.session_id,
      creator_id: dto.creator_id,
      guest_id: dto.guest_id,
      domain: dto.domain,
      ip_hash: dto.ip_hash,
      device_fingerprint: dto.device_fingerprint,
      correlation_id: dto.correlation_id,
      scopes: dto.scopes,
      ttl_seconds: dto.ttl_seconds,
    });
  }

  /**
   * POST /sensync/consent/revoke
   * If `scope` is provided, only that scope is removed (granular revocation).
   * Otherwise the entire consent row is revoked.
   */
  @Post('consent/revoke')
  async revokeConsent(@Body() dto: RevokeConsentDto): Promise<{ ok: true }> {
    if (dto.scope) {
      await this.senSync.revokeConsentScope({
        session_id: dto.session_id,
        creator_id: dto.creator_id,
        guest_id: dto.guest_id,
        scope: dto.scope,
        correlation_id: dto.correlation_id,
      });
    } else {
      await this.senSync.revokeConsent({
        session_id: dto.session_id,
        creator_id: dto.creator_id,
        guest_id: dto.guest_id,
        correlation_id: dto.correlation_id,
      });
    }
    return { ok: true };
  }

  /** POST /sensync/samples */
  @Post('samples')
  async submitSample(
    @Body() dto: SubmitSampleDto,
  ): Promise<SenSyncBiometricPayload | { ok: false; reason: string }> {
    const sample: SenSyncSample = {
      sample_id: randomUUID(),
      session_id: dto.session_id,
      creator_id: dto.creator_id,
      guest_id: dto.guest_id,
      bridge: dto.bridge,
      bpm_raw: dto.bpm_raw,
      captured_device_ms: Date.now(),
      received_at_utc: new Date().toISOString(),
      tier: dto.tier,
      domain: dto.domain ?? 'ADULT_ENTERTAINMENT',
    };

    const result = await this.senSync.submitSample(sample);
    if (!result) {
      return { ok: false, reason: 'SAMPLE_REJECTED_OR_NO_CONSENT' };
    }
    return result;
  }

  /** DELETE /sensync/sessions/:session_id */
  @Delete('sessions/:session_id')
  closeSession(@Param('session_id') session_id: string): { ok: true } {
    this.senSync.closeSession(session_id);
    return { ok: true };
  }

  /** GET /sensync/sessions/:session_id */
  @Get('sessions/:session_id')
  getSession(
    @Param('session_id') session_id: string,
  ): SenSyncSessionState | { error: string } {
    const state = this.senSync.getSessionState(session_id);
    if (!state) return { error: 'SESSION_NOT_FOUND' };
    return state;
  }

  /** POST /sensync/hardware-events */
  @Post('hardware-events')
  recordHardwareEvent(@Body() dto: HardwareEventDto): { ok: true } {
    this.senSync.recordHardwareEvent({
      session_id: dto.session_id,
      creator_id: dto.creator_id,
      guest_id: dto.guest_id,
      bridge: dto.bridge,
      event_type: dto.event_type,
    });
    return { ok: true };
  }

  /**
   * POST /sensync/purge/request
   * Law 25 §28 / GDPR Art. 17 deletion request.
   * Must be called by an authenticated operator acting on guest's behalf.
   */
  @Post('purge/request')
  async requestPurge(@Body() dto: PurgeRequestDto): Promise<SenSyncPurgeRequest> {
    return this.senSync.requestPurge({
      guest_id: dto.guest_id,
      requested_by: dto.requested_by,
      correlation_id: dto.correlation_id,
      reason_code: dto.reason_code,
    });
  }

  /**
   * POST /sensync/purge/complete
   * Called by the async purge job after sensitive-field nullification.
   */
  @Post('purge/complete')
  async completePurge(@Body() dto: PurgeCompleteDto) {
    return this.senSync.completePurge({
      purge_id: dto.purge_id,
      guest_id: dto.guest_id,
      correlation_id: dto.correlation_id,
    });
  }
}
