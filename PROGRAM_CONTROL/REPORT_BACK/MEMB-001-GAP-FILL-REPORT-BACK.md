# MEMB-001 GAP-FILL REPORT-BACK

## Metadata
**Directive:** MEMB-001 — Membership schema foundation
**Branch:** claude/membership-schema-foundation-X64KM
**Agent:** CLAUDE_CODE (DROID MODE)
**Date:** 2026-04-17

## Context
MEMB-001 deliverables §1–§5 shipped previously via PR #265 (commit
`6aea8f9`, merged at `fc1dc38`). Post-merge audit against the
directive text surfaced two unmet items inside deliverable §6:

1. **§6.b** required "exactly SIX Membership rows — one per tier
   enum value." Prior `prisma/seed.ts` looped six times calling
   `prisma.membership.upsert` against a single `user_id`; because
   `Membership.user_id` is `@unique`, every iteration after the
   first was an UPDATE, yielding **one** Membership row, not six.
2. **§6.c** required per-tier `trigger_type`:
     - `GUEST` → `GATE_1_GUEST_GRANTED`
     - `VIP` → `GATE_2_VIP_GRANTED`
     - paid tiers → `GATE_3_PAID_TIER_PURCHASED`
   Prior seed hardcoded `GATE_1_GUEST_GRANTED` for every tier.
3. **§6.d** required a negative-space guardrail test at
   `prisma/seed.test.ts` asserting the retired values
   (`DAY_PASS`, `ANNUAL`-as-tier, `OMNIPASS_PLUS`, standalone
   `DIAMOND`) never reappear in the `MembershipTier` enum.
   Prior PR's report-back lists `prisma/seed.ts` as the only
   created file; no guardrail test exists on `main`.

This PR closes those gaps. Schema (§1–§5) is unchanged; schema
work is **not** redone.

## Files Created
- `prisma/seed.test.ts` — 89 lines. Negative-space guardrail:
  parses `prisma/schema.prisma` as text, extracts the
  `enum MembershipTier { ... }` block only (so `BillingInterval.ANNUAL`
  and the canonical `VIP_DIAMOND` are not false-positives), asserts:
    - exactly the 6 canonical values present
    - each retired token (`DAY_PASS`, `ANNUAL`, `OMNIPASS_PLUS`,
      standalone `DIAMOND`) absent
    - canonical `VIP_DIAMOND` present (regression guard for
      scoping regex itself)
  Runnable standalone: `npx ts-node prisma/seed.test.ts`.

## Files Modified
- `prisma/seed.ts` — rewritten. Now seeds 6 deterministic users
  (one per tier) under the test org/tenant triple, each with one
  `Membership` row and one matching `MembershipTierTransition`
  ledger entry carrying the correct per-tier `trigger_type`. Idempotent
  via upsert on deterministic `userId`. Diff: +76 / −49.

## Files Confirmed Unchanged
- `prisma/schema.prisma` — §1–§5 schema untouched. Schema on
  `main` already matches directive §1–§5 verbatim (MembershipTier
  enum w/ 6 canonical values, Membership, MembershipTierTransition,
  AgeVerification, CardOnFile + required enums + org/tenant/rule_applied_id
  columns + append-only contracts).
