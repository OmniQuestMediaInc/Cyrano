# DFSP-001 — Platform OTP + Account Recovery Hold

**Directive ID:** DFSP-001
**Backlog:** CLAUDE_CODE_BACKLOG_v6.md (v6.1)
**Gate:** PROC-001 ✅ on main `0aa416c` PR#190 |
          GOV-FINTRAC + GOV-AGCO — CEO-AUTHORIZED-STAGED-2026-04-11 ✅
**Status:** QUEUED — gates cleared, ready for execution
**Agent:** CLAUDE_CODE
**Parallel-safe:** NO
**Touches:** services/core-api/src/dfsp/platform-otp.service.ts, services/core-api/src/dfsp/account-recovery-hold.service.ts, services/core-api/src/dfsp/dfsp.module.ts, services/core-api/src/governance/governance.config.ts
**Mode:** DROID
**FIZ:** YES — four-line commit format required
**Type:** FIZ — scoped financial infrastructure
**Risk class:** R0

---

## Objective

Implement DFSP Modules 3 and 4. These modules are tightly coupled —
Module 4 auto-triggers on Module 3 failure threshold.

- **Module 3 — PlatformOtpService**
  `services/core-api/src/dfsp/platform-otp.service.ts` (CREATE)
  Platform-native dual-channel OTP for Diamond/VIP step-up auth.

- **Module 4 — AccountRecoveryHoldService**
  `services/core-api/src/dfsp/account-recovery-hold.service.ts` (CREATE)
  48-hour security hold triggered by contact-info swap attacks or
  5 consecutive OTP failures during a high-value transaction.

---

## Gate Status

PROC-001 prerequisite: ✅ SATISFIED — merged to main as `0aa416c` PR#190
  - No controller/ledger coupling landed with PROC-001
  - Gate constraints preserved through merge

GOV-FINTRAC: ✅ CEO-AUTHORIZED-STAGED — 2026-04-11
GOV-AGCO: ✅ CEO-AUTHORIZED-STAGED — 2026-04-11

Both gates cleared via PROGRAM_CONTROL/CLEARANCES/CEO-AUTHORIZED-STAGED-2026-04-11.md.
DFSP-001 may proceed.

---

## Scope

### Files to Create
services/core-api/src/dfsp/platform-otp.service.ts
services/core-api/src/dfsp/account-recovery-hold.service.ts

### Files to Modify
- `services/core-api/src/dfsp/dfsp.module.ts`
  — import and register both new services
- `services/core-api/src/governance/governance.config.ts`
  — add constants listed below if not already present

### Files to Confirm Unchanged
- `prisma/schema.prisma` — NO changes. OtpEvent + AccountHold models
  already exist from PV-001. Do not create migrations.
- `services/nats/topics.registry.ts` — NO changes. All required NATS
  topics already added in PR#192. Use existing constants only.

---

## Prisma Models — Confirmed from PV-001 (READ ONLY)

**OtpEvent** (line 391 in schema.prisma):
id, account_id, transaction_id, code_hash, channel,
issued_at, expires_at, used_at, failed_attempts, status,
organization_id, tenant_id
- `code_hash` — String column; bcrypt output fits with no schema change
- `failed_attempts` — ready for 5-consecutive-failure counter
- Multi-tenant enforced ✅

**AccountHold** (line 408 in schema.prisma):
id, account_id, trigger_type, trigger_transaction_id,
triggered_at, hold_until, released_at, released_by,
release_reason, identity_reverified,
organization_id, tenant_id
- `trigger_type` — String enum values at service level:
  "contact_change" | "otp_5_fail" | "agent_flag"
- `identity_reverified` — present for Module 4 release gate ✅
- Multi-tenant enforced ✅

**DO NOT fabricate new migrations. Schema is complete.**

---

## GovernanceConfig Constants Required

Confirm these exist. Add any that are absent — additive only:
DFSP_OTP_TTL_SECONDS          — already present (900 = 15 min) ✅
DFSP_OTP_BCRYPT_COST          — ADD IF ABSENT: default 12
DFSP_OTP_MAX_ATTEMPTS         — ADD IF ABSENT: default 5
DFSP_ACCOUNT_RECOVERY_HOLD_HOURS — already present (48) ✅

---

## NATS Topics — All Pre-registered on Main (PR#192)

Use these exact constant names. Do not use string literals.
```typescript
NATS_TOPICS.DFSP_OTP_ISSUED
NATS_TOPICS.DFSP_OTP_VERIFIED
NATS_TOPICS.DFSP_OTP_FAILED
NATS_TOPICS.DFSP_OTP_EXPIRED
NATS_TOPICS.DFSP_ACCOUNT_HOLD_APPLIED
NATS_TOPICS.DFSP_ACCOUNT_HOLD_RELEASED
```

