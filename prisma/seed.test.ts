// prisma/seed.test.ts
// MEMB-001 §6.d — NEGATIVE-SPACE GUARDRAIL
//
// Asserts that retired MembershipTier values never reappear in the Prisma
// schema. Per policy §1.1 the retired values are:
//   - DAY_PASS
//   - ANNUAL           (as a MembershipTier value; still valid as a
//                       BillingInterval label)
//   - OMNIPASS_PLUS    (product, not a tier)
//   - DIAMOND          (standalone; canonical form is VIP_DIAMOND)
//
// The test parses prisma/schema.prisma as text and scopes the check to the
// `enum MembershipTier { ... }` block so it does not falsely flag
// `BillingInterval.ANNUAL` or the valid `VIP_DIAMOND` value.
//
// Runnable standalone: `npx ts-node prisma/seed.test.ts`
// Exits with code 0 on pass, non-zero on failure.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { strict as assert } from 'node:assert';

const SCHEMA_PATH = join(__dirname, 'schema.prisma');

const CANONICAL_TIERS = [
  'GUEST',
  'VIP',
  'VIP_SILVER',
  'VIP_GOLD',
  'VIP_PLATINUM',
  'VIP_DIAMOND',
] as const;

const RETIRED_TIERS = [
  'DAY_PASS',
  'ANNUAL',
  'OMNIPASS_PLUS',
  'DIAMOND', // standalone DIAMOND; VIP_DIAMOND is valid and handled by regex below
] as const;

function extractEnumBlock(source: string, enumName: string): string {
  const pattern = new RegExp(`enum\\s+${enumName}\\s*\\{([^}]*)\\}`, 'm');
  const match = source.match(pattern);
  if (!match) {
    throw new Error(`enum ${enumName} not found in schema.prisma`);
  }
  return match[1];
}

function extractEnumValues(enumBody: string): string[] {
  return enumBody
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, '').trim())
    .filter((line) => line.length > 0 && /^[A-Z_][A-Z0-9_]*$/.test(line));
}

function runGuardrail(): void {
  const schemaSource = readFileSync(SCHEMA_PATH, 'utf8');
  const membershipTierBlock = extractEnumBlock(schemaSource, 'MembershipTier');
  const values = extractEnumValues(membershipTierBlock);

  // Canonical coverage: all 6 canonical tiers present, nothing else.
  assert.deepEqual(
    [...values].sort(),
    [...CANONICAL_TIERS].sort(),
    `MembershipTier enum must contain exactly the 6 canonical values. Got: ${JSON.stringify(values)}`,
  );

  // Negative space: no retired value appears.
  for (const retired of RETIRED_TIERS) {
    // Exact-token match against the enum values list. `DIAMOND` as a
    // standalone enum value is a retirement violation; `VIP_DIAMOND` is
    // a separate token and passes.
    assert.equal(
      values.includes(retired),
      false,
      `retired MembershipTier value "${retired}" reappeared in prisma/schema.prisma — policy §1.1 violation`,
    );
  }

  // Explicit positive check: VIP_DIAMOND (canonical) must be present so the
  // regex scoping above cannot silently drop it.
  assert.equal(
    values.includes('VIP_DIAMOND'),
    true,
    'canonical VIP_DIAMOND tier missing from MembershipTier enum',
  );

  console.log(
    `MEMB-001 negative-space guardrail PASSED — MembershipTier = [${values.join(', ')}]`,
  );
}

runGuardrail();
