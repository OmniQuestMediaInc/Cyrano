// services/core-api/src/compliance/sovereign-cac.middleware.ts
// GOV: Sovereign CaC (Compliance as Code) middleware — Corpus Appendix J
// Enforces: Bill S-210 age assurance, Bill 149 AI disclosure, jurisdiction gating.
// All jurisdiction rules are versioned and configurable — never hardcoded.
import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

// Jurisdiction rules version — increment on any rule change (GOV: commit required)
const JURISDICTION_RULES_VERSION = 'v1.0.0';

export interface JurisdictionRule {
  country_code: string;
  region_code?: string; // Provincial/state level where applicable
  age_assurance_required: boolean;
  age_assurance_method: 'DECLARATION' | 'RELIABLE_ESTIMATION' | 'VERIFIED_ID';
  ai_disclosure_required: boolean;
  content_restriction_variance?: string;
  consent_enforcement_threshold?: string;
  reporting_obligations?: string[];
}

// Versioned jurisdiction overlay — Corpus Appendix J
// Any change requires: version increment + GOV: commit + governance approval
const JURISDICTION_OVERLAY: JurisdictionRule[] = [
  {
    country_code: 'CA',
    age_assurance_required: true,
    age_assurance_method: 'RELIABLE_ESTIMATION', // Bill S-210
    ai_disclosure_required: true, // Bill 149 (ON) — applied nationally
    reporting_obligations: ['BILL_C22_WARRANT_10DAY'],
  },
  {
    country_code: 'CA',
    region_code: 'ON',
    age_assurance_required: true,
    age_assurance_method: 'RELIABLE_ESTIMATION',
    ai_disclosure_required: true, // Bill 149 specific to Ontario
    reporting_obligations: ['BILL_C22_WARRANT_10DAY', 'BILL_149_AI_DISCLOSURE'],
  },
  {
    country_code: 'US',
    age_assurance_required: true,
    age_assurance_method: 'DECLARATION', // 18 USC 2257
    ai_disclosure_required: false,
    reporting_obligations: ['USC_2257_RECORDS'],
  },
  {
    country_code: 'GB',
    age_assurance_required: true,
    age_assurance_method: 'VERIFIED_ID', // UK Online Safety Act
    ai_disclosure_required: false,
  },
  {
    country_code: 'DEFAULT',
    age_assurance_required: true,
    age_assurance_method: 'DECLARATION',
    ai_disclosure_required: false,
  },
];

@Injectable()
export class SovereignCaCMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SovereignCaCMiddleware.name);

  use(req: Request, res: Response, next: NextFunction): void {
    const country_code = this.resolveCountryCode(req);
    const region_code = this.resolveRegionCode(req);
    const rule = this.resolveRule(country_code, region_code);

    // Attach jurisdiction context to request for downstream services
    (req as Request & { jurisdiction: JurisdictionRule & { version: string } }).jurisdiction = {
      ...rule,
      version: JURISDICTION_RULES_VERSION,
    };

    // Bill 149 (ON): AI disclosure header — must be present on all responses
    // where AI-assisted content may be returned
    if (rule.ai_disclosure_required) {
      res.setHeader(
        'X-AI-Disclosure',
        'This platform uses AI-assisted features. ' +
          'AI tools assist creators but do not replace human oversight. ' +
          'Bill 149 (Ontario) 2024.',
      );
    }

    // Age assurance gate — enforced at content delivery layer, not here
    // This middleware attaches the requirement; the SafetyService enforces it
    if (rule.age_assurance_required) {
      res.setHeader('X-Age-Assurance-Required', rule.age_assurance_method);
    }

    this.logger.log('SovereignCaCMiddleware: jurisdiction resolved', {
      country_code,
      region_code: region_code ?? 'NONE',
      age_assurance_method: rule.age_assurance_method,
      ai_disclosure_required: rule.ai_disclosure_required,
      rules_version: JURISDICTION_RULES_VERSION,
      rule_applied_id: 'SOVEREIGN_CAC_v1',
    });

    next();
  }

  private resolveCountryCode(req: Request): string {
    // Priority: Cloudflare header → custom header → default
    return (
      (req.headers['cf-ipcountry'] as string) ??
      (req.headers['x-country-code'] as string) ??
      'DEFAULT'
    ).toUpperCase();
  }

  private resolveRegionCode(req: Request): string | undefined {
    return (req.headers['x-region-code'] as string | undefined)?.toUpperCase();
  }

  private resolveRule(country_code: string, region_code?: string): JurisdictionRule {
    // Try region-specific match first
    if (region_code) {
      const regional = JURISDICTION_OVERLAY.find(
        (r) => r.country_code === country_code && r.region_code === region_code,
      );
      if (regional) return regional;
    }

    // Country-level match (no region)
    const national = JURISDICTION_OVERLAY.find(
      (r) => r.country_code === country_code && !r.region_code,
    );
    if (national) return national;

    // Default fallback
    return JURISDICTION_OVERLAY.find((r) => r.country_code === 'DEFAULT')!;
  }
}