---

## Implementation Requirements

### Module 3 — PlatformOtpService

**OTP Alphabet:**
```typescript
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 chars
// Excluded: O, 0, I, 1, L — ambiguous characters
```
32 characters gives clean power-of-two indexing.
Adjust to 30-char if spec requires exactly — document choice in code.

**OTP Generation:**
- Use `crypto.randomInt(0, ALPHABET.length)` to index into alphabet
- 7 characters total
- Format for display: XXXXXX-Y (hyphen after char 6 — display only)
- Store as 7-char string without hyphen before hashing
- Hash with bcrypt at cost `GovernanceConfig.DFSP_OTP_BCRYPT_COST`
- Store hash in `OtpEvent.code_hash` — never store plaintext
- Set `expires_at` = now + `GovernanceConfig.DFSP_OTP_TTL_SECONDS`
- Set `failed_attempts` = 0 on creation
- Emit `NATS_TOPICS.DFSP_OTP_ISSUED` on every generation

**Invariant #4 note:** `crypto.randomInt()` satisfies Invariant #4
and is the correct primitive here. Do not use `crypto.randomBytes()`.

**Invariant #13 carve-out:** `OtpEvent.code_hash` uses bcrypt
(cost from `GovernanceConfig.DFSP_OTP_BCRYPT_COST`) per DFSP
Engineering Spec v1.0 Module 3. Bcrypt is required here because
SHA-256 is GPU-brute-forceable against a constrained OTP space on
DB breach. Invariant #13 SHA-256 requirement continues to apply to
all other hash operations in this and all other services.

**OTP Verification:**
- Hash inbound candidate with bcrypt.compare() against stored hash
- Check expiry: `expires_at` < now → EXPIRED
- Check status: already consumed → ALREADY_CONSUMED
- Check failed_attempts: ≥ `GovernanceConfig.DFSP_OTP_MAX_ATTEMPTS`
  → INVALID (locked)
- On failure: increment `failed_attempts` on OtpEvent record
- On success: set `used_at` = now, set status = CONSUMED (append-
  pattern — write new state, do not UPDATE existing row if schema
  supports append; if OtpEvent uses UPDATE for status, this is the
  documented exception per PV-001 schema design)
- Emit appropriate NATS topic on every outcome
- Every result object must include `rule_applied_id`

**Verification result codes:**
VERIFIED | INVALID | EXPIRED | ALREADY_CONSUMED

**Delivery channels (stub — email provider is V6 infra):**
email_primary | email_secondary | sms_secondary
Log channel on OtpEvent. Do not implement actual delivery — stub only.

---

### Module 4 — AccountRecoveryHoldService

**Trigger conditions:**
- Contact-information change attempt during active Diamond transaction
- 5 consecutive OTP failures for a given account_id
- Agent flag

**Module 3 → Module 4 coupling:**
- AccountRecoveryHoldService subscribes to `NATS_TOPICS.DFSP_OTP_FAILED`
- On receipt: check `OtpEvent.failed_attempts` for the account_id
- Trigger threshold: `failed_attempts` ≥ `GovernanceConfig.DFSP_OTP_MAX_ATTEMPTS`
- Failure counter window: counter resets on `DFSP_OTP_VERIFIED` event
  OR on OTP TTL expiry — whichever comes first
- Do not trigger if an active hold already exists for the account

**Hold placement (append-only):**
- Write new AccountHold record
- Set `triggered_at` = now (America/Toronto)
- Set `hold_until` = now + `GovernanceConfig.DFSP_ACCOUNT_RECOVERY_HOLD_HOURS`
- Set `trigger_type` per trigger condition
- Set `organization_id` + `tenant_id` — mandatory
- Emit `NATS_TOPICS.DFSP_ACCOUNT_HOLD_APPLIED`
- Result object includes `rule_applied_id`

**During hold — service must enforce:**
purchases:        BLOCKED
gifting:          BLOCKED
withdrawals:      BLOCKED
login:            PERMITTED (read-only)
settings changes: BLOCKED
active transaction on trigger: CANCELLED

**Hold release requirements (all three must be satisfied):**
1. `identity_reverified` = true
2. `hold_until` elapsed
3. Agent sign-off

**CEO approval required** to shorten hold below 48 hours.
Do not implement a shortening path — note it as a deferred
directive requiring CEO authorization at execution time.

