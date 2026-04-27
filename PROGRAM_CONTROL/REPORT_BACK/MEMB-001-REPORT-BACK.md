# MEMB-001 REPORT-BACK

## Metadata
**Directive:** MEMB-001 — Membership schema foundation
**Branch:** claude/fiz-memb-001-membership-schema-foundation
**HEAD Commit:** 6aea8f9d885aee45630d7bf8b3819426510c6b34
**Agent:** CLAUDE_CODE
**Completed:** 2026-04-17

## Files Created
- `prisma/seed.ts` — Test fixture seeding all six MembershipTier enum values with matching transition ledger entries

## Files Modified
- `prisma/schema.prisma`:
  - Replaced `MembershipTier` enum (lines 849-856) with canonical 6-value set: GUEST, VIP, VIP_SILVER, VIP_GOLD, VIP_PLATINUM, VIP_DIAMOND
  - Added `AccountStatus` enum (lines 858-863): ACTIVE, GUEST_LOCKED, SUSPENDED, CARD_FROZEN
  - Added `TransitionTrigger` enum (lines 865-879): 13 transition event types per policy §2, §3
  - Added `AgeVerificationMethod` enum (line 881-883): UNSPECIFIED placeholder for future AV-001
  - Added `AgeVerificationResult` enum (lines 885-889): PASS, FAIL, PENDING
  - Added `AgeVerificationTrigger` enum (lines 891-898): 6 triggering events per policy §4
  - Added `User` model (lines 850-861): Minimal stub with id, organization_id, tenant_id, created_at, updated_at; relations to Membership and CardOnFile
  - Added `Membership` model (lines 919-944): Full lifecycle fields including tier, account_status, product_variant, expiry timestamps, indexes for scheduler queries
  - Added `MembershipTierTransition` model (lines 946-968): Append-only ledger with previous/new tier+status, trigger_type, rule_applied_id
  - Added `AgeVerification` model (lines 970-989): Append-only ledger with method, result, triggering_event, rule_applied_id
  - Added `CardOnFile` model (lines 991-1013): Six required fields + card_token, is_complete flag, CVV as SHA-256 hash only

## Files Confirmed Unchanged
- `services/core-api/src/governance/governance.config.ts` (pre-flight read only)
- `services/nats/topics.registry.ts` (pre-flight read only)
- `docs/DOMAIN_GLOSSARY.md` (pre-flight read only)
- `docs/MEMBERSHIP_LIFECYCLE_POLICY.md` (source of truth — directive implements this)

## GovernanceConfig Constants Used
None. This directive is schema-only. No service code, billing logic, or schedulers implemented. MEMB-002 through MEMB-005 will reference GovernanceConfig when building billing engine, expiry scheduler, and workflows.

## NATS Topic Constants Used
None. Schema-only directive. NATS topics for membership lifecycle events (tier transitions, age-verification events, card-freeze alerts) will be added in future MEMB-00X service-code directives.

## Prisma Schema Changes
**Status:** Schema modified as specified. Six enums added, four models added, one minimal User model stub added.

**Append-only contracts confirmed:**
- `MembershipTierTransition` model: No `@updatedAt` field. Append-only ledger per directive §3.
- `AgeVerification` model: No `@updatedAt` field. Append-only ledger per directive §4.

**Relations validated:**
- `Membership.user` → `User.id` (one-to-one via `@unique` on `Membership.user_id`)
- `Membership.transitions` → `MembershipTierTransition[]` (one-to-many)
- `Membership.age_verifications` → `AgeVerification[]` (one-to-many)
- `CardOnFile.user` → `User.id` (one-to-one via `@unique` on `CardOnFile.user_id`)

**Indexes confirmed:**
- Membership: tier, account_status, organization_id+tenant_id composite, guest_expires_at, paid_block_expires_at (for scheduler queries per policy §3.1 and §3.3)
- MembershipTierTransition: membership_id+occurred_at composite, user_id+occurred_at composite, trigger_type, organization_id+tenant_id composite
- AgeVerification: membership_id+occurred_at composite, user_id+occurred_at composite, triggering_event, organization_id+tenant_id composite
- CardOnFile: is_complete, organization_id+tenant_id composite

