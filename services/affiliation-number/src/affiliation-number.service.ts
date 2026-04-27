// services/affiliation-number/src/affiliation-number.service.ts
// RBAC-STUDIO-001 — Affiliation Number Generator
//
// Generates the globally-unique alphanumeric identifier assigned to a
// Studio at creation time. The number is permanent (no regeneration
// policy); see Studio.affiliation_number invariants in prisma/schema.prisma.
//
// Format:
//   - Length: 6-9 chars (configurable per call; default 7)
//   - Alphabet: A-Z + 2-9, excluding 0, 1, O, I (visual disambiguation)
//   - Generated using crypto.randomInt for cryptographically secure entropy
//
// Uniqueness:
//   - Globally unique across all Studios (enforced by DB unique index +
//     CHECK constraint in 20260427120000_studio_onboarding_rbac).
//   - The service retries on collision via the supplied `existsCheck` probe.
//     Collision probability is vanishingly small at 32^7 ≈ 3.4e10 keys, but
//     the retry loop is the formal contract — never assume first-shot success.

import { Injectable, Logger } from '@nestjs/common';
import { randomInt } from 'crypto';

export const AFFILIATION_NUMBER_RULE_ID = 'STUDIO_AFFILIATION_v1';

/** Allowed alphabet — A-Z minus {O, I} plus 2-9 (no 0, 1). 32 symbols. */
export const AFFILIATION_NUMBER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export interface GenerateOptions {
  /** Desired length (6-9 inclusive). Default 7. */
  length?: number;
  /**
   * Async probe that returns true if the candidate is already taken.
   * The service iterates until the probe returns false or maxAttempts
   * is exhausted. In production this is a Prisma `findUnique` against
   * studios.affiliation_number.
   */
  existsCheck: (candidate: string) => Promise<boolean>;
  /** Hard cap on retry attempts. Default 8 — astronomically safe. */
  maxAttempts?: number;
  /** Correlation id propagated into the success/failure log lines. */
  correlationId?: string;
}

export interface GenerateResult {
  affiliation_number: string;
  attempts: number;
  rule_applied_id: string;
}

@Injectable()
export class AffiliationNumberService {
  private readonly logger = new Logger(AffiliationNumberService.name);
  private readonly RULE_ID = AFFILIATION_NUMBER_RULE_ID;

  /**
   * Single-character cryptographic draw from AFFILIATION_NUMBER_ALPHABET.
   * Uses crypto.randomInt (uniform in [0, max)) — Math.random would not
   * meet the "cryptographically secure" requirement.
   */
  private drawChar(): string {
    const idx = randomInt(0, AFFILIATION_NUMBER_ALPHABET.length);
    return AFFILIATION_NUMBER_ALPHABET[idx];
  }

  /** Build a single candidate of the requested length. */
  private buildCandidate(length: number): string {
    let out = '';
    for (let i = 0; i < length; i++) out += this.drawChar();
    return out;
  }

  /**
   * Validate that a string conforms to the format invariants. Useful for
   * defensive checks at API boundaries (e.g. a creator typing their number
   * to verify studio affiliation).
   */
  isValidFormat(candidate: string): boolean {
    if (typeof candidate !== 'string') return false;
    if (candidate.length < 6 || candidate.length > 9) return false;
    return /^[A-HJ-NP-Z2-9]+$/.test(candidate);
  }

  async generate(opts: GenerateOptions): Promise<GenerateResult> {
    const length = opts.length ?? 7;
    if (length < 6 || length > 9) {
      throw new Error(`AffiliationNumberService: invalid length ${length} (must be 6-9)`);
    }
    const maxAttempts = opts.maxAttempts ?? 8;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const candidate = this.buildCandidate(length);
      const taken = await opts.existsCheck(candidate);
      if (!taken) {
        this.logger.log('AffiliationNumberService: number generated', {
          attempts: attempt,
          length,
          correlation_id: opts.correlationId ?? null,
          rule_applied_id: this.RULE_ID,
        });
        return {
          affiliation_number: candidate,
          attempts: attempt,
          rule_applied_id: this.RULE_ID,
        };
      }
      this.logger.warn('AffiliationNumberService: collision — retrying', {
        attempt,
        correlation_id: opts.correlationId ?? null,
        rule_applied_id: this.RULE_ID,
      });
    }

    this.logger.error('AffiliationNumberService: exhausted attempts', {
      maxAttempts,
      correlation_id: opts.correlationId ?? null,
      rule_applied_id: this.RULE_ID,
    });
    throw new Error('AFFILIATION_NUMBER_EXHAUSTED');
  }
}
