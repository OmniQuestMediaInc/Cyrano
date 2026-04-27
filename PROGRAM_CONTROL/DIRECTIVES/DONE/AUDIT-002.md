### DIRECTIVE: AUDIT-002

**Status:** `[ ] TODO`
**Commit prefix:** `AUDIT:`
**Target path:** `services/core-api/src/compliance/legal-hold.service.ts` (CREATE)
**Risk class:** R0
**Gate:** Do not start until MOD-001 is merged. Parallel-safe with AUDIT-001.

**Context:** The Canonical Corpus (Chapter 7, §13.2) mandates a legal hold mechanism
that overrides retention deletion and is reversible only by an authorized role.
Legal hold is an L0 ship-gate requirement. Hold actions must be logged and audit-trailed.

**Task:** Create `services/core-api/src/compliance/legal-hold.service.ts`

The service must implement:

- `applyHold(params)` — marks a subject (by `subject_id` + `subject_type`) as held; publishes NATS; returns `LegalHold` record
- `liftHold(params)` — requires `COMPLIANCE` role assertion from caller; logs lift; publishes NATS
- `isHeld(subject_id: string, subject_type: string): boolean` — returns hold status (in-memory for now; DB migration in v5)
- `HoldSubjectType` enum: `'USER' | 'CONTENT' | 'TRANSACTION' | 'INCIDENT'`
- Logger instance present
- Advisory comment: `// TODO: LEGAL-HOLD-DB — migrate to DB-backed store before go-live`

```typescript
export interface LegalHold {
  hold_id: string;
  subject_id: string;
  subject_type: HoldSubjectType;
  applied_by: string;
  applied_at_utc: string;
  lifted_by: string | null;
  lifted_at_utc: string | null;
  reason_code: string;
  rule_applied_id: string;
}
```

**Add `LegalHoldService` to `ComplianceModule` providers and exports.**

**Add NATS topics if not present:**

```typescript
LEGAL_HOLD_APPLIED: 'compliance.legal_hold.applied',
LEGAL_HOLD_LIFTED:  'compliance.legal_hold.lifted',
```

**Validation:**

- `applyHold()` returns a `LegalHold` with `lifted_by: null`
- `isHeld()` returns `true` after `applyHold()`
- `liftHold()` updates the in-memory hold record with `lifted_by` and `lifted_at_utc`
- `isHeld()` returns `false` after `liftHold()`
- NATS published on apply and lift
- `npx tsc --noEmit` zero new errors

**Report-back file:** `PROGRAM_CONTROL/REPORT_BACK/AUDIT-002-LEGAL-HOLD-SERVICE.md`