**Hold release (append-only):**
- Write release record — do not UPDATE original hold row
- Set `released_at` = now (America/Toronto)
- Set `released_by`, `release_reason`, `identity_reverified`
- Emit `NATS_TOPICS.DFSP_ACCOUNT_HOLD_RELEASED`
- Result object includes `rule_applied_id`

**Result codes:**
HOLD_PLACED | HOLD_RELEASED | HOLD_NOT_FOUND |
ALREADY_HELD | RELEASE_CONDITIONS_NOT_MET

---

## Invariant Checklist (all 15)

Before committing, Claude Code must verify:
- [ ] 1. No UPDATE/DELETE on ledger/audit/game/call/voucher tables —
       OtpEvent status update is the documented exception per PV-001
       schema; all other tables strictly append-only
- [ ] 2. FIZ four-line commit format — REASON/IMPACT/CORRELATION_ID/GATE
- [ ] 3. No hardcoded constants — all values from GovernanceConfig
- [ ] 4. crypto.randomInt() used for OTP generation — Math.random()
       prohibited — crypto.randomBytes() also prohibited here
- [ ] 5. No @angular/core imports
- [ ] 6. npx tsc --noEmit zero new errors before commit
- [ ] 7. Logger instance on every service
- [ ] 8. Report-back filed before DONE
- [ ] 9. NATS topics from NATS_TOPICS.DFSP_OTP_* and
       NATS_TOPICS.DFSP_ACCOUNT_HOLD_* only — no string literals
- [ ] 10. AI services advisory only — no financial execution
          (N/A — these are infrastructure services)
- [ ] 11. Step-up auth boundary — OTP service generates/verifies only;
          does not itself authorize financial actions
- [ ] 12. RBAC check confirmed upstream before OTP is issued
- [ ] 13. SHA-256 for all hash operations EXCEPT OtpEvent.code_hash
          which uses bcrypt per documented carve-out above
- [ ] 14. All timestamps in America/Toronto
- [ ] 15. rule_applied_id on every output object:
          'PLATFORM_OTP_v1' and 'ACCOUNT_RECOVERY_HOLD_v1'

**Multi-tenant mandate (LOCKED v1.1a):**
- [ ] organization_id + tenant_id on all Prisma writes ✅

**Schema integrity:**
- [ ] No new Prisma models created
- [ ] No migrations generated or run
- [ ] OtpEvent + AccountHold confirmed from PV-001 — read-only

---

## Commit Format (FIZ — four-line mandatory)
```
REASON: DFSP-001 — Implement PlatformOtpService (Module 3) and
AccountRecoveryHoldService (Module 4); platform-native OTP with
bcrypt storage and 5-failure → 48h account recovery hold coupling
IMPACT: Two new DFSP services + dfsp.module.ts registration +
GovernanceConfig constants (DFSP_OTP_BCRYPT_COST, DFSP_OTP_MAX_ATTEMPTS
if absent); no schema changes; no new migrations; NATS topics
pre-registered on main via PR#192; no existing logic modified
CORRELATION_ID: DFSP-001-[date-of-execution]
GATE: PROC-001-COMPLETE-0aa416c | GOV-FINTRAC-CLEARED | GOV-AGCO-CLEARED
```

Note: Claude Code must fill actual clearance confirmation in GATE line
before committing. Do not fabricate gate clearance.

---

## Report-Back Requirements

File to: `PROGRAM_CONTROL/REPORT_BACK/DFSP-001-OTP-ACCOUNT-HOLD.md`

Must include:
- Commit hash
- Files created / modified
- GovernanceConfig constants added (if any were absent)
- NATS constant names used (confirm DFSP_ prefix)
- Prisma schema confirmed unchanged
- Bcrypt carve-out confirmed — cost factor used
- crypto.randomInt() confirmed — no randomBytes()
- Module 3 → 4 coupling implementation described
- All 15 invariants confirmed or flagged
- Multi-tenant confirmed
- Any deviations from directive with explanation
- npx tsc --noEmit result — zero new errors

---

## Definition of Done

- [ ] `platform-otp.service.ts` created and registered in dfsp.module.ts
- [ ] `account-recovery-hold.service.ts` created and registered
- [ ] GovernanceConfig constants confirmed or added
- [ ] No Prisma schema changes — confirmed
- [ ] All 15 invariants passed
- [ ] Bcrypt carve-out documented in code comments
- [ ] Module 3 → 4 coupling implemented and described in report-back
- [ ] Multi-tenant mandate confirmed
- [ ] FIZ four-line commit with GATE line filled accurately
- [ ] Report-back filed to REPORT_BACK/DFSP-001-OTP-ACCOUNT-HOLD.md
- [ ] npx tsc --noEmit clean