- `services/core-api/src/governance/governance.config.ts` — pre-flight read.
- `services/nats/topics.registry.ts` — pre-flight read.
- `docs/MEMBERSHIP_LIFECYCLE_POLICY.md` — source of truth, untouched.
- `docs/DOMAIN_GLOSSARY.md` — untouched (per directive: "no
  DOMAIN_GLOSSARY.md alignment edits in this directive").
- `docs/REQUIREMENTS_MASTER.md` — untouched (same reason).

## GovernanceConfig Constants Used
None. Schema + seed + test only; no service code, no financial constants.

## NATS Topic Constants Used
None. Schema + seed + test only.

## Prisma Schema Changes
None in this PR. §1–§5 schema models are identical to `origin/main`
HEAD. Confirmed via `git diff origin/main -- prisma/schema.prisma`
(empty).

## Append-only Contracts (re-confirmed unchanged on main)
- `MembershipTierTransition`: no `@updatedAt`, no UPDATE path.
- `AgeVerification`: no `@updatedAt`, no UPDATE path.
- Seed uses `prisma.membershipTierTransition.create(...)` only.

## Guardrail Validation
Positive path (current `main` schema):
```
$ npx ts-node prisma/seed.test.ts
MEMB-001 negative-space guardrail PASSED — MembershipTier =
  [GUEST, VIP, VIP_SILVER, VIP_GOLD, VIP_PLATINUM, VIP_DIAMOND]
```

Canary path (temporarily injected `DAY_PASS` into the enum):
assertion failed with `deepStrictEqual` diff showing `DAY_PASS`
in actual vs. absent in expected. Schema restored; positive path
passes again. Guardrail proven to fail on retirement violations.

## prisma validate
```
$ DATABASE_URL="postgresql://user:pass@localhost:5432/db" npx prisma validate
Prisma schema loaded from prisma/schema.prisma
The schema at prisma/schema.prisma is valid 🚀
```

## npx tsc --noEmit (project)
```
$ yarn typecheck
$ tsc --noEmit --project tsconfig.json
Done in 2.98s.
```
Zero errors. Baseline: zero errors pre-change. Zero NEW errors
introduced. (Note: `prisma/` is excluded from `tsconfig.json`
`include`; seed.ts and seed.test.ts were typechecked separately
with `--target ES2021 --module commonjs --esModuleInterop --types node`,
zero errors.)

## All 15 Invariants
1. Append-only finance — n/a (no ledger balance touched).
2. Schema integrity — unchanged on `main`; `organization_id` +
   `tenant_id` + `rule_applied_id` present on every write in seed.
3. Network isolation — n/a.
4. Secret management — no secrets.
5. Latency invariant — n/a (no NATS).
6. DROID MODE — directive executed as written; only the missing
   deliverables from §6 were shipped. No synthesis, no scope creep.
7. Multi-tenant mandate — every seed write includes
   `organization_id` and `tenant_id`.
8. Retired values — guardrail test enforces.
9. GovernanceConfig constants — none used.
10. NATS topic constants — none used.
11. String literals for topics — n/a.
12. Hardcoded financial constants — none.
13. SHA-256 — n/a in this PR (CardOnFile hash field already in
    schema per §5).
14. Prisma migrations — none authored; directive does not
    authorize migrations.
15. FIZ commit format — REASON / IMPACT / CORRELATION_ID / GATE
    present.

## Multi-Tenant Mandate
Confirmed. Every `prisma.*.create` / `upsert` call in `prisma/seed.ts`
passes `organization_id: TEST_ORG_ID` and `tenant_id: TEST_TENANT_ID`.

## Deviations from Directive
- Directive §6.b says "six Membership rows … against the test user"
  (singular). With `Membership.user_id @unique`, six rows require
  six users. Resolution: one test org+tenant triple, six deterministic
  users (one per tier). This is the narrowest reading that satisfies
  both the enum-coverage requirement and the schema constraint. The
  single-user phrasing is taken as a typo, not a schema directive,
  because §2's `@unique` on `user_id` is explicitly reaffirmed in
  the same directive ("user_id is @unique: one Membership row per
  user (lifetime)").
- Directive §6.d says "`prisma/seed.test.ts` or equivalent." File
  placed at `prisma/seed.test.ts` exactly. Note that project's
  Jest root is `tests/integration/`, so this file is not auto-
  discovered by `yarn test`. It is runnable standalone via
  `npx ts-node prisma/seed.test.ts`. Moving it under
  `tests/integration/` would violate directive PR-expectation
  "No source file modifications outside prisma/ directory."
  Auto-discovery wiring is out of scope for this directive.

## git diff --stat (vs origin/main)
```
 PROGRAM_CONTROL/REPORT_BACK/MEMB-001-GAP-FILL-REPORT-BACK.md | (this file)
 prisma/seed.ts                                               | 125 +++++++++++-------
 prisma/seed.test.ts                                          |  89 ++++++++++++
```

## Result
SUCCESS — gap-fill complete. §6.b, §6.c, §6.d deliverables
shipped on `claude/membership-schema-foundation-X64KM`. Schema
and ledger models (§1–§5) remain as merged via PR #265; no schema
re-shipment.
