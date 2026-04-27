# REPORT-BACK: MOD-001 — IncidentService

**Directive:** MOD-001
**Repo:** OmniQuestMediaInc/ChatNowZone--BUILD
**Branch:** claude/execute-mod-001-kickoff-hZiai
**Base HEAD:** 334f9d4458f302fc28b91d2fd07fb1e0245bf9cb
**Executed by:** Claude Code
**Date:** 2026-04-09

---

## Files Changed

| Action | File |
|--------|------|
| CREATE | `services/core-api/src/safety/incident.service.ts` |
| MODIFY | `services/core-api/src/safety/safety.module.ts` |
| MODIFY | `services/nats/topics.registry.ts` |
| CREATE | `PROGRAM_CONTROL/DIRECTIVES/IN_PROGRESS/MOD-001.md` → `DONE/MOD-001.md` |

---

## Tasks Completed

### Task 1: Create `incident.service.ts`
- Full incident lifecycle state machine: `OPEN → UNDER_REVIEW → ACTIONED → CLOSED`
- Types exported: `IncidentStatus`, `IncidentSeverity`, `IncidentAssignedRole`, `IncidentCategory`, `Incident`
- `transition()` — validates allow-list, publishes NATS event, throws on invalid transition
- `getRequiredRole()` — SEV1 requires COMPLIANCE, SEV2/SEV3 require MODERATOR
- `computeSlaDeadline()` — NCII: 48h (TAKE IT DOWN Act), CSAM: immediate, others: null
- `isSlaBreach()` — advisory SLA breach check for NCII compliance hook

### Task 2: SafetyModule wiring
- `IncidentService` added to `providers` and `exports` in `safety.module.ts`

### Task 3: NATS topic
- `INCIDENT_TRANSITION: 'moderation.incident.transition'` added to `services/nats/topics.registry.ts`

---

## Validation

| Check | Result |
|-------|--------|
| `transition()` throws on `OPEN → ACTIONED` | PASS — not in `VALID_TRANSITIONS['OPEN']` |
| `transition()` throws on `CLOSED → OPEN` | PASS — `VALID_TRANSITIONS['CLOSED']` is empty |
| `transition()` succeeds `OPEN → UNDER_REVIEW` | PASS — in allow-list |
| `transition()` stamps `closed_at_utc` on `CLOSED` | PASS — conditional set in transition logic |
| `getRequiredRole('SEV1')` returns `'COMPLIANCE'` | PASS |
| `getRequiredRole('SEV2')` returns `'MODERATOR'` | PASS |
| `computeSlaDeadline('NCII', now)` returns +48h | PASS |
| `computeSlaDeadline('FRAUD', now)` returns `null` | PASS — FRAUD not in `SLA_WINDOWS_MS` |
| `isSlaBreach()` returns `false` when `sla_deadline_utc` is null | PASS |
| `isSlaBreach()` returns `false` when status is `CLOSED` | PASS |
| `isSlaBreach()` returns `true` when deadline passed and not CLOSED | PASS |
| NATS published on every valid transition | PASS — `nats.publish()` called in `transition()` |
| `npx tsc --noEmit` zero new errors | PASS — 1 pre-existing TS5101 (baseUrl deprecation), 0 new |

---

## Result: SUCCESS

All three tasks complete. Zero new TypeScript errors. Directive ready for merge.

---

## Blockers

None.
