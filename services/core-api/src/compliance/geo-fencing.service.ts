// services/core-api/src/compliance/geo-fencing.service.ts
// GEO: GEO-001 — Sub-national geo-fencing service
// Canonical Corpus v10, Chapter 7 + SovereignCaCMiddleware (GOV-004)
// Extends GeoPricingService (GOV-001) — does not replace it.
// Enforcement model: BLOCK | REDIRECT | FEATURE_LIMIT per jurisdiction rule.
// EU DSA per-member-state rules modeled as jurisdiction configs.
// GDPR cross-border data flow enforcement (Germany strict, Switzerland non-EU).
// All enforcement decisions logged with rule_applied_id.
// COMPLIANCE override requires step-up assertion from caller — not enforced here.
import { Injectable, Logger } from '@nestjs/common';
import { NatsService } from '../nats/nats.service';
import { NATS_TOPICS } from '../../../nats/topics.registry';

// ISO 3166-1 alpha-2 jurisdiction codes in scope
export type JurisdictionCode =
  | 'CA'
  | 'CA-QC'
  | 'CA-ON' // Canada + provinces
  | 'US'
  | 'US-CA'
  | 'US-TX' // USA + states
  | 'DE'
  | 'FR'
  | 'IT'
  | 'ES' // EU DSA member states
  | 'CH'
  | 'GB' // Non-EU: Switzerland, UK
  | 'AU'
  | 'NZ' // APAC
  | string; // Forward-compat for unlisted codes

export type EnforcementOutcome = 'BLOCK' | 'REDIRECT' | 'FEATURE_LIMIT' | 'ALLOW';

export interface JurisdictionRule {
  jurisdiction_code: JurisdictionCode;
  outcome: EnforcementOutcome;
  reason_code: string;
  redirect_url?: string; // Required when outcome is REDIRECT
  feature_limits?: string[]; // Required when outcome is FEATURE_LIMIT
  rule_applied_id: string;
  gdpr_cross_border_restricted: boolean;
  dsa_member_state: boolean;
}

export interface GeoFencingResult {
  account_id: string;
  jurisdiction_code: JurisdictionCode;
  outcome: EnforcementOutcome;
  reason_code: string;
  redirect_url: string | null;
  feature_limits: string[] | null;
  override_applied: boolean;
  override_actor_id: string | null;
  evaluated_at_utc: string;
  rule_applied_id: string;
}

// Jurisdiction rule registry — extend as regulatory scope expands
const JURISDICTION_RULES: Partial<Record<JurisdictionCode, JurisdictionRule>> = {
  DE: {
    jurisdiction_code: 'DE',
    outcome: 'FEATURE_LIMIT',
    reason_code: 'DSA_DE_MEMBER_STATE_STRICT',
    feature_limits: ['adult_content_visible', 'live_stream_access'],
    rule_applied_id: 'GEO_RULE_DE_v1',
    gdpr_cross_border_restricted: true,
    dsa_member_state: true,
  },
  CH: {
    jurisdiction_code: 'CH',
    outcome: 'FEATURE_LIMIT',
    reason_code: 'GDPR_NON_EU_CROSS_BORDER',
    feature_limits: ['data_export', 'third_party_data_share'],
    rule_applied_id: 'GEO_RULE_CH_v1',
    gdpr_cross_border_restricted: true,
    dsa_member_state: false,
  },
  'CA-QC': {
    jurisdiction_code: 'CA-QC',
    outcome: 'FEATURE_LIMIT',
    reason_code: 'QUEBEC_LAW_25_STRICT_CONSENT',
    feature_limits: ['analytics_tracking', 'third_party_data_share'],
    rule_applied_id: 'GEO_RULE_CA_QC_v1',
    gdpr_cross_border_restricted: false,
    dsa_member_state: false,
  },
};

@Injectable()
export class GeoFencingService {
  private readonly logger = new Logger(GeoFencingService.name);
  private readonly RULE_ID = 'GEO_FENCING_v1';

  // Per-account override store (in-memory — DB migration tracked separately)
  // TODO: GEO-OVERRIDE-DB — migrate to DB-backed store before go-live
  private readonly overrides = new Map<
    string,
    {
      jurisdiction_code: JurisdictionCode;
      outcome: EnforcementOutcome;
      actor_id: string;
      applied_at_utc: string;
      reason_code: string;
    }
  >();

  constructor(private readonly nats: NatsService) {}

