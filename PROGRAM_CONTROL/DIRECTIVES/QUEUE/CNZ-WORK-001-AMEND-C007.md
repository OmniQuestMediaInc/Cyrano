# CNZ-WORK-001-AMEND-C007 — Per-claim sign-off on cited/qualified technical assertions

**Task:** CNZ-WORK-001-C007
**Source:** Deficit doc R-P0-007
**Wave:** C — Plan Amendments
**CEO_GATE:** YES (per-claim sign-off)
**Author:** claude-in-chat
**Date:** 2026-04-25

-----

## Purpose

Five technical assertions in Business Plan v2.8 are currently uncited or unqualified. Per directive C007, each must be (a) cited to a verifiable source, (b) qualified with explicit status language (e.g. "research target", "design intent", "Phase-2 capability"), or (c) struck from the plan, **before the next investor pass.**

This memo surfaces each claim with a discrepancy statement and a proposed amendment menu. The CEO selects one option per claim by writing the choice into the `CEO DECISION:` field below each row. No claim is amended without an explicit per-claim decision — partial sign-off is acceptable; un-decided claims remain QUEUED.

Once decisions are recorded, a follow-up implementation PR will edit Business Plan v2.8 §B.5.x / §B.7.1 to match each chosen option. The implementation PR is out of scope for this memo.

-----

## Claims

### Claim 1 — zk-SNARK as production capability (§B.5.3 F4)

**Discrepancy.** §B.5.3 F4 presents zk-SNARK proofs as a production-shipping component. No citation is given to the proving system, library, performance envelope (proof size / verification time), or trusted-setup posture. Production zk-SNARK deployment is non-trivial; presenting it as shipped without a circuit specification or vendor reference overstates current capability.

**Proposed amendment options.**

- **(a) Cite.** Add a footnote naming (i) the proving scheme (e.g. Groth16, PLONK, Halo2), (ii) the library/vendor, (iii) measured proof size and verification time on target hardware, and (iv) the trusted-setup posture.
- **(b) Qualify.** Reword to: *"zk-SNARK-style attestations are a Phase-2 research target; v1 ships with a hash-commitment audit trail and reserves the F4 surface for future SNARK adoption."*
- **(c) Strike.** Remove F4 from §B.5.3 entirely; add a one-line note in the deferred-features appendix.

**CEO DECISION:**

-----

### Claim 2 — Federation as a shipping production feature (§B.5.3 F2)

**Discrepancy.** §B.5.3 F2 describes federation as production-active. The repo currently emits federation-relevant NATS events (see `PROGRAM_CONTROL/REPORT_BACK/PAYLOAD-3-GATEGUARD-SENTINEL-PREPROCESSOR.md` line 190) but no federation peer registry, peer-trust model, replay/conflict policy, or operating federation partner is documented in-repo. Calling this "production" without a partner list and a peering protocol is unsupported.

**Proposed amendment options.**

- **(a) Cite.** Name (i) at least one peer/partner with a signed peering agreement, (ii) the federation transport (NATS subject scheme, mTLS posture), (iii) the replay/idempotency rules, and (iv) the operating runbook reference.
- **(b) Qualify.** Reword to: *"federation surfaces are scaffolded (NATS event emission live); production peering activates on first signed peer agreement. Pre-launch: zero peers."*
- **(c) Strike.** Remove F2 production framing; move federation to the roadmap section with a target window.

**CEO DECISION:**

-----

### Claim 3 — 72–85% precision/recall on §B.5.3 F1 (currently uncited)

**Discrepancy.** §B.5.3 F1 states a 72–85% precision/recall band for the GateGuard / classification surface. The directive flags this as uncited. No training-set composition, evaluation-set composition, holdout protocol, threshold settings, or measurement date is given. A precision/recall band without these is an investor-risk claim. Note: this claim is also referenced as a blocker in CNZ-WORK-001 line 763 (R-CLARIFY-003 dependency).

**Proposed amendment options.**

