# DFSP-001 — BLOCKED Report-Back

**Directive:** DFSP-001 — Platform OTP + Account Recovery Hold
**Branch:** `claude/droid-mode-dfsp-001-jiqVt`
**Mode:** DROID
**Status:** BLOCKED before code changes
**Date:** 2026-04-15 (America/Toronto)
**Author:** Claude Code (Coding Engineer)

---

## Blocker Summary

The directive mandates bcrypt for `OtpEvent.code_hash` storage and verification
(Module 3 — PlatformOtpService). The `bcrypt` package is **not installed** in
this repository. Implementing the directive as written requires modifying
`package.json` and `yarn.lock` to add the dependency, which is outside the
scope authorized by the directive's Scope Discipline section.

I am halting before any code changes and filing this blocking report-back
per the fallback path in DROID MODE STEP 2. The STEP 2 (a)–(d) preconditions
all pass; this gap is an implementation-time blocker that emerges at STEP 3.

---

## STEP 2 Precondition Verification

All four STEP 2 preconditions pass:

| Check | Result | Evidence |
| --- | --- | --- |
| (a) `services/core-api/src/dfsp/dfsp.module.ts` exists & read | ✅ PASS | Read. Registers five PV-001 services; no DFSP-001 services yet. |
| (b) `services/core-api/src/governance/governance.config.ts` read | ✅ PASS | `DFSP_OTP_TTL_SECONDS: 900` ✅ present; `DFSP_ACCOUNT_RECOVERY_HOLD_HOURS: 48` ✅ present; `DFSP_OTP_MAX_ATTEMPTS: 5` ✅ **already present** (directive says ADD IF ABSENT); `DFSP_OTP_BCRYPT_COST` ❌ absent — additive insert required. |
| (c) `services/nats/topics.registry.ts` read | ✅ PASS | All six topics registered: `DFSP_OTP_ISSUED`, `DFSP_OTP_VERIFIED`, `DFSP_OTP_FAILED`, `DFSP_OTP_EXPIRED`, `DFSP_ACCOUNT_HOLD_APPLIED`, `DFSP_ACCOUNT_HOLD_RELEASED`. |
| (d) `prisma/schema.prisma` OtpEvent + AccountHold present | ✅ PASS | `OtpEvent` at line 391 — columns: `code_hash`, `failed_attempts`, `status`, `used_at`, `organization_id`, `tenant_id`, etc. `AccountHold` at line 408 — columns: `trigger_type`, `triggered_at`, `hold_until`, `released_at`, `identity_reverified`, etc. No schema change needed. |

No STEP 2 blocker. The blocker is at STEP 3 (implementation).

---

## The Blocker (Implementation-Time)

The directive's Module 3 implementation requirements specify bcrypt as the
hashing primitive for OTP storage:

> **Hash with bcrypt at cost `GovernanceConfig.DFSP_OTP_BCRYPT_COST`**
> **Store hash in `OtpEvent.code_hash` — never store plaintext**
> ...
> **Hash inbound candidate with bcrypt.compare() against stored hash**

The directive also enforces Invariant #13 as a bcrypt carve-out for this
column specifically.

### Repo state (verified)

- `package.json` — no `bcrypt`, no `bcryptjs`, no `@node-rs/bcrypt`,
  no `argon2`. Root dependency list: `@nestjs/bull`, `@nestjs/common`,
  `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/typeorm`,
  `@prisma/client`, `bull`, `decimal.js`, `nats`, `reflect-metadata`,
  `rxjs`, `typeorm`.
- `yarn.lock` — zero `bcrypt*` entries (confirmed via grep-count).
- `node_modules/` — no `bcrypt`, `bcryptjs`, `@types/bcrypt`, or
  `@types/bcryptjs` directories.
- `services/vision-monitor/package.json` — no bcrypt variant.

### Why this blocks STEP 3/4

1. Importing `bcrypt` from a service file without installing it fails
   `npx tsc --noEmit`, which STEP 4 mandates be clean before any commit.
2. Scope Discipline forbids touching files outside:
   - `services/core-api/src/dfsp/`
   - `services/core-api/src/governance/governance.config.ts`
   - `PROGRAM_CONTROL/REPORT_BACK/`