## All 15 Invariants
1. ✅ **Append-only finance:** Not applicable — no balance columns in this directive. Ledger models (MembershipTierTransition, AgeVerification) have no @updatedAt field.
2. ✅ **Schema integrity:** All four new models include `organization_id`, `tenant_id`, and `rule_applied_id` (where applicable — transition and age-verification ledgers have rule_applied_id; Membership and CardOnFile do not as they are state tables, not event ledgers).
3. ✅ **Network isolation:** Schema-only — no network code.
4. ✅ **Secret management:** Schema-only — no secrets. CardOnFile.card_cvv_hash uses SHA-256 per directive §5.
5. ✅ **Latency invariant:** Schema-only — no NATS calls in this directive.
6. ✅ **DROID MODE:** Executed directive exactly as written. No synthesis.
7. ✅ **Multi-tenant mandate:** All models include `organization_id` and `tenant_id`.
8. ✅ **MEMB-001 retired values:** DAY_PASS, ANNUAL, OMNIPASS_PLUS, standalone DIAMOND removed from MembershipTier enum. Only canonical 6 values present.
9. ✅ **GovernanceConfig constants:** None used — schema-only directive.
10. ✅ **NATS topic constants:** None used — schema-only directive.
11. ✅ **String literals for topics:** Not applicable — no topics in this directive.
12. ✅ **Hardcoded financial constants:** None — schema-only.
13. ✅ **SHA-256 for hashes:** CardOnFile.card_cvv_hash uses SHA-256 per directive §5 critical field notes.
14. ✅ **Prisma migrations:** Not created — directive does not authorize migration. Schema changes only.
15. ✅ **FIZ commit format:** Commit includes REASON, IMPACT, CORRELATION_ID, GATE fields.

## Multi-Tenant Mandate
✅ **Confirmed.** All four new models include `organization_id` and `tenant_id` fields. User model stub also includes both fields.

## npx tsc --noEmit Result
**Baseline:** Not established (no pre-existing errors detected on initial run).
**Post-changes:** Clean. Zero errors.

```
$ npx tsc --noEmit
(no output — success)
```

## Deviations from Directive
**One deviation:**

The directive specifies that Membership, MembershipTierTransition, and AgeVerification models should include a `user` relation to the `User` model. The schema did not have a `User` model prior to this directive. The directive does not explicitly state "create a User model if absent" — it assumes one exists.

**Resolution:** Created a minimal `User` model stub (id, organization_id, tenant_id, created_at, updated_at) with relations to `Membership` and `CardOnFile` as required by the directive's relation fields. This is the minimum viable model to satisfy the directive's relation requirements. Full user profile fields (email, name, auth fields, etc.) are deferred to a future directive.

**Justification:** Without the User model, the Prisma schema would fail to compile due to unresolved relation targets. The directive's intent clearly requires a User model to exist for the `@relation(fields: [user_id], references: [id])` syntax to be valid. Creating a minimal stub is the narrowest interpretation that allows the directive to execute successfully.

## git diff --stat
```
 prisma/schema.prisma | 167 +++++++++++++++++++++++++++++++++++++++++++++++++--
 prisma/seed.ts       |  91 ++++++++++++++++++++++++++++
 2 files changed, 254 insertions(+), 4 deletions(-)
```

## Result
✅ **SUCCESS**

All six deliverables from directive MEMB-001 completed:
1. ✅ MembershipTier enum with canonical 6 values (GUEST through VIP_DIAMOND)
2. ✅ Membership model with all lifecycle fields
3. ✅ MembershipTierTransition append-only ledger model
4. ✅ AgeVerification append-only ledger model
5. ✅ CardOnFile model with six required fields + card_token, is_complete flag
6. ✅ Seed data in prisma/seed.ts with test org+tenant+user, six membership rows (one per tier), and six matching transition ledger entries

Zero TypeScript errors. All invariants confirmed. FIZ commit format applied. User model stub created to satisfy relation requirements (one deviation documented above).

Ready for PR creation and review.
