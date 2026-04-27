# CNZ-WORK-001-C007 — Per-claim sign-off on cited/qualified technical assertions

**Status on completion:** PARTIAL (memo authored; awaiting per-claim CEO decisions)
**Agent:** claude-in-chat
**Date:** 2026-04-25
**PR:** (filled in after PR open)
**Merge commit SHA:** n/a (CEO_GATE — held until per-claim decisions recorded)

## What was done

- Authored amendment memo `PROGRAM_CONTROL/DIRECTIVES/QUEUE/CNZ-WORK-001-AMEND-C007.md` per kickoff STEP 4 procedure for Wave C tasks.
- Memo enumerates the five claims listed in CNZ-WORK-001 §C007 directive (zk-SNARK F4, federation F2, 72–85% precision/recall F1, 200 ms latency budget, HeartPleasure heart-rate input).
- For each claim: stated the discrepancy, proposed a three-option amendment menu (`(a) cite` / `(b) qualify` / `(c) strike`), and left a `CEO DECISION:` field blank for per-claim sign-off.
- Documented the post-sign-off implementation flow so the next agent has a clean handoff.

## What was found / surfaced

- **Cross-reference with Cyrano latency.** Claim 4's 200 ms top-line collides with the ≤350 ms Cyrano join budget asserted elsewhere (`services/integration-hub/src/hub.service.ts`, PR #320). The memo flags this for explicit CEO reconciliation under option (a) or (b).
- **Cross-reference with R-CLARIFY-003.** Claim 3 (72–85% precision/recall) is already cited as a downstream blocker on CNZ-WORK-001 line 763. C007 sign-off on Claim 3 should propagate to that blocker.
- **Regulatory surface on Claim 5.** The HeartPleasure heart-rate input touches consumer-health regulation (FTC HBNR + state law). Memo notes this so the CEO factors compliance review into the sign-off, not just engineering pathway.
- **No in-repo plan source.** Business Plan v2.8 §B.5.x / §B.7.1 is not present in this repository; memo references plan section IDs as captured in the directive and notes the implementation PR will edit the external plan separately.
- **No prior C007 work.** Branch `claude/fix-claim-sign-off-AjBGG` was at the same commit as `main` at session start; no prior memo or REPORT_BACK existed for C007.

## What's left

- **CEO action required (per-claim).** Each of the five `CEO DECISION:` fields must be filled before the implementation PR can be authored.
- **Implementation PR(s).** After sign-off, edit Business Plan v2.8 §B.5.1, §B.5.3, §B.7.1 to match each decision, land any `(a) cite` source documents under `docs/CITATIONS/`, and file the C007 DONE-record.
- **C099 dependency.** C007 is in C099's `Depends-on` list; C099 cleanup cannot close until C007 reaches DONE.

## Files touched

- `PROGRAM_CONTROL/DIRECTIVES/QUEUE/CNZ-WORK-001-AMEND-C007.md` (new)
- `PROGRAM_CONTROL/REPORT_BACK/CNZ-WORK-001-C007-report.md` (new — this file)

## Tests added / modified

None. C007 is a documentation-only Wave C amendment task; no production code changed.

## OQMI_SYSTEM_STATE.md updates landed in same PR

- §3 DONE: no — task is PARTIAL (gated on CEO sign-off); will move to DONE in the follow-up implementation PR.
- §5 OUTSTANDING: no edit in this PR — C007 is already enumerated as outstanding via CNZ-WORK-001; no new outstanding items surfaced.
- §6 BLOCKERS: no — no new blockers; the existing R-CLARIFY-003 cross-link on Claim 3 is already tracked.
