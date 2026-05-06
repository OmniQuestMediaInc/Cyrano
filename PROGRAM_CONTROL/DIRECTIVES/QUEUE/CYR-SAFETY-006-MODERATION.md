# DIRECTIVE: CYR-SAFETY-006-MODERATION

**Status:** `QUEUED`
**Commit prefix:** `GGS:` (GateGuard Sentinel scope)
**Depends on:** CYR-NARR-002-LAYER2-MEMORY (for prompt context),
CYR-VOICE-004-CALL-SYSTEM (for in-call STT moderation)
**Target paths:**

- `gateguard/src/policy.engine.ts` (UPDATE — semantic moderation)
- `gateguard/src/age-verification.service.ts` (UPDATE — themed-portal
  step-up rules)
- `safety/src/portal-content-policy.ts` (CREATE — per-brand policy
  registry)
- `services/integration-hub/src/hub.service.ts` (UPDATE —
  `forwardGuardedNarrativeRequest` pre-processor)

**Risk class:** R3 (regulatory + child-safety + brand-trust)

## Context

GateGuard scaffolds exist (Welfare Guardian, age verification SAQ flow).
What does NOT exist yet:

- LLM-based semantic moderation on narrative + voice transcripts.
- Per-brand-portal content policy registry. Adult-themed portals must
  enforce stricter age verification (ID + liveness) than mainline.
- Inline blocking on the narrative path (currently moderation happens
  post-hoc).

## Tasks

1. **Semantic moderation** in `policy.engine.ts`:
   - Pre-prompt safety classifier (block CSAM, sextortion, suicide
     ideation, illegal-act planning).
   - Post-completion safety classifier (block leaks of moderation
     instructions, jailbreak responses).
   - Score 0–1 with thresholds per brand portal.
   - Cache decisions per `(prompt_hash, model_version)` pair, TTL 24h.

2. **Themed-portal age verification**:
   - Mainline portals: existing email + DOB SAQ.
   - Adult-themed portals: ID + liveness via the existing identity
     verification provider; stored only as hash + verification timestamp.
     Append-only.

3. **Portal content policy registry** at
   `safety/src/portal-content-policy.ts`:
   - One row per brand portal, declaring: max NSFW level (0–3), allowed
     fetishes (whitelist), banned categories (blacklist), age-gate level
     (NONE | DOB | ID_LIVENESS).
   - Loaded at boot; hot-reload guarded by a CEO-clearance file.

4. **Integration Hub pre-processor**:
   - Every narrative request routes through
     `IntegrationHubService.forwardGuardedNarrativeRequest()`, which:
     a. Resolves the user's portal context (`brand_id`).
     b. Loads the portal content policy.
     c. Calls `policy.engine.evaluate(request, policy)`.
     d. Blocks (with reason_code + redacted-payload audit) or forwards.

5. **Themed-portal compliance**:
   - Add a `compliance` snapshot endpoint per portal that returns the
     active policy + verification stats — feeds the existing
     PRE_LAUNCH_CHECKLIST.

## Validation

- Unit specs across all four touch points.
- Adversarial test set (known jailbreak prompts, CSAM-bait phrases) blocked
  100%.
- ID + liveness verification result is stored hashed; raw image not
  retained.
- `yarn typecheck && yarn lint && yarn test` clean.
- Ship-gate verifier asserts every adult-themed brand portal has
  `age_gate_level === 'ID_LIVENESS'`.

## CEO clearance

Adult-themed portal policy authoring requires explicit
`PROGRAM_CONTROL/CLEARANCES/CYR-SAFETY-006-PORTAL-POLICY.md`
sign-off before merge.

## Report-back file

`PROGRAM_CONTROL/REPORT_BACK/CYR-SAFETY-006-MODERATION.md`