- **(a) Cite.** Footnote (i) the eval dataset (size, labelling provenance, class balance), (ii) the model + threshold, (iii) the measurement date and code revision, (iv) confidence intervals, and (v) the holdout protocol. Replace the bare range with the cited measurement.
- **(b) Qualify.** Reword to: *"Design target: 72–85% precision/recall once GateGuard Sentinel reaches GA. Pre-launch: model is in calibration; no measured production figure is published."*
- **(c) Strike.** Remove the numeric range; replace with non-numeric language ("high-precision classification") until measurement is available.

**CEO DECISION:**

-----

### Claim 4 — 200 ms latency budget (§B.5.1 / §B.5.3, unanalyzed)

**Discrepancy.** §B.5.1 and §B.5.3 cite a 200 ms latency budget. The directive flags this as "unanalyzed" — no decomposition into per-hop budgets (ingress → guard → ledger → emit), no measurement methodology, and no contention model under target QPS. The Cyrano hop is separately bounded at ≤350 ms (per `services/integration-hub/src/hub.service.ts` and PR #320 description), so a single 200 ms top-line risks contradicting another stated budget.

**Proposed amendment options.**

- **(a) Cite.** Add a budget decomposition table (per-hop allocation in ms, percentile target — p50/p95/p99, target QPS, measurement methodology). Reconcile with the Cyrano ≤350 ms bound by either narrowing scope ("excludes Cyrano join") or raising the headline.
- **(b) Qualify.** Reword to: *"Design budget: 200 ms p95 for the non-Cyrano hot path (excludes Cyrano join, which budgets ≤350 ms separately). Measured production figure pending Phase-2 load testing."*
- **(c) Strike.** Remove the numeric budget from the plan; relocate to an internal SLO document not surfaced to investors.

**CEO DECISION:**

-----

### Claim 5 — HeartPleasure heart-rate-as-Flicker n'Flame Scoring-input (§B.7.1)

**Discrepancy.** §B.7.1 names heart-rate telemetry as a Flicker n'Flame Scoring input. The directive flags "no engineering pathway." The repo contains no heart-rate ingestion service, no wearable/device integration spec, no consent / health-data compliance posture (HIPAA / state-level health-data law applicability), and no signal-processing or anti-spoofing design. Health-derived inputs are also a regulatory surface (consumer-health under the FTC Health Breach Notification Rule and several state privacy laws); shipping a plan that names this without a pathway carries reputational and regulatory risk.

**Proposed amendment options.**

- **(a) Cite.** Specify (i) the device / SDK family (Apple HealthKit, Google Health Connect, named wearable vendor), (ii) the consent model and explicit retention/deletion posture, (iii) the regulatory analysis (FTC HBNR, applicable state law), (iv) the anti-spoof / signal-quality logic, and (v) the Flicker n'Flame Scoring weighting. Add a heart-rate-ingestion service to the Wave-D spine.
- **(b) Qualify.** Reword to: *"Heart-rate telemetry is a Phase-2 research direction subject to compliance review; v1 Flicker n'Flame Scoring uses non-biometric inputs only. No biometric data is collected pre-launch."*
- **(c) Strike.** Remove heart-rate language from §B.7.1; the feature does not appear in any investor-facing material until a compliance-cleared pathway exists.

**CEO DECISION:**

-----

## Implementation flow after sign-off

1. CEO writes one of `(a) cite`, `(b) qualify`, or `(c) strike` (with any free-text refinement) into each `CEO DECISION:` field.
2. Author follow-up implementation PR(s) editing Business Plan v2.8 §B.5.1, §B.5.3, and §B.7.1 to reflect each decision.
3. For any `(a) cite` decision, the citation source must land in-repo (e.g. `docs/CITATIONS/C007-claim-N-source.md`) before the plan edit is merged.
4. File DONE-record `PROGRAM_CONTROL/DIRECTIVES/DONE/CNZ-WORK-001-C007-DONE.md` referencing this memo and the implementation PR(s).
5. Update `OQMI_SYSTEM_STATE.md` §3 DONE and §5 OUTSTANDING.

## Out of scope for this memo

- Editing Business Plan v2.8 itself (gated on CEO decisions above)
- C002, C003, C004, C005 amendments (separate memos)
- C008 (Day 91 Parity vs Pixel Legacy — CEO_GATE: NO, separate path)
- C099 Wave C cleanup (runs after C002–C008 close)

-----

**End of CNZ-WORK-001-AMEND-C007.md**
