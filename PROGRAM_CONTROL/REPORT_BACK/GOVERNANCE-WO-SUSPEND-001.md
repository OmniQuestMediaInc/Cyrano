# GOVERNANCE-WO-SUSPEND-001 — Temporary WO ID Requirement Override

## Directive
Temporarily override (suspend) the Work Order ID requirement in the OQMI Droid governance rules until further notice, as requested via the repository issue tracker.

## Branch + HEAD Commit
- **Branch:** `copilot/override-workorder-id-requirement`
- **HEAD:** `5bb31fdaa4a8d6f017e9ebeaefd6162cf61ea073`

## Files Changed
```
git diff --stat
 .github/copilot-instructions.md | 7 ++++---
 1 file changed, 4 insertions(+), 3 deletions(-)
```

## Change Description
Rule §3 (Work Order Compliance) in `.github/copilot-instructions.md` has been updated to:
- Mark the WO ID requirement as **TEMPORARILY SUSPENDED** (effective 2026-03-08)
- Strike-through the WO ID bullet and note it is suspended
- Preserve all other rules in §3 (no speculative changes; scope limited to the authorizing issue)
- Provide clear reinstatement instructions inline

All other rules (Append-Only Ledger, Deterministic Logic, No Fabrication, Security Constraints, Branch Policy) remain **fully in effect** and are unchanged.

## Commands Run
```
# View governance file before change
view .github/copilot-instructions.md

# Edit Rule §3 to add suspension notice
edit .github/copilot-instructions.md (targeted replacement of lines 19-22)

# Verify result
view .github/copilot-instructions.md
```

## Result
✅ SUCCESS — WO ID requirement suspended until further notice. To reinstate, remove the `⚠️ TEMPORARILY SUSPENDED` heading suffix, the status block, the strikethrough line, and restore the original rule text:
```
### 3. Work Order Compliance
- Every change must reference an approved Work Order (WO) ID.
- No speculative or anticipatory changes.
- Scope is limited to exactly what the WO authorizes.
```
