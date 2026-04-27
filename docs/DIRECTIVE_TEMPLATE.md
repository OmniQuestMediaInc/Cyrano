# DIRECTIVE: [ID]
# [Short title]

**Directive ID:** [ID]
**Agent:** COPILOT | CLAUDE_CODE
**Parallel-safe:** YES | NO
**Touches:** [comma-separated file paths]
**Mode:** DROID
**FIZ:** YES | NO
**Commit prefix:** [PREFIX:]
**Risk class:** R0 | R1
**Status:** QUEUED
**Gate:** [prerequisite directive or NONE]

---

## Objective

[One paragraph. What this directive builds and why.]

---

## Scope

### Files to Create
[list]

### Files to Modify
[list]

### Files to Confirm Unchanged
[list]

---

## Implementation Requirements

[Detailed spec. Reference GovernanceConfig constants by name.
Reference NATS topics by NATS_TOPICS.* constant name.
Reference Prisma models by exact model name and field names.]

---

## Invariant Checklist

- [ ] 1. Append-only — no UPDATE/DELETE on ledger/audit tables
- [ ] 2. FIZ four-line commit (if FIZ: YES)
- [ ] 3. No hardcoded constants — all from GovernanceConfig
- [ ] 4. crypto.randomInt() for random generation
- [ ] 5. No @angular/core imports
- [ ] 6. npx tsc --noEmit zero new errors
- [ ] 7. Logger instance on every service
- [ ] 8. Report-back filed before DONE
- [ ] 9. NATS topics from NATS_TOPICS.* only
- [ ] 10. AI services advisory only
- [ ] 11. Step-up auth boundary respected
- [ ] 12. RBAC check upstream
- [ ] 13. SHA-256 for hash ops (bcrypt carve-out documented if used)
- [ ] 14. Timestamps in America/Toronto
- [ ] 15. rule_applied_id on every output object
**Multi-tenant:** organization_id + tenant_id on all Prisma writes

---

## Commit Format

[FIZ directives:]

```text
REASON: [ID] — [description]
IMPACT: [files affected, no logic changed / affected]
CORRELATION_ID: [ID]-[date]
GATE: [gate clearance reference]
```

[Non-FIZ directives:]

```text
[PREFIX]: [ID] — [description]
```

---

## Report-Back Requirements

File to: `PROGRAM_CONTROL/REPORT_BACK/[ID]-REPORT-BACK.md`

Must include:
- Commit hash
- Files created / modified
- All invariants confirmed or flagged
- npx tsc --noEmit result

---

## Definition of Done

- [ ] [checklist items]
- [ ] Report-back filed
- [ ] Directive moved to DONE
- [ ] npx tsc --noEmit clean
