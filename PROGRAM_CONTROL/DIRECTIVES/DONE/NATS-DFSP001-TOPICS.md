# NATS-DFSP001-TOPICS — Pre-work: Add DFSP-001 NATS Topics to Registry

**Directive ID:** NATS-DFSP001-TOPICS
**Commit prefix:** NATS:
**Mode:** DROID
**FIZ:** NO — infrastructure only, no financial logic
**Gate:** None — can execute immediately
**Purpose:** Add all NATS topics required by DFSP-001 to
topics.registry.ts before DFSP-001 fires, ensuring Invariant 9
compliance on day one of DFSP-001 execution.

---

## Scope

### File to Modify
`services/nats/topics.registry.ts`

### Topics to Add
Add the following under a clearly labelled DFSP Module 3 + 4 section:

```typescript
// DFSP Module 3 — Platform OTP
DFSP_OTP_ISSUED:              'dfsp.otp.issued',
DFSP_OTP_VERIFIED:            'dfsp.otp.verified',
DFSP_OTP_FAILED:              'dfsp.otp.failed',
DFSP_OTP_EXPIRED:             'dfsp.otp.expired',

// DFSP Module 4 — Account Recovery Hold
DFSP_ACCOUNT_HOLD_APPLIED:    'dfsp.account.hold.applied',
DFSP_ACCOUNT_HOLD_RELEASED:   'dfsp.account.hold.released',
```

### Nothing Else
- No other files touched
- No services modified
- No GovernanceConfig changes
- No schema changes

---

## Invariant Checklist
- [ ] No hardcoded string literals — topics added to registry only
- [ ] No @angular/core imports
- [ ] npx tsc --noEmit zero new errors
- [ ] No financial logic introduced

## Commit Format
NATS: Add DFSP Module 3 + 4 topics to topics.registry.ts —
pre-work for DFSP-001 (PlatformOtpService + AccountRecoveryHoldService)

## Report-Back
File to: `PROGRAM_CONTROL/REPORT_BACK/NATS-DFSP001-TOPICS-REPORT-BACK.md`

Must include:
- Commit hash
- Exact topic strings added (6 total)
- npx tsc --noEmit result
- Confirmation no other files touched
