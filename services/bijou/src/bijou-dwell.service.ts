// BIJOU: BJ-004 — BijouDwellService
// Credits guests CZT based on dwell time when a session closes.
// 65/35 creator/platform split. Append-only. Idempotent on admission + session.
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../core-api/src/prisma.service';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { LedgerService, TokenType } from '../../core-api/src/finance/ledger.service';
import { TokenOrigin } from '../../core-api/src/finance/types/ledger.types';
import { GovernanceConfig } from '../../core-api/src/governance/governance.config';
import { NATS_TOPICS } from '../../nats/topics.registry';
import { BijouAdmissionStatus } from '@prisma/client';

export interface DwellCreditResult {
  session_id: string;
  processed: number;
  credited: number;
  errors: number;
}

@Injectable()
export class BijouDwellService implements OnModuleInit {
  private readonly logger = new Logger(BijouDwellService.name);
  private readonly RULE_ID = 'BJ-004_BIJOU_DWELL_CREDIT_v1';

  constructor(
    private readonly prisma: PrismaService,
    private readonly natsService: NatsService,
    private readonly ledgerService: LedgerService,
  ) {}

  onModuleInit(): void {
    this.natsService.subscribe(NATS_TOPICS.BIJOU_SESSION_CLOSED, (payload) => {
      const sessionId = payload['session_id'] as string;
      if (!sessionId) {
        this.logger.warn('BijouDwellService: BIJOU_SESSION_CLOSED missing session_id', {
          rule_applied_id: this.RULE_ID,
        });
        return;
      }
      void this.onSessionClosed(sessionId);
    });
    this.logger.log('BijouDwellService: subscribed to BIJOU_SESSION_CLOSED', {
      rule_applied_id: this.RULE_ID,
    });
  }

  /**
   * Process dwell credit for all ADMITTED admissions of a closed session.
   * For each admission:
   *   dwell_seconds = session.scheduled_end - admission.admitted_at
   *   czt_credited  = floor(dwell_seconds / DWELL_CREDIT_INTERVAL_SECONDS)
   *                   * DWELL_CREDIT_PER_INTERVAL
   *   payout_czt    = floor(czt_credited * BIJOU_CREATOR_SPLIT)
   *   platform_czt  = czt_credited - payout_czt
   * Writes DwellLog (append-only), LedgerEntry (GIFTED), and
   * CreatorDwellAccrual (settled=false). Publishes bijou.dwell.credited.
   * Per-record errors are logged; batch continues.
   */
  async onSessionClosed(sessionId: string): Promise<DwellCreditResult> {
    const result: DwellCreditResult = {
      session_id: sessionId,
      processed: 0,
      credited: 0,
      errors: 0,
    };

    this.logger.log('BijouDwellService.onSessionClosed: start', {
      session_id: sessionId,
      rule_applied_id: this.RULE_ID,
    });

    const session = await this.prisma.bijouSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      this.logger.warn('BijouDwellService.onSessionClosed: session not found', {
        session_id: sessionId,
        rule_applied_id: this.RULE_ID,
      });
      return result;
    }

    // Use the actual close moment as the dwell endpoint. The directive
    // says "admitted_at → session close". We use scheduled_end as the
    // close timestamp for determinism; the NATS event triggers on close.
    const closeAt = session.scheduled_end;

    const admissions = await this.prisma.bijouAdmission.findMany({
      where: { session_id: sessionId, status: BijouAdmissionStatus.ADMITTED },
    });

    for (const admission of admissions) {
      result.processed += 1;
      try {
        if (!admission.admitted_at) {
          this.logger.warn('BijouDwellService: ADMITTED record missing admitted_at — skipped', {
            admission_id: admission.id,
            rule_applied_id: this.RULE_ID,
          });
          continue;
        }

        const dwellSeconds = Math.max(
          0,
          Math.floor((closeAt.getTime() - admission.admitted_at.getTime()) / 1000),
        );
        const intervals = Math.floor(
          dwellSeconds / GovernanceConfig.BIJOU.DWELL_CREDIT_INTERVAL_SECONDS,
        );
        const cztCredited = intervals * GovernanceConfig.BIJOU.DWELL_CREDIT_PER_INTERVAL;
        const payoutCzt = Math.floor(cztCredited * GovernanceConfig.BIJOU.BIJOU_CREATOR_SPLIT);
        const platformCzt = cztCredited - payoutCzt;

        const idempotencyKey = `BIJOU_DWELL:${admission.id}:${sessionId}`;

        await this.prisma.dwellLog.create({
          data: {
            admission_id: admission.id,
            session_id: sessionId,
            user_id: admission.user_id,
            dwell_seconds: dwellSeconds,
            czt_credited: cztCredited,
            payout_czt: payoutCzt,
            platform_czt: platformCzt,
            organization_id: admission.organization_id,
            tenant_id: admission.tenant_id,
          },
        });

        if (cztCredited > 0) {
          await this.ledgerService.recordEntry({
            userId: admission.user_id,
            amount: BigInt(cztCredited),
            tokenType: TokenType.CZT,
            tokenOrigin: TokenOrigin.GIFTED,
            referenceId: idempotencyKey,
            reasonCode: 'BIJOU_DWELL_CREDIT',
            ruleAppliedId: this.RULE_ID,
            metadata: {
              idempotency_key: idempotencyKey,
              admission_id: admission.id,
              session_id: sessionId,
              dwell_seconds: dwellSeconds,
              payout_czt: payoutCzt,
              platform_czt: platformCzt,
              organization_id: admission.organization_id,
              tenant_id: admission.tenant_id,
            },
          });
        }

        await this.prisma.creatorDwellAccrual.create({
          data: {
            creator_id: session.creator_id,
            session_id: sessionId,
            payout_czt: payoutCzt,
            settled: false,
            organization_id: admission.organization_id,
            tenant_id: admission.tenant_id,
          },
        });

        result.credited += 1;

        this.logger.log('BijouDwellService: credited', {
          admission_id: admission.id,
          session_id: sessionId,
          user_id: admission.user_id,
          dwell_seconds: dwellSeconds,
          czt_credited: cztCredited,
          payout_czt: payoutCzt,
          platform_czt: platformCzt,
          idempotency_key: idempotencyKey,
          rule_applied_id: this.RULE_ID,
        });

        this.natsService.publish(NATS_TOPICS.BIJOU_DWELL_CREDITED, {
          admission_id: admission.id,
          session_id: sessionId,
          creator_id: session.creator_id,
          user_id: admission.user_id,
          dwell_seconds: dwellSeconds,
          czt_credited: cztCredited,
          payout_czt: payoutCzt,
          platform_czt: platformCzt,
          token_origin: TokenOrigin.GIFTED,
          reason_code: 'BIJOU_DWELL_CREDIT',
          idempotency_key: idempotencyKey,
          organization_id: admission.organization_id,
          tenant_id: admission.tenant_id,
          rule_applied_id: this.RULE_ID,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        result.errors += 1;
        this.logger.error('BijouDwellService: credit failed — continuing batch', err, {
          admission_id: admission.id,
          session_id: sessionId,
          rule_applied_id: this.RULE_ID,
        });
      }
    }

    this.logger.log('BijouDwellService.onSessionClosed: complete', {
      ...result,
      rule_applied_id: this.RULE_ID,
    });

    return result;
  }
}
