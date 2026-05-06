# DIRECTIVE: STUDIO-AFF-001-IMPL

**Status:** `QUEUED`
**Commit prefix:** `FIZ:`
**Target paths:**

- `services/studio-affiliation/src/studio.service.ts` (UPDATE — replace
  the Phase 1 NotImplementedException stub with a working implementation)
- `services/studio-affiliation/src/affiliation-number.generator.ts` (CREATE)
- `prisma/migrations/<TIMESTAMP>_studio_affiliation_indexes/migration.sql`
  (CREATE — DB CHECK on affiliation_number length range, idempotent
  unique index)

**Risk class:** R2 (creator-onboarding boot path)

## Context

Phase 1 hygiene authored a minimal `StudioService` so the
`CreatorOnboardingModule` can boot — `findByAffiliationNumber()` is a real
Prisma read, but `affiliate()` throws `NotImplementedException`. This
directive completes the implementation.

## Tasks

1. **AffiliationNumberGenerator**:
   - Generate 6–9 char uppercase alphanumeric strings using only `A-Z`
     and `2-9` (exclude `0`, `1`, `O`, `I` per schema comment).
   - Collision-resistant: pick length proportional to current studio
     count; retry on unique-violation up to 5 attempts before erroring.

2. **`StudioService.affiliate()`** — full implementation:
   - Open a Prisma `$transaction`.
   - When `existing_studio_id` is given:
     - Verify `studio.status === 'ACTIVE'`.
     - Insert `StudioAffiliation` row.
   - When `studio_name` is given:
     - Generate affiliation number.
     - Insert `Studio` row with `status = 'PENDING'`.
     - Insert founder `StudioAffiliation` row with `role = 'OWNER'`.
   - Stamp every row with `correlation_id`, `reason_code`,
     `rule_applied_id`, `organization_id`, `tenant_id`.
   - Emit `nats.studios.affiliated` event with redacted payload.

3. **DB CHECK + idempotency** (migration):
   - `ALTER TABLE studios ADD CONSTRAINT chk_aff_num_len CHECK
(length(affiliation_number) BETWEEN 6 AND 9)`.
   - `CREATE UNIQUE INDEX IF NOT EXISTS uq_studios_aff_num ON studios
(affiliation_number)` (already declared in Prisma; verify SQL is
     idempotent).

## Validation

- New unit spec for the generator (1k iterations, no collisions, no
  forbidden chars).
- New integration spec covers both branches (existing + new studio).
- `yarn typecheck && yarn lint && yarn test` clean.

## FIZ NOTE

Every row touched by `affiliate()` is governance-bearing. The commit MUST
include `FIZ:` prefix and the canonical REASON / IMPACT / CORRELATION_ID
trailer. The transaction must be all-or-nothing — no partial studio
without a founder affiliation, no partial affiliation without a studio.

## Report-back file

`PROGRAM_CONTROL/REPORT_BACK/STUDIO-AFF-001-IMPL.md`
