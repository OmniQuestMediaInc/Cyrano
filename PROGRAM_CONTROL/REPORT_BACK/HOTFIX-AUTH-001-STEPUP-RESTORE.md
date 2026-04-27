# HOTFIX-AUTH-001 — Restore StepUpService Report-Back

## Branch + HEAD
- **Branch:** `claude/execute-kyc-001-qIspL`
- **Base:** `origin/main` @ `0a358dd`
- **Commit SHA:** `0c1974b`

## Root Cause
AUTH-002 PR #164 (commit `0a358dd`) replaced the complete 195-line StepUpService
implementation with a 7-line placeholder. The squash merge overwrote the file that
AUTH-001 (merged via `372e34a` / PR #163) had created.

## Files Changed
```
services/core-api/src/auth/step-up.service.ts   (RESTORED — 195 lines, was 7-line placeholder)
```

## Validation Checks

| # | Check | Result |
|---|-------|--------|
| 1 | `e465501` (AUTH-001) in main history via squash merge `372e34a` | PASS |
| 2 | `STEP_UP_AUTH_v1` in step-up.service.ts | PASS |
| 3 | `RBAC_GUARD_v1` in rbac.guard.ts | PASS |
| 4 | `StepUpService` + `RbacGuard` in auth.module.ts | PASS |
| 5 | `AuthModule` in app.module.ts | PASS |
| 6 | `STEP_UP_CHALLENGE_ISSUED` in topics.registry.ts | PASS |

## tsc Result
```
0 new errors from auth files (pre-existing baseUrl deprecation warning only)
```

## What Was Restored
- Full `StepUpService` class with `STEP_UP_AUTH_v1` rule ID
- `issueChallenge()` — TOTP challenge issuance with 300s window
- `verifyChallenge()` — token validation, expiry check, NATS publish on all outcomes
- 8 sensitive actions enforced: WALLET_MODIFICATION, PAYOUT_CHANGE, TAKEDOWN_SUBMISSION,
  ACCOUNT_FREEZE, CONTENT_DELETION, REFUND_OVERRIDE, GEO_BLOCK_MODIFICATION, PAYMENT_DETAIL_CHANGE
- NATS publishing: STEP_UP_CHALLENGE_ISSUED, STEP_UP_CHALLENGE_VERIFIED, STEP_UP_CHALLENGE_FAILED
