// PAYLOAD 2 — Notification Engine
// Purpose: 48-hour expiry warnings, high-balance personal-touch triggers,
// and Human Contact Zone hand-off stubs. Suppression-aware: every dispatch
// (sent OR suppressed) emits an audit row with a correlation_id. Execution
// of the actual email/SMS belongs to a downstream Twilio/SendGrid adapter;
// this service produces the dispatch intent + audit trail only.

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

export const NOTIFICATION_RULE_ID = 'NOTIFICATION_ENGINE_v1';

export type NotificationChannel = 'EMAIL' | 'SMS' | 'PUSH' | 'HUMAN_CONTACT_ZONE';

export type NotificationTemplate =
  | 'EXPIRY_WARNING_48H'
  | 'HIGH_BALANCE_PERSONAL_TOUCH'
  | 'RECOVERY_PLAYBOOK_HANDOFF'
  | 'TOKEN_BRIDGE_OFFER'
  | 'THREE_FIFTHS_EXIT_CONFIRMATION'
  | 'EXPIRATION_PROCESSED'
  // ── RBAC-STUDIO-001: Studio onboarding ─────────────────────────────────
  | 'STUDIO_AFFILIATION_NUMBER_ASSIGNED'
  | 'STUDIO_CONTRACT_READY_FOR_SIGNATURE'
  | 'STUDIO_ACTIVATION_CONFIRMED';

export type SuppressionReason =
  | 'NONE'
  | 'NOT_OPTED_IN'
  | 'DUPLICATE_WITHIN_TTL'
  | 'CHANNEL_DISABLED'
  | 'QUIET_HOURS';

export interface NotificationRequest {
  user_id: string;
  channel: NotificationChannel;
  template: NotificationTemplate;
  payload: Record<string, unknown>;
  correlation_id?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationDispatchResult {
  dispatch_id: string;
  user_id: string;
  channel: NotificationChannel;
  template: NotificationTemplate;
  dispatched: boolean;
  suppression_reason: SuppressionReason;
  correlation_id: string;
  at_utc: string;
  rule_applied_id: string;
}

export interface ConsentResolver {
  isOptedIn(user_id: string, channel: NotificationChannel): Promise<boolean>;
}

export interface DispatchAdapter {
  deliver(
    channel: NotificationChannel,
    user_id: string,
    template: NotificationTemplate,
    payload: Record<string, unknown>,
  ): Promise<void>;
}

/** Default consent resolver — opts users in for all channels except HCZ. */
export const DEFAULT_CONSENT_RESOLVER: ConsentResolver = {
  async isOptedIn(_user_id: string, channel: NotificationChannel) {
    return channel !== 'HUMAN_CONTACT_ZONE'; // HCZ requires explicit routing.
  },
};

@Injectable()
export class NotificationEngine {
  private readonly logger = new Logger(NotificationEngine.name);
  private readonly RULE_ID = NOTIFICATION_RULE_ID;
  private readonly DEDUP_TTL_MS = 5 * 60 * 1000;

  // Keyed by `${user_id}|${channel}|${template}|${dedup_key}` → first send time
  private readonly dedupStore = new Map<string, number>();

  // Append-only audit log — in-memory; wire to audit_events table in core-api.
  private readonly auditLog: NotificationDispatchResult[] = [];

  constructor(
    private readonly consent: ConsentResolver = DEFAULT_CONSENT_RESOLVER,
    private readonly adapter?: DispatchAdapter,
  ) {}

