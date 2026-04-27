// FIZ: MEMB-003 — StipendDistributionJob
// Monthly CZT stipend distribution per membership tier.
// Idempotent: keyed on subscription_id + billing_period_start (ISO).
// Uses TokenOrigin.GIFTED for all stipend entries. Append-only.
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NatsService } from '../nats/nats.service';
import { LedgerService, TokenType } from '../finance/ledger.service';
import { TokenOrigin } from '../finance/types/ledger.types';
import { MEMBERSHIP } from '../config/governance.config';
import { NATS_TOPICS } from '../../../nats/topics.registry';
import { MembershipTier, SubscriptionStatus } from '@prisma/client';

export interface StipendDistributionResult {
  processed: number;
  granted: number;
  skipped_zero_stipend: number;
  errors: number;
}

@Injectable()
export class StipendDistributionJob {
  private readonly logger = new Logger(StipendDistributionJob.name);
  private readonly RULE_ID = 'MEMB-003_MONTHLY_STIPEND_v1';

  constructor(
    private readonly prisma: PrismaService,
    private readonly natsService: NatsService,
    private readonly ledgerService: LedgerService,
  ) {}

  /**
   * Run monthly stipend distribution for all ACTIVE subscriptions.
   * Scheduler (cron or external invoker) calls this at the first day of each
   * billing month. Idempotency is enforced by LedgerService via the
   * reference_id (subscription_id + billing_period_start ISO); duplicate
   * calls within the same period are no-ops.
   */
  async run(): Promise<StipendDistributionResult> {
    const result: StipendDistributionResult = {
      processed: 0,
      granted: 0,
      skipped_zero_stipend: 0,
      errors: 0,
    };

    this.logger.log('StipendDistributionJob: start', {
      rule_applied_id: this.RULE_ID,
    });

    const subscriptions = await this.prisma.membershipSubscription.findMany({
      where: { status: SubscriptionStatus.ACTIVE },
    });

    for (const sub of subscriptions) {
      result.processed += 1;
      try {
        const stipendAmount = this.resolveStipend(sub.tier);

        if (stipendAmount <= 0) {
          result.skipped_zero_stipend += 1;
          this.logger.log('StipendDistributionJob: zero stipend — skipped', {
            subscription_id: sub.id,
            tier: sub.tier,
            rule_applied_id: this.RULE_ID,
          });
          continue;
        }

        const billingPeriodStartIso = sub.current_period_start.toISOString();
        const idempotencyKey = `${sub.id}:${billingPeriodStartIso}`;

        await this.ledgerService.recordEntry({
          userId: sub.user_id,
          amount: BigInt(stipendAmount),
          tokenType: TokenType.CZT,
          tokenOrigin: TokenOrigin.GIFTED,
          referenceId: idempotencyKey,
          reasonCode: 'MONTHLY_STIPEND',
          ruleAppliedId: this.RULE_ID,
          metadata: {
            idempotency_key: idempotencyKey,
            subscription_id: sub.id,
            tier: sub.tier,
            billing_period_start: billingPeriodStartIso,
            organization_id: sub.organization_id,
            tenant_id: sub.tenant_id,
          },
        });

        result.granted += 1;
        this.logger.log('StipendDistributionJob: stipend granted', {
          subscription_id: sub.id,
          user_id: sub.user_id,
          tier: sub.tier,
          amount_czt: stipendAmount,
          idempotency_key: idempotencyKey,
          rule_applied_id: this.RULE_ID,
        });

        this.natsService.publish(NATS_TOPICS.MEMBERSHIP_STIPEND_DISTRIBUTED, {
          subscription_id: sub.id,
          user_id: sub.user_id,
          tier: sub.tier,
          amount_czt: stipendAmount,
          token_origin: TokenOrigin.GIFTED,
          reason_code: 'MONTHLY_STIPEND',
          idempotency_key: idempotencyKey,
          billing_period_start: billingPeriodStartIso,
          organization_id: sub.organization_id,
          tenant_id: sub.tenant_id,
          rule_applied_id: this.RULE_ID,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        // Per directive: on LedgerService error, log and continue — do not halt batch.
        result.errors += 1;
        this.logger.error('StipendDistributionJob: grant failed — continuing batch', err, {
          subscription_id: sub.id,
          user_id: sub.user_id,
          tier: sub.tier,
          rule_applied_id: this.RULE_ID,
        });
      }
    }

    this.logger.log('StipendDistributionJob: complete', {
      ...result,
      rule_applied_id: this.RULE_ID,
    });

    return result;
  }

  /**
   * Resolve the monthly stipend amount (CZT) for a membership tier.
   * Read from GovernanceConfig MEMBERSHIP.STIPEND_CZT — never hardcoded.
   */
  private resolveStipend(tier: MembershipTier): number {
    return MEMBERSHIP.STIPEND_CZT[tier] ?? 0;
  }
}
