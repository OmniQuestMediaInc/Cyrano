// prisma/seed.ts
// MEMB-001: Membership schema foundation seed data
// Seeds a test organization + tenant + six users (one per MembershipTier enum value),
// each with one Membership row and a matching MembershipTierTransition ledger entry.
//
// Rationale: Membership.user_id is @unique (one Membership per user, lifetime) per
// directive MEMB-001 §2. To satisfy "exactly SIX Membership rows — one per tier enum
// value" (§6.b), we seed six distinct users under a single test org+tenant triple.
// This is enum-coverage validation, not realistic user data.

import { PrismaClient, MembershipTier, TransitionTrigger } from '@prisma/client';

const prisma = new PrismaClient();

const TEST_ORG_ID = '00000000-0000-0000-0000-000000000001';
const TEST_TENANT_ID = '00000000-0000-0000-0000-000000000002';

// Deterministic per-tier user IDs so the seed is idempotent across runs.
const TIER_FIXTURES: ReadonlyArray<{
  userId: string;
  tier: MembershipTier;
  trigger: TransitionTrigger;
}> = [
  {
    userId: '00000000-0000-0000-0000-000000000011',
    tier: 'GUEST',
    trigger: 'GATE_1_GUEST_GRANTED',
  },
  {
    userId: '00000000-0000-0000-0000-000000000012',
    tier: 'VIP',
    trigger: 'GATE_2_VIP_GRANTED',
  },
  {
    userId: '00000000-0000-0000-0000-000000000013',
    tier: 'VIP_SILVER',
    trigger: 'GATE_3_PAID_TIER_PURCHASED',
  },
  {
    userId: '00000000-0000-0000-0000-000000000014',
    tier: 'VIP_GOLD',
    trigger: 'GATE_3_PAID_TIER_PURCHASED',
  },
  {
    userId: '00000000-0000-0000-0000-000000000015',
    tier: 'VIP_PLATINUM',
    trigger: 'GATE_3_PAID_TIER_PURCHASED',
  },
  {
    userId: '00000000-0000-0000-0000-000000000016',
    tier: 'VIP_DIAMOND',
    trigger: 'GATE_3_PAID_TIER_PURCHASED',
  },
];

async function main() {
  console.log('Starting MEMB-001 seed...');

  for (const fixture of TIER_FIXTURES) {
    const user = await prisma.user.upsert({
      where: { id: fixture.userId },
      update: {},
      create: {
        id: fixture.userId,
        organization_id: TEST_ORG_ID,
        tenant_id: TEST_TENANT_ID,
      },
    });

    const membership = await prisma.membership.upsert({
      where: { user_id: user.id },
      update: {
        tier: fixture.tier,
        account_status: 'ACTIVE',
        organization_id: TEST_ORG_ID,
        tenant_id: TEST_TENANT_ID,
      },
      create: {
        user_id: user.id,
        tier: fixture.tier,
        account_status: 'ACTIVE',
        organization_id: TEST_ORG_ID,
        tenant_id: TEST_TENANT_ID,
      },
    });

    console.log(`Seeded ${fixture.tier} membership for user ${user.id}`);

    await prisma.membershipTierTransition.create({
      data: {
        membership_id: membership.id,
        user_id: user.id,
        previous_tier: null,
        new_tier: fixture.tier,
        previous_status: null,
        new_status: 'ACTIVE',
        trigger_type: fixture.trigger,
        actor_id: null,
        rule_applied_id: 'MEMB-001-SEED-DATA',
        organization_id: TEST_ORG_ID,
        tenant_id: TEST_TENANT_ID,
      },
    });

    console.log(`Seeded ${fixture.trigger} transition for ${fixture.tier}`);
  }

  console.log('MEMB-001 seed complete — 6 users, 6 memberships, 6 transitions.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