  /**
   * Evaluates geo-fencing rules for an account in a given jurisdiction.
   * Checks account-level override first, then jurisdiction rule registry.
   * Publishes NATS event on every BLOCK outcome.
   * Returns ALLOW if no rule applies.
   * COMPLIANCE override must be asserted by caller before calling applyOverride().
   */
  evaluate(params: { account_id: string; jurisdiction_code: JurisdictionCode }): GeoFencingResult {
    const now = new Date().toISOString();

    // 1. Check per-account override first
    const overrideKey = `${params.account_id}:${params.jurisdiction_code}`;
    const override = this.overrides.get(overrideKey);

    if (override) {
      this.logger.log('GeoFencingService: override applied', {
        account_id: params.account_id,
        jurisdiction_code: params.jurisdiction_code,
        outcome: override.outcome,
        actor_id: override.actor_id,
        rule_applied_id: this.RULE_ID,
      });

      return {
        account_id: params.account_id,
        jurisdiction_code: params.jurisdiction_code,
        outcome: override.outcome,
        reason_code: override.reason_code,
        redirect_url: null,
        feature_limits: null,
        override_applied: true,
        override_actor_id: override.actor_id,
        evaluated_at_utc: now,
        rule_applied_id: this.RULE_ID,
      };
    }

    // 2. Check jurisdiction rule registry
    const rule = JURISDICTION_RULES[params.jurisdiction_code];

    if (!rule) {
      return {
        account_id: params.account_id,
        jurisdiction_code: params.jurisdiction_code,
        outcome: 'ALLOW',
        reason_code: 'NO_RULE_APPLIED',
        redirect_url: null,
        feature_limits: null,
        override_applied: false,
        override_actor_id: null,
        evaluated_at_utc: now,
        rule_applied_id: this.RULE_ID,
      };
    }

    const result: GeoFencingResult = {
      account_id: params.account_id,
      jurisdiction_code: params.jurisdiction_code,
      outcome: rule.outcome,
      reason_code: rule.reason_code,
      redirect_url: rule.redirect_url ?? null,
      feature_limits: rule.feature_limits ?? null,
      override_applied: false,
      override_actor_id: null,
      evaluated_at_utc: now,
      rule_applied_id: rule.rule_applied_id,
    };

    this.logger.log('GeoFencingService: rule evaluated', {
      account_id: params.account_id,
      jurisdiction_code: params.jurisdiction_code,
      outcome: rule.outcome,
      reason_code: rule.reason_code,
      gdpr_cross_border_restricted: rule.gdpr_cross_border_restricted,
      dsa_member_state: rule.dsa_member_state,
      rule_applied_id: rule.rule_applied_id,
    });

    // 3. Publish NATS on BLOCK outcomes
    if (rule.outcome === 'BLOCK') {
      this.nats.publish(NATS_TOPICS.GEO_BLOCK_ENFORCED, {
        account_id: params.account_id,
        jurisdiction_code: params.jurisdiction_code,
        reason_code: rule.reason_code,
        rule_applied_id: rule.rule_applied_id,
        enforced_at_utc: now,
      });
    }

    return result;
  }

  /**
   * Applies a per-account jurisdiction override.
   * Caller is responsible for asserting COMPLIANCE role via step-up auth.
   */
  applyOverride(params: {
    account_id: string;
    jurisdiction_code: JurisdictionCode;
    outcome: EnforcementOutcome;
    actor_id: string;
    reason_code: string;
  }): void {
    const now = new Date().toISOString();
    const key = `${params.account_id}:${params.jurisdiction_code}`;

    this.overrides.set(key, {
      jurisdiction_code: params.jurisdiction_code,
      outcome: params.outcome,
      actor_id: params.actor_id,
      applied_at_utc: now,
      reason_code: params.reason_code,
    });

    this.logger.log('GeoFencingService: override applied', {
      account_id: params.account_id,
      jurisdiction_code: params.jurisdiction_code,
      outcome: params.outcome,
      actor_id: params.actor_id,
      reason_code: params.reason_code,
      rule_applied_id: this.RULE_ID,
    });
  }

  /**
   * Removes a per-account jurisdiction override.
   * Caller is responsible for asserting COMPLIANCE role via step-up auth.
   */
  removeOverride(params: {
    account_id: string;
    jurisdiction_code: JurisdictionCode;
    actor_id: string;
  }): boolean {
    const key = `${params.account_id}:${params.jurisdiction_code}`;
    const existed = this.overrides.delete(key);

    if (existed) {
      this.logger.log('GeoFencingService: override removed', {
        account_id: params.account_id,
        jurisdiction_code: params.jurisdiction_code,
        actor_id: params.actor_id,
        rule_applied_id: this.RULE_ID,
      });
    }

    return existed;
  }

  /**
   * Returns the jurisdiction rule for a given code, or null if no rule applies.
   * Read-only — does not evaluate overrides.
   */
  getRule(jurisdiction_code: JurisdictionCode): JurisdictionRule | null {
    return JURISDICTION_RULES[jurisdiction_code] ?? null;
  }

  /**
   * Returns true if the jurisdiction has GDPR cross-border data flow restrictions.
   */
  isGdprCrossBorderRestricted(jurisdiction_code: JurisdictionCode): boolean {
    const rule = JURISDICTION_RULES[jurisdiction_code];
    return rule?.gdpr_cross_border_restricted ?? false;
  }

  /**
   * Returns true if the jurisdiction is an EU DSA member state.
   */
  isDsaMemberState(jurisdiction_code: JurisdictionCode): boolean {
    const rule = JURISDICTION_RULES[jurisdiction_code];
    return rule?.dsa_member_state ?? false;
  }
}