3. `package.json` and `yarn.lock` are not in the authorized scope.
4. Substituting SHA-256 or any other primitive violates the directive's
   explicit Invariant #13 carve-out language and Module 3 Implementation
   Requirements.

### Collateral observation (non-blocking)

`DFSP_OTP_MAX_ATTEMPTS: 5` is already present at
`services/core-api/src/governance/governance.config.ts:26`. The directive
lists it as "ADD IF ABSENT: default 5". Consistent with "additive only" —
no change required to that constant.

Only `DFSP_OTP_BCRYPT_COST` is actually absent; this would be the lone
governance addition under the normal path.

---

## Proposed Resolution Paths (decision belongs to Claude Chat / CEO)

**Option A — Expand directive scope to authorize dependency addition.**
Amend DFSP-001 Scope Discipline to permit `package.json` and `yarn.lock`
modification solely for adding `bcrypt` (+ `@types/bcrypt`). A brief
CHORE or INFRA sub-directive could land the dependency first, after which
DFSP-001 resumes as written with zero scope change.

**Option B — Install bcrypt via a separate CHORE directive before DFSP-001
resumes.** Cleanest audit trail. CHORE adds `bcrypt` + `@types/bcrypt`
and runs `yarn install`. Then DFSP-001 executes unchanged against the
enlarged dependency set.

**Option C — Substitute `@node-rs/bcrypt`** (pure-Rust NAPI binding, drop-in
API). Same governance concern — still a `package.json` edit.

**Option D — Change the Module 3 hashing primitive.** Requires directive
amendment, DFSP Engineering Spec revision, and a fresh Invariant #13
carve-out justification. Highest governance cost; not recommended unless
a supply-chain reason rules out bcrypt.

I am not self-selecting any option. Awaiting Claude Chat / CEO direction.

---

## No Code Changes Made

- **Files created:** none (outside this BLOCKED report-back).
- **Files modified:** none.
- **Commits staged:** none.
- **Commits made:** none.
- **`prisma/schema.prisma`** — untouched (confirmed unchanged).
- **`services/nats/topics.registry.ts`** — untouched (confirmed unchanged).
- **`services/core-api/src/dfsp/dfsp.module.ts`** — untouched.
- **`services/core-api/src/governance/governance.config.ts`** — untouched
  (no `DFSP_OTP_BCRYPT_COST` added yet; will be added additively when the
  directive resumes).
- **`package.json` / `yarn.lock`** — untouched.

---

## HANDOFF

**Built:** Nothing — halted at STEP 2→3 boundary on a hard dependency gap.
**Left incomplete:** All DFSP-001 implementation (both services, dfsp.module
registration, `DFSP_OTP_BCRYPT_COST` addition, invariant sweep, FIZ commit,
standard report-back).
**Next agent's first task:** Claude Chat decides resolution path (A–D above).
If A or B, a CHORE directive installs `bcrypt` + `@types/bcrypt` (yarn add).
Once the dependency is resolvable, reissue DFSP-001 to a fresh DROID session
— preconditions (a)–(d) will still pass, bcrypt import will now typecheck,
and the directive executes as written. No other blockers identified.

---

## Appendix — Verified Facts

- Branch: `claude/droid-mode-dfsp-001-jiqVt` (per directive).
- Current repo `package.json` bcrypt grep: zero matches.
- Current repo `yarn.lock` bcrypt grep-count: `0`.
- `OtpEvent.code_hash` schema column type: `String` — bcrypt output fits
  without any schema change (directive's own note at line 71–73 of
  `PROGRAM_CONTROL/DIRECTIVES/QUEUE/DFSP-001.md`).
- Existing DFSP service conventions observed (for use once unblocked):
  `@Injectable()` + `Logger(ServiceName.name)` + `RULE_ID` constant,
  `PrismaService` from `../prisma.service`, `NatsService` from
  `../nats/nats.service`, `NATS_TOPICS` from `../../../nats/topics.registry`,
  `GovernanceConfig` from `../governance/governance.config`. `NatsService`
  already exposes `subscribe(topic, handler)` — Module 4 coupling to
  `DFSP_OTP_FAILED` is trivially wireable once bcrypt is resolved.
