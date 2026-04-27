// WO: WO-038
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GovernanceConfigService } from '../config/governance.config';

/**
 * WO-038: Consent-Aware Notification Service — GuardedNotificationService
 *
 * Doctrine:
 *  - Before emitting ANY notification, verify is_opted_in in
 *    notification_consent_store for the target user + channel.
 *  - Every outbound message (sent OR suppressed) is logged to the
 *    audit_events chain with template_id and consent_basis_id.
 *  - All timestamps embed America/Toronto as platform_time.
 */

export type NotificationChannel = 'Email' | 'SMS' | 'Push';

export interface NotificationRequest {
  userId: string;
  channel: NotificationChannel;
  templateId: string;
  consentBasisId: string;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface NotificationResult {
  dispatched: boolean;
  suppressionReason?: string;
  auditEventId: string;
  platformTime: string;
}

@Injectable()
export class GuardedNotificationService {
  private readonly logger = new Logger(GuardedNotificationService.name);

  constructor(
    @InjectRepository('notification_consent_store' as never)
    private readonly consentRepo: Repository<Record<string, unknown>>,
    @InjectRepository('audit_events' as never)
    private readonly auditRepo: Repository<Record<string, unknown>>,
    private readonly config: GovernanceConfigService,
  ) {}

  /**
   * Emits a notification only when the user has opted in for the given channel.
   * Regardless of consent outcome, appends an immutable audit_events row with
   * template_id and consent_basis_id (WO-038 §audit).
   */
  async send(request: NotificationRequest): Promise<NotificationResult> {
    const platformTime = this.getPlatformTime();

    // 1. Consent gate: look up the user's opt-in status.
    const consentRecord = (await this.consentRepo.findOne({
      where: { user_id: request.userId, channel: request.channel },
    })) as Record<string, unknown> | null;

    const isOptedIn = consentRecord ? Boolean(consentRecord['is_opted_in']) : false;

    // 2. Audit every attempt — sent or suppressed.
    const eventType = isOptedIn ? 'NOTIFICATION_SENT' : 'NOTIFICATION_SUPPRESSED';
    const auditEntry = this.auditRepo.create({
      event_type: eventType,
      actor_id: request.userId,
      purpose_code: request.channel,
      outcome: isOptedIn ? 'DISPATCHED' : 'SUPPRESSED_NO_CONSENT',
      template_id: request.templateId,
      consent_basis_id: request.consentBasisId,
      metadata: {
        ...(request.metadata ?? {}),
        channel: request.channel,
        platform_time: platformTime,
        governance_timezone: this.config.TIMEZONE,
      },
    });
    const savedAudit = (await this.auditRepo.save(auditEntry)) as Record<string, unknown>;

    if (!isOptedIn) {
      this.logger.warn('NOTIFICATION_SUPPRESSED: user has not opted in', {
        userId: request.userId,
        channel: request.channel,
        templateId: request.templateId,
        auditEventId: savedAudit['event_id'],
      });
      return {
        dispatched: false,
        suppressionReason: 'NOT_OPTED_IN',
        auditEventId: String(savedAudit['event_id']),
        platformTime,
      };
    }

    // 3. Dispatch (placeholder — integrate SendGrid/Twilio/APNs in Scale Phase).
    this.logger.log('NOTIFICATION_SENT', {
      userId: request.userId,
      channel: request.channel,
      templateId: request.templateId,
      consentBasisId: request.consentBasisId,
      auditEventId: savedAudit['event_id'],
      platformTime,
    });

    return {
      dispatched: true,
      auditEventId: String(savedAudit['event_id']),
      platformTime,
    };
  }

  /** Returns the current UTC instant as an ISO 8601 string; metadata includes
   *  governance_timezone to identify America/Toronto as the canonical display tz. */
  private getPlatformTime(): string {
    return new Date().toISOString();
  }
}
