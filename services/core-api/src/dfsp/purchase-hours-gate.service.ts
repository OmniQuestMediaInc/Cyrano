// DFSP Module 1 — Purchase Hours Gate
// Spec: DFSP Engineering Spec v1.0, Module 1
// Enforcement: server-side only. Billing address TZ is authoritative.
// Window: 11:00 AM – 11:00 PM (23:00 exclusive) in account billing TZ.
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NatsService } from '../nats/nats.service';
import { NATS_TOPICS } from '../../../nats/topics.registry';
import { GovernanceConfig } from '../governance/governance.config';

export type PurchaseWindowOutcome = 'ALLOWED' | 'BLOCKED_OUTSIDE_WINDOW';

export interface PurchaseWindowResult {
  account_id: string;
  outcome: PurchaseWindowOutcome;
  account_timezone: string;
  window_open_hour: number;
  window_close_hour: number;
  window_opens_at: string | null;
  evaluated_at_utc: string;
  rule_applied_id: string;
}

@Injectable()
export class PurchaseHoursGateService {
  private readonly logger = new Logger(PurchaseHoursGateService.name);
  private readonly RULE_ID = 'PURCHASE_HOURS_GATE_v1';

  constructor(
    private readonly prisma: PrismaService,
    private readonly nats: NatsService,
  ) {}

  async evaluatePurchaseWindow(params: {
    account_id: string;
    billing_tz: string;
    country_code?: string;
    tier?: string;
  }): Promise<PurchaseWindowResult> {
    const evaluated_at_utc = new Date().toISOString();
    const tier = params.tier ?? 'diamond';

    const config = await this.getWindowConfig(params.country_code ?? null, tier);
    const openHour = config?.window_open_hour ?? GovernanceConfig.DFSP_PURCHASE_WINDOW_OPEN_HOUR;
    const closeHour = config?.window_close_hour ?? GovernanceConfig.DFSP_PURCHASE_WINDOW_CLOSE_HOUR;

    const nowInTz = this.getCurrentHourInTz(params.billing_tz);
    const allowed = nowInTz >= openHour && nowInTz < closeHour;

    if (!allowed) {
      this.logger.warn('PurchaseHoursGateService: blocked — outside purchase window', {
        account_id: params.account_id,
        billing_tz: params.billing_tz,
        current_hour: nowInTz,
        rule_applied_id: this.RULE_ID,
      });
      this.nats.publish(NATS_TOPICS.PURCHASE_WINDOW_BLOCKED, {
        account_id: params.account_id,
        billing_tz: params.billing_tz,
        current_hour: nowInTz,
        evaluated_at_utc,
        rule_applied_id: this.RULE_ID,
      });
      return {
        account_id: params.account_id,
        outcome: 'BLOCKED_OUTSIDE_WINDOW',
        account_timezone: params.billing_tz,
        window_open_hour: openHour,
        window_close_hour: closeHour,
        window_opens_at: this.nextWindowOpen(params.billing_tz, openHour),
        evaluated_at_utc,
        rule_applied_id: this.RULE_ID,
      };
    }

    return {
      account_id: params.account_id,
      outcome: 'ALLOWED',
      account_timezone: params.billing_tz,
      window_open_hour: openHour,
      window_close_hour: closeHour,
      window_opens_at: null,
      evaluated_at_utc,
      rule_applied_id: this.RULE_ID,
    };
  }

  private async getWindowConfig(
    country_code: string | null,
    tier: string,
  ): Promise<{ window_open_hour: number; window_close_hour: number } | null> {
    if (country_code) {
      const specific = await this.prisma.purchaseWindowConfig.findFirst({
        where: { country_code, tier, active: true },
      });
      if (specific) return specific;
    }
    return this.prisma.purchaseWindowConfig.findFirst({
      where: { country_code: null, tier, active: true },
    });
  }

  private getCurrentHourInTz(iana_tz: string): number {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: iana_tz,
      hour: 'numeric',
      hour12: false,
    });
    const hour = parseInt(formatter.format(new Date()), 10);
    return isNaN(hour) ? 0 : hour;
  }

  private nextWindowOpen(iana_tz: string, openHour: number): string {
    const now = new Date();
    const currentHour = this.getCurrentHourInTz(iana_tz);
    const hoursUntilOpen =
      currentHour >= openHour ? 24 - currentHour + openHour : openHour - currentHour;
    return new Date(now.getTime() + hoursUntilOpen * 60 * 60 * 1000).toISOString();
  }
}
