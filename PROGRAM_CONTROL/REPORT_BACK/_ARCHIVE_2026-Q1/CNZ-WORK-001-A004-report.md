# CNZ-WORK-001-A004 — Land Ghost Alpha provenance into OQMI_SYSTEM_STATE.md

**Status on completion:** DONE
**Agent:** copilot (agent hint was `either`)
**Date:** 2026-04-22
**Branch:** copilot/cnz-work-001-a004-land-ghost-alpha
**HEAD (pre-commit):** ffdf9602ba14ec20651cd85cbfc5afdfd6116b93

---

## Task

Add a single bullet to `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_SYSTEM_STATE.md` §8 Provenance Notes:

> `/tests/seed_data/` is the authoritative source for Ghost Alpha simulations.

Update `CNZ_WORK-001` A004 `Status: QUEUED` → `Status: DONE`.

---

## Files Changed

```
PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_SYSTEM_STATE.md  | 1 +
PROGRAM_CONTROL/DIRECTIVES/QUEUE/CNZ_WORK-001          | 2 +-
PROGRAM_CONTROL/REPORT_BACK/CNZ-WORK-001-A004-report.md (this file)
```

---

## Commands Run + Outputs

### Verify §8 before change
```
grep -n "§8\|Provenance" PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_SYSTEM_STATE.md
→ 126:## 8. PROVENANCE NOTES
```

### Add bullet (edit via tool)
Added to line 132 (after existing placeholder bullets):
```
- `/tests/seed_data/` is the authoritative source for Ghost Alpha simulations.
```

### Update A004 status
```
python3 replace Status: QUEUED → Status: DONE for CNZ-WORK-001-A004 block
→ Done
```

### Verify change
```
sed -n '181,195p' PROGRAM_CONTROL/DIRECTIVES/QUEUE/CNZ_WORK-001
→ Status: DONE confirmed
```

---

## Invariants Confirmed

- NO_REFACTORING: only additive change (one bullet, one status field)
- FIZ: NO — this task is not FIZ-scoped
- CEO_GATE: NO
- Commit prefix: CHORE (as directed)

---

## Result: SUCCESS