  async send(request: NotificationRequest): Promise<NotificationDispatchResult> {
    const correlation_id = request.correlation_id ?? `corr_${randomUUID()}`;
    const dispatch_id = `dsp_${randomUUID()}`;
    const at_utc = new Date().toISOString();

    // 1. Consent gate.
    const optedIn = await this.consent.isOptedIn(request.user_id, request.channel);
    if (!optedIn) {
      return this.record({
        dispatch_id,
        user_id: request.user_id,
        channel: request.channel,
        template: request.template,
        dispatched: false,
        suppression_reason: 'NOT_OPTED_IN',
        correlation_id,
        at_utc,
        rule_applied_id: this.RULE_ID,
      });
    }

    // 2. Dedup window.
    const dedupKey = this.dedupKey(request);
    const now = Date.now();
    const prior = this.dedupStore.get(dedupKey);
    if (prior && now - prior < this.DEDUP_TTL_MS) {
      return this.record({
        dispatch_id,
        user_id: request.user_id,
        channel: request.channel,
        template: request.template,
        dispatched: false,
        suppression_reason: 'DUPLICATE_WITHIN_TTL',
        correlation_id,
        at_utc,
        rule_applied_id: this.RULE_ID,
      });
    }
    this.dedupStore.set(dedupKey, now);

    // 3. Deliver (adapter-optional — stubs log only).
    if (this.adapter) {
      await this.adapter.deliver(
        request.channel,
        request.user_id,
        request.template,
        request.payload,
      );
    }

    this.logger.log('NotificationEngine: dispatched', {
      dispatch_id,
      user_id: request.user_id,
      channel: request.channel,
      template: request.template,
      correlation_id,
      rule_applied_id: this.RULE_ID,
    });

    return this.record({
      dispatch_id,
      user_id: request.user_id,
      channel: request.channel,
      template: request.template,
      dispatched: true,
      suppression_reason: 'NONE',
      correlation_id,
      at_utc,
      rule_applied_id: this.RULE_ID,
    });
  }

  /** Convenience: 48-hour expiry warning (email + SMS default). */
  async send48hExpiryWarning(params: {
    user_id: string;
    wallet_id: string;
    remaining_balance_tokens: bigint;
    expires_at_utc: string;
    correlation_id?: string;
  }): Promise<NotificationDispatchResult[]> {
    const payload = {
      wallet_id: params.wallet_id,
      remaining_balance_tokens: params.remaining_balance_tokens.toString(),
      expires_at_utc: params.expires_at_utc,
    };
    const email = await this.send({
      user_id: params.user_id,
      channel: 'EMAIL',
      template: 'EXPIRY_WARNING_48H',
      payload,
      correlation_id: params.correlation_id,
    });
    const sms = await this.send({
      user_id: params.user_id,
      channel: 'SMS',
      template: 'EXPIRY_WARNING_48H',
      payload,
      correlation_id: params.correlation_id,
    });
    return [email, sms];
  }

  /** Convenience: high-balance personal-touch hand-off to HCZ agents. */
  async triggerPersonalTouch(params: {
    user_id: string;
    wallet_id: string;
    balance_usd_cents: bigint;
    correlation_id?: string;
  }): Promise<NotificationDispatchResult> {
    return this.send({
      user_id: params.user_id,
      channel: 'HUMAN_CONTACT_ZONE',
      template: 'HIGH_BALANCE_PERSONAL_TOUCH',
      payload: {
        wallet_id: params.wallet_id,
        balance_usd_cents: params.balance_usd_cents.toString(),
      },
      correlation_id: params.correlation_id,
      metadata: {
        priority: 'HIGH',
        hand_off_playbook: 'REDBOOK_HIGH_BALANCE_OUTREACH',
      },
    });
  }

  /** Read-only audit tail — caller should apply their own pagination. */
  getAuditTail(limit = 100): NotificationDispatchResult[] {
    return this.auditLog.slice(-limit);
  }

  private dedupKey(request: NotificationRequest): string {
    const extra =
      request.metadata && typeof request.metadata.dedup_key === 'string'
        ? request.metadata.dedup_key
        : '';
    return `${request.user_id}|${request.channel}|${request.template}|${extra}`;
  }

  private record(result: NotificationDispatchResult): NotificationDispatchResult {
    this.auditLog.push(result);
    return result;
  }
}
