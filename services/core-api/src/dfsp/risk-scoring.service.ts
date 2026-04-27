// DFSP Module 2 — Risk Scoring Engine
// Spec: DFSP Engineering Spec v1.0, Module 2
// All signal weights config-driven. Any prior chargeback = auto_bar, score 9999.
// Append-only — never mutate a prior assessment.
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NatsService } from '../nats/nats.service';
import { NATS_TOPICS } from '../../../nats/topics.registry';
import { GovernanceConfig } from '../governance/governance.config';

export type RiskTier = 'GREEN' | 'AMBER' | 'RED';

export interface RiskSignalInput {
  account_id: string;
  purchase_attempt_id?: string;
  account_age_days: number;
  prior_diamond_count: number;
  prior_chargeback: boolean;
  prior_dispute: boolean;
  age_verification_days_old: number;
  device_fingerprint_mismatch: boolean;
  ip_country_mismatch: boolean;
  login_outside_billing_region_days: number;
  vpn_detected: boolean;
  payment_method: 'credit_card' | 'wire' | 'e_transfer' | 'bitcoin';
  lifespan_days_requested: number;
  quantity_vs_90day_avg_ratio: number;
  structuring_pattern_detected: boolean;
  organization_id: string;
  tenant_id: string;
}

export interface RiskAssessmentResult {
  account_id: string;
  score: number;
  tier: RiskTier;
  flags: string[];
  expedited_access_eligible: boolean;
  auto_bar: boolean;
  calculated_at: string;
  rule_applied_id: string;
}

@Injectable()
export class RiskScoringService {
  private readonly logger = new Logger(RiskScoringService.name);
  private readonly RULE_ID = 'RISK_SCORING_v1';
  private readonly WEIGHT_CONFIG_VERSION = 'v1.0';

  constructor(
    private readonly prisma: PrismaService,
    private readonly nats: NatsService,
  ) {}

  async assessRisk(input: RiskSignalInput): Promise<RiskAssessmentResult> {
    const calculated_at = new Date().toISOString();
    const flags: string[] = [];
    let score = 0;

    // Auto-bar: any prior chargeback = permanent Diamond bar
    if (input.prior_chargeback) {
      flags.push('PRIOR_CHARGEBACK_AUTO_BAR');
      this.logger.error('RiskScoringService: auto-bar triggered', {
        account_id: input.account_id,
        rule_applied_id: this.RULE_ID,
      });
      const result: RiskAssessmentResult = {
        account_id: input.account_id,
        score: 9999,
        tier: 'RED',
        flags,
        expedited_access_eligible: false,
        auto_bar: true,
        calculated_at,
        rule_applied_id: this.RULE_ID,
      };
      await this.persistAssessment(input, result);
      this.nats.publish(NATS_TOPICS.RISK_AUTO_BAR_TRIGGERED, {
        account_id: input.account_id,
        rule_applied_id: this.RULE_ID,
      });
      return result;
    }

    // Signal weights
    if (input.account_age_days < 30) {
      score += 30;
      flags.push('ACCOUNT_AGE_LT_30');
    } else if (input.account_age_days < 90) {
      score += 15;
      flags.push('ACCOUNT_AGE_30_90');
    }
    if (input.prior_diamond_count === 0) {
      score += 20;
      flags.push('NO_PRIOR_DIAMOND');
    } else if (input.prior_diamond_count === 1) {
      score += 10;
      flags.push('ONE_PRIOR_DIAMOND');
    } else {
      score -= 10;
    }
    if (input.prior_dispute) {
      score += 25;
      flags.push('PRIOR_DISPUTE');
    }
    if (input.age_verification_days_old > 90) {
      score += 20;
      flags.push('AV_EXPIRED');
    }
    if (input.device_fingerprint_mismatch) {
      score += 15;
      flags.push('DEVICE_MISMATCH');
    }
    if (input.ip_country_mismatch) {
      score += 25;
      flags.push('IP_COUNTRY_MISMATCH');
    }
    if (input.login_outside_billing_region_days >= 90) {
      score += 30;
      flags.push('GEOGRAPHIC_DRIFT_90D');
    }
    if (input.vpn_detected) {
      score += 20;
      flags.push('VPN_DETECTED');
    }
    if (input.payment_method === 'credit_card') {
      score += 15;
      flags.push('CC_PAYMENT_METHOD');
    }
    if (input.payment_method === 'wire' || input.payment_method === 'e_transfer') {
      score -= 5;
    }
    if (input.lifespan_days_requested < 30) {
      score += 25;
      flags.push('LIFESPAN_LT_30D');
    } else if (input.lifespan_days_requested < 60) {
      score += 15;
      flags.push('LIFESPAN_LT_60D');
    }
    if (input.quantity_vs_90day_avg_ratio > 3) {
      score += 20;
      flags.push('QUANTITY_SPIKE');
    }
    if (input.structuring_pattern_detected) {
      score += 50;
      flags.push('STRUCTURING_PATTERN');
    }

    const greenMax = GovernanceConfig.DFSP_RISK_SCORE_GREEN_MAX;
    const amberMax = GovernanceConfig.DFSP_RISK_SCORE_AMBER_MAX;
    const tier: RiskTier = score <= greenMax ? 'GREEN' : score <= amberMax ? 'AMBER' : 'RED';
    const expedited_access_eligible =
      tier === 'GREEN' &&
      input.prior_diamond_count >= GovernanceConfig.DFSP_EXPEDITED_ACCESS_MIN_PRIOR_CONTRACTS;

    const result: RiskAssessmentResult = {
      account_id: input.account_id,
      score,
      tier,
      flags,
      expedited_access_eligible,
      auto_bar: false,
      calculated_at,
      rule_applied_id: this.RULE_ID,
    };

    this.logger.log('RiskScoringService: assessment complete', {
      account_id: input.account_id,
      score,
      tier,
      rule_applied_id: this.RULE_ID,
    });
    await this.persistAssessment(input, result);
    this.nats.publish(NATS_TOPICS.RISK_ASSESSMENT_COMPLETED, {
      account_id: input.account_id,
      score,
      tier,
      expedited_access_eligible,
      auto_bar: false,
      calculated_at,
      rule_applied_id: this.RULE_ID,
    });
    return result;
  }

  private async persistAssessment(
    input: RiskSignalInput,
    result: RiskAssessmentResult,
  ): Promise<void> {
    await this.prisma.riskAssessment.create({
      data: {
        account_id: result.account_id,
        purchase_attempt_id: input.purchase_attempt_id ?? null,
        score: result.score,
        tier: result.tier,
        flags: result.flags,
        expedited_access_eligible: result.expedited_access_eligible,
        auto_bar: result.auto_bar,
        calculated_at: new Date(result.calculated_at),
        weight_config_version: this.WEIGHT_CONFIG_VERSION,
        organization_id: input.organization_id,
        tenant_id: input.tenant_id,
      },
    });
  }
}
