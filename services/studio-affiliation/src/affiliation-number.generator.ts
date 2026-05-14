// services/studio-affiliation/src/affiliation-number.generator.ts
// STUDIO-AFF-001 — AffiliationNumberGenerator
//
// Generates 6–9 char uppercase alphanumeric strings using only A-Z and 2-9.
// Characters 0, 1, O, and I are excluded to avoid visual ambiguity per schema comment.
//
// Collision-resistance strategy:
//   - Length is proportional to current studio count to maintain low collision probability.
//   - Caller retries on unique-violation up to MAX_RETRIES before throwing.
//
// FIZ NOTE: This generator is a pure utility — no balance mutations.
//           The FIZ obligation lives in StudioService.affiliate() which calls this.

import { Injectable, Logger } from '@nestjs/common';

/** Characters allowed in affiliation numbers — excludes 0, 1, O, I */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const MIN_LENGTH = 6;
const MAX_LENGTH = 9;
const MAX_RETRIES = 5;

/**
 * Determine the optimal length based on studio count.
 * We want enough entropy that collision probability stays negligible.
 * ALPHABET.length = 32
 *  length 6 → 32^6 = ~1B  (comfortable to ~10M studios)
 *  length 7 → 32^7 = ~35B
 *  length 8 → 32^8 = ~1.1T
 *  length 9 → 32^9 = ~35T
 */
function targetLength(studioCount: number): number {
  if (studioCount < 100_000) return 6;
  if (studioCount < 3_000_000) return 7;
  if (studioCount < 100_000_000) return 8;
  return 9;
}

function randomChar(): string {
  return ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
}

function generate(length: number): string {
  return Array.from({ length }, randomChar).join('');
}

@Injectable()
export class AffiliationNumberGenerator {
  private readonly logger = new Logger(AffiliationNumberGenerator.name);

  /**
   * Generate a collision-resistant affiliation number.
   *
   * @param studioCount  Current number of Studios in the DB (used to pick length).
   * @param isUnique     Async predicate that returns true if the candidate is not already taken.
   *                     Must be called inside the same transaction as the Studio INSERT.
   * @returns A unique affiliation number (6–9 chars, A-Z2-9).
   * @throws  Error if a unique value cannot be found within MAX_RETRIES attempts.
   */
  async generateUnique(
    studioCount: number,
    isUnique: (candidate: string) => Promise<boolean>,
  ): Promise<string> {
    const length = Math.max(MIN_LENGTH, Math.min(MAX_LENGTH, targetLength(studioCount)));

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const candidate = generate(length);
      const unique = await isUnique(candidate);
      if (unique) {
        this.logger.debug(
          `Generated affiliation number "${candidate}" (length=${length}, attempt=${attempt})`,
        );
        return candidate;
      }
      this.logger.warn(
        `Affiliation number collision on attempt ${attempt}: "${candidate}" — retrying`,
      );
    }

    throw new Error(
      `AffiliationNumberGenerator: could not generate a unique number in ${MAX_RETRIES} attempts (studioCount=${studioCount}, length=${length})`,
    );
  }

  /**
   * Validate that a string conforms to the affiliation number format.
   * Length 6–9, only characters from the allowed alphabet.
   */
  static isValid(value: string): boolean {
    if (value.length < MIN_LENGTH || value.length > MAX_LENGTH) return false;
    return [...value].every((c) => ALPHABET.includes(c));
  }
}
