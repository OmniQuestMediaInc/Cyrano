// WO: WO-037
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GovernanceConfigService } from '../config/governance.config';

/**
 * WO-037: Creator-Led Attribution Engine — ReferralRewardService
 *
 * Doctrine:
 *  - Every reward granted MUST generate a ledger_event with
 *    wallet_bucket: 'promotional_bonus' and a rule_applied_id.
 *  - Anti-fraud: device_fingerprint and payment_instrument_hash are checked
 *    against the originating referral_link to prevent self-referral loops.
 *  - All timestamps are recorded in America/Toronto (platform_time).
 *  - Append-Only: no UPDATE or DELETE on ledger_entries.
 */

export interface AttributionEventRecord {
  referralLinkId: string;
  creatorId: string;
  campaignId: string;
  attributedUserId: string;
  eventType: 'CLICK' | 'SIGNUP' | 'FIRST_PURCHASE' | 'CONVERSION';
  deviceFingerprint?: string;
  paymentInstrumentHash?: string;
  metadata?: Record<string, unknown>;
}

export interface RewardGrantResult {
  ledgerEntryId: string;
  attributionEventId: string;
  ruleAppliedId: string;
  walletBucket: string;
  platformTime: string;
}

@Injectable()
export class ReferralRewardService {
  private readonly logger = new Logger(ReferralRewardService.name);

  constructor(
    @InjectRepository('referral_links' as never)
    private readonly referralLinksRepo: Repository<Record<string, unknown>>,
    @InjectRepository('attribution_events' as never)
    private readonly attributionEventsRepo: Repository<Record<string, unknown>>,
    @InjectRepository('ledger_entries' as never)
    private readonly ledgerRepo: Repository<Record<string, unknown>>,
    private readonly config: GovernanceConfigService,
  ) {}

  /**
   * Records an attribution event and — when the event type warrants a reward
   * (FIRST_PURCHASE or CONVERSION) — credits a REWARD_CREDIT ledger entry
   * with wallet_bucket: 'promotional_bonus'.
   *
   * Anti-fraud: rejects the event when device_fingerprint or
   * payment_instrument_hash matches the originating referral_link, indicating
   * a self-referral loop.
   */
  async recordAttributionEvent(
    event: AttributionEventRecord,
    ruleAppliedId: string,
  ): Promise<{ attributionEventId: string; ledgerEntryId: string | null }> {
    // 1. Load the originating referral link.
    const link = await this.referralLinksRepo.findOne({
      where: { id: event.referralLinkId },
    });
    if (!link) {
      throw new Error(`REFERRAL_NOT_FOUND: referral_link_id=${event.referralLinkId}`);
    }

    // 2. Anti-fraud: self-referral loop detection (WO-037 §anti-fraud).
    this.assertNoSelfReferral(link, event);

    // 3. Append the attribution event row (always, regardless of reward eligibility).
    const platformTime = this.getPlatformTime();
    const attributionEntry = this.attributionEventsRepo.create({
      referral_link_id: event.referralLinkId,
      creator_id: event.creatorId,
      campaign_id: event.campaignId,
      attributed_user_id: event.attributedUserId,
      event_type: event.eventType,
      device_fingerprint: event.deviceFingerprint ?? null,
      payment_instrument_hash: event.paymentInstrumentHash ?? null,
      rule_applied_id: ruleAppliedId,
      platform_time: platformTime,
      metadata: {
        ...(event.metadata ?? {}),
        governance_timezone: this.config.TIMEZONE,
      },
    });
    const savedAttribution = (await this.attributionEventsRepo.save(attributionEntry)) as Record<
      string,
      unknown
    >;

    // 4. Grant reward only for conversion-class events.
    const rewardableEvents = new Set<string>(['FIRST_PURCHASE', 'CONVERSION']);
    if (!rewardableEvents.has(event.eventType)) {
      return { attributionEventId: String(savedAttribution['id']), ledgerEntryId: null };
    }

    // 5. Ledger reward: REWARD_CREDIT with wallet_bucket = promotional_bonus.
    const idempotencyKey = `REFERRAL_REWARD:${event.referralLinkId}:${event.attributedUserId}:${event.eventType}`;
    const existing = await this.ledgerRepo.findOne({ where: { idempotency_key: idempotencyKey } });
    if (existing) {
      const existingRecord = existing as Record<string, unknown>;
      this.logger.warn('REFERRAL_REWARD: idempotency hit — already rewarded', {
        idempotencyKey,
        existingId: existingRecord['id'],
      });
      return {
        attributionEventId: String(savedAttribution['id']),
        ledgerEntryId: String(existingRecord['id']),
      };
    }

    const ledgerEntry = this.ledgerRepo.create({
      user_id: event.creatorId,
      entry_type: 'REWARD_CREDIT',
      status: 'PENDING',
      gross_amount_cents: 0, // Amount set by caller via metadata; zero is safe default
      net_amount_cents: 0,
      idempotency_key: idempotencyKey,
      transaction_ref: idempotencyKey,
      description: `Referral reward — campaign ${event.campaignId}`,
      metadata: {
        wallet_bucket: 'promotional_bonus',
        rule_applied_id: ruleAppliedId,
        referral_link_id: event.referralLinkId,
        attributed_user_id: event.attributedUserId,
        event_type: event.eventType,
        platform_time: platformTime,
        governance_timezone: this.config.TIMEZONE,
      },
    });
    const savedLedger = (await this.ledgerRepo.save(ledgerEntry)) as Record<string, unknown>;

    this.logger.log('REFERRAL_REWARD: ledger entry created', {
      ledgerEntryId: savedLedger['id'],
      walletBucket: 'promotional_bonus',
      ruleAppliedId,
      platformTime,
    });

    return {
      attributionEventId: String(savedAttribution['id']),
      ledgerEntryId: String(savedLedger['id']),
    };
  }

  /**
   * Anti-fraud: raises an error when the inbound device_fingerprint or
   * payment_instrument_hash matches the value stored on the referral_link,
   * which would indicate the link creator is attributing themselves.
   */
  private assertNoSelfReferral(link: Record<string, unknown>, event: AttributionEventRecord): void {
    const fingerprintMatch =
      event.deviceFingerprint &&
      link['device_fingerprint'] &&
      event.deviceFingerprint === link['device_fingerprint'];

    const paymentMatch =
      event.paymentInstrumentHash &&
      link['payment_instrument_hash'] &&
      event.paymentInstrumentHash === link['payment_instrument_hash'];

    if (fingerprintMatch || paymentMatch) {
      this.logger.warn('SELF_REFERRAL_BLOCKED', {
        referralLinkId: event.referralLinkId,
        creatorId: event.creatorId,
        attributedUserId: event.attributedUserId,
        fingerprintMatch,
        paymentMatch,
      });
      throw new Error(
        `SELF_REFERRAL_BLOCKED: attribution rejected for referral_link_id=${event.referralLinkId}`,
      );
    }
  }

  /** Returns the current UTC instant as an ISO 8601 string; metadata includes
   *  governance_timezone to identify America/Toronto as the canonical display tz. */
  private getPlatformTime(): string {
    return new Date().toISOString();
  }
}
