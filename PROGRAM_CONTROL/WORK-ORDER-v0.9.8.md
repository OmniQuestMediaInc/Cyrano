# WORK-ORDER-v0.9.8 — CyranoZone Cleanup Mode

**Authority:** Kevin B. Hartley, CEO — OmniQuest Media Inc.  
**Version:** v0.9.8 (2026-05-13)  
**Status:** IN_PROGRESS — first cleanup cycle  
**Rule Applied:** GOVERNANCE-EQ-v1  
**Branch:** `copilot/cleanup-governance-sync-again`

## 1. Completed This Cycle

- Read and verified `OQMI_GOVERNANCE.md`, `OQMI_INFRASTRUCTURE_AND_SECURITY_POLICY.md`, `CNZ-WORK-001.md`, `README.md`, `CONTRIBUTING.md`, and active CI workflows.
- Captured the current local red state before edits: `yarn lint:ci` fails on `PROGRAM_CONTROL/ship-gate-verifier.ts` with a syntax error near line 640.
- Repaired `PROGRAM_CONTROL/ship-gate-verifier.ts` and removed the duplicate `FILTER_REGEX_INCLUDE` key in `.github/workflows/super-linter.yml`.
- Applied the first governance-sync updates to repo docs and workflow metadata so cleanup-mode fast-path + ship-gate references are explicit.
- Added this work-order file to the required-file baseline.
- Re-ran repo validation successfully: `yarn lint:ci`, `yarn format:check`, `yarn typecheck`, `yarn test`, and `yarn ship-gate` all exit 0 locally.

## 2. Evidence

### Workspace probe

```text
PWD=/home/runner/work/CyranoZone/CyranoZone
## copilot/cleanup-governance-sync-again...origin/copilot/cleanup-governance-sync-again
```

### Baseline validation before edits

```text
$ yarn lint:ci
/home/runner/work/CyranoZone/CyranoZone/PROGRAM_CONTROL/ship-gate-verifier.ts
  640:2  error  Parsing error: Property assignment expected
```

### Validation after first cleanup pass

```text
$ yarn lint:ci && yarn format:check && yarn typecheck && yarn test && yarn ship-gate
Done in 5.01s.
All matched files use Prettier code style!
Done in 6.26s.
Test Suites: 47 passed, 47 total
Tests:       642 passed, 642 total
Ship-Gate Summary: GREEN
```

## 3. Open Cleanup Lanes

1. Continue the Cyrano strip audit (contracts, NATS/webhook redirects, stale repo references).
2. Confirm branch-protection parity for CI + Super-Linter + ship-gate on the eventual PR.
3. Open the requested PR once the cleanup snapshot is committed.

## Handoff Block

**Completed this cycle:** Workspace probe, governance/infra sync read-through, first doc/workflow cleanup pass, work-order file creation, ship-gate/super-linter fixes, local validation green.  
**Blockers:** `WEBHOOK_CONTRACTS.md` and an `eCommsZone` client are not present in the current tree; the dedicated Cyrano contract surface still needs discovery before that cleanup lane can be closed.  
**% complete on cleanup:** 40%.  
**Next steps:** Commit this cleanup pass, run PR validation/review, and continue the Cyrano-remnant sweep with contract evidence.
