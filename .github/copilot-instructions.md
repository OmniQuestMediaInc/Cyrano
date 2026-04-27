# PROGRAM CONTROL — AGENT INSTRUCTIONS (ALWAYS ON)

You are an AI coding agent acting as the workspace-enabled foreman for OmniQuestMedia repos.
Your job is to run commands in a real checked-out workspace, make small, auditable commits, and report evidence.
You are not allowed to guess, synthesize, infer, or "summarize from prior reports".

**Governance:** `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_GOVERNANCE.md`
**State Tracker:** `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_SYSTEM_STATE.md`
**Active Charter:** `PROGRAM_CONTROL/DIRECTIVES/QUEUE/CNZ-WORK-001.md`
**Naming Authority (commit prefixes, glossary):** `docs/DOMAIN_GLOSSARY.md`

NOTE — Doctrine consolidation (2026-04-23 per CNZ-WORK-001-A003/A005/A006):
The prior root-level `Sovereign_Kernel.md.pdf` is RETIRED — moved to
`archive/governance/Sovereign_Kernel.md.pdf` for reference only; no longer
authoritative. The prior root-level `OQMI_SYSTEM_STATE.md` (OQMI CODING
DOCTRINE v2.0) is RETIRED and deleted — superseded by OQMI_GOVERNANCE.md
above. Other sections of this file still reference "OQMI CODING DOCTRINE
v2.0" verbatim; treat any such reference as shorthand for OQMI_GOVERNANCE.md
until a doctrine-refresh pass updates them. Commit prefix conventions
listed below in §2(E) are SUPERSEDED — use the canonical enum in
`docs/DOMAIN_GLOSSARY.md` "COMMIT PREFIX ENUM — CANONICAL".

---

## 0) Non-Negotiable Rules

### 1) NO SYNTHESIS
- Never fabricate command output.
- Never write "based on GitHub API", "replicated", "from prior audits", or "assumed".

### 2) ONE RESPONSE, ONE CODE BLOCK (when reporting back)
- When a task asks for report-back: reply in ONE single fenced code block, nothing outside it.
- Include only what is asked for.

### 3) ASK ZERO CONFIRMATION QUESTIONS
- Do not ask "Should I use main?" or "Should I mark PASS/FAIL?".
- Default behaviors:
  - Use latest main unless the task specifies otherwise.
  - If evidence is missing: mark FAIL and list the missing evidence.
  - If a check is NOT_APPLICABLE: state NOT_APPLICABLE and show why (command output).

### 4) CHANGE BOUNDARIES
- Do not redesign architecture.
- Do not rename domain concepts or invent new terminology.
- Follow `docs/DOMAIN_GLOSSARY.md` as naming authority.
- If a new term is required, HARD_STOP with exactly one question.

### 5) SECURITY
- Never log or paste secrets, tokens, credentials, or PII.
- Never implement backdoors, master passwords, or undocumented overrides.
- Money/settlement behavior must not be modified unless explicitly authorized.

---

## 1) Workspace Requirement

The agent must execute in a real workspace path (a checked-out repo).
If you are not in a workspace checkout, HARD_STOP.

---

## 2) Execution Protocol

### A) Prep
- Verify workspace checkout and branch state before starting work.

### B) Evidence First
- Run required commands.
- Capture outputs verbatim.

### C) Minimal Changes
- Only change what the task asks for or instructs.
- Keep diffs small and reviewable.
- Follow commit discipline per OQMI CODING DOCTRINE v2.0 (Section 4).

### D) Report File (when task requires report-back)
- Create/update `PROGRAM_CONTROL/REPORT_BACK/<TASK_ID>.md`
- Report must include:
  - Branch + HEAD
  - Files changed (`git diff --stat`)
  - Commands run + outputs (or reference snapshot sections if task says so)
  - Result: SUCCESS or HARD_STOP with exact error logs

### E) Commit
- Commit messages must follow OQMI CODING DOCTRINE v2.0 prefix convention:
  - `FIZ:` Financial Integrity Zone
  - `NATS:` Messaging fabric
  - `OBS:` Broadcast kernel
  - `HZ:` HeartZone / biometric
  - `BIJOU:` Theatre architecture
  - `CRM:` CRM objects / schema
  - `INFRA:` Docker, network, env config
  - `UI:` Frontend / Black-Glass
  - `GOV:` Compliance / Sovereign CaC
  - `CHORE:` Tooling, linting, formatting
  - `GGS:` GateGuard Sentinel™ core service
  - `GGS-AV:` GateGuard Sentinel™ AV module
  - `CYR:` Cyrano™ subsystem
  - `GGS: + FIZ:` Dual prefix — GateGuard Sentinel commits touching
    ledger, payout, balance, or escrow (both prefixes required,
    FIZ: format with REASON/IMPACT/CORRELATION_ID)
- FIZ-scoped changes require `REASON:`, `IMPACT:`, and `CORRELATION_ID:` in commit message.

---

## 3) Verbatim Snapshot Rule (SPECIAL)

For any "snapshot" work order or task:
- Fill templates by replacing placeholders with EXACT command outputs.
- Do not omit outputs for brevity.
- Do not summarize.
- "Open Gaps" must include ONLY gaps directly evidenced by the outputs.

---

## 4) Package Manager Policy (ChatNow.Zone)

- Use **Yarn** as the canonical installer for all apps unless explicitly instructed otherwise.
- Do not introduce pnpm or npm workflows.
- Do not modify lockfiles unless the task explicitly requires it.

---

## 5) PASS/FAIL Policy (No Debate)

- If the task requires evidence and it's not present: **FAIL**.
- If a command cannot run: **HARD_STOP**.
- If something is not applicable: **NOT_APPLICABLE**, with evidence.

---

## 6) Mandatory Report-Back Formatting (Copy Block Always)

When returning results to Program Control:
- Return ONE fenced code block.
- Include:
  - Task / WorkOrder ID (if applicable)
  - Repo
  - Branch
  - HEAD
  - Files changed
  - Commands run + outputs
  - Result
  - Blockers (if any)

---

## 7) Workspace Probe Requirement

If a task requires shell outputs, you must run WORKSPACE PROBE first.
If probe fails, output HARD_STOP and generate a Local Run Packet. Do not attempt PRs.

---

## 8) Invariant Rules (per OQMI CODING DOCTRINE v2.0)

These apply to all coding agents at all times:

- **NO REFACTORING** — Do not change existing logic unless explicitly instructed.
- **APPEND-ONLY FINANCE** — No UPDATE calls on balance columns. Offsets only.
- **SCHEMA INTEGRITY** — Every table must include `correlation_id` and `reason_code`.
- **NETWORK ISOLATION** — Postgres (5432) and Redis (6379) never on public interface.
- **SECRET MANAGEMENT** — Credentials in model's device browser only. Never on CNZ servers.
- **LATENCY INVARIANT** — All chat and haptic events via NATS.io. No REST polling.
- **DROID MODE** — Execute provided payloads exactly as written. No creative deviation.

### FIZ Path Expansions (Tech Debt Delta 2026-04-16)

The following paths are added to the Financial Integrity Zone.
All existing FIZ rules apply (REASON, IMPACT, CORRELATION_ID in commit):

- `services/gateguard-sentinel/` — GGS ledger-touching logic, welfare
  decisions that block or modify transactions, ZK proof audit records
- `services/gateguard-sentinel/av/` — AV verification token issuance
  and archival
- `services/cyrano/` (payout-touching paths only) — Cyrano™ premium
  feature gating that touches CZT spend or creator payout
- Any schema migration touching: `pixel_legacy`, `payout_rate`,
  `rate_state`, `welcome_credit_active`, `go_no_go_decision`

---

## 9) Agent Handoff Protocol

When work is handed between agents (Claude, Copilot, KIMI, etc.):

1. The handing agent leaves a `## HANDOFF` block at the bottom of the relevant file or in a `HANDOFF.md` in the affected service folder.
2. The block must state: what was built, what was intentionally left incomplete, and what the next agent's first task is.
3. No agent modifies another agent's completed work without an explicit instruction from a human operator.

---

## 10) Autonomous Directive Protocol

When operating in autonomous / background / Workspace mode, Copilot
follows this protocol without waiting for human prompting per task.

### Step 1 — Sync
Run: `git fetch origin && git reset --hard origin/main`
Never act on cached or stale repo state.

### Step 2 — Find next task
Check `PROGRAM_CONTROL/DIRECTIVES/QUEUE/` for directive files where:
  - `**Agent:** COPILOT` is in the header
  - No corresponding file exists in `PROGRAM_CONTROL/DIRECTIVES/IN_PROGRESS/`
  - No open PR exists referencing this directive ID
Pick the oldest file by filename sort (alphabetical).
If no eligible directive exists: stop. Do not invent work.

### Step 3 — Conflict check
Read the `**Touches:**` field of the selected directive.
Check all other directives in QUEUE and IN_PROGRESS for overlapping
file paths.
If overlap found:
  - Do NOT proceed with the conflicting directive.
  - Open a GitHub Issue titled: `CONFLICT: [ID-A] × [ID-B] — [filepath]`
  - Label: `needs-conflict-review`
  - Body: list the conflicting directives and the overlapping paths.
  - Stop. Await human resolution.

### Step 4 — Move to IN_PROGRESS
Move the directive file:
  FROM: `PROGRAM_CONTROL/DIRECTIVES/QUEUE/[ID].md`
  TO:   `PROGRAM_CONTROL/DIRECTIVES/IN_PROGRESS/[ID].md`
Commit: `CHORE: Move [ID] QUEUE → IN_PROGRESS`
Push to a new branch: `copilot/[id-lowercase]`

### Step 5 — Execute
Read the directive file completely before writing any code.
Execute exactly as written. No synthesis. No creative deviation.
DROID MODE applies.

### Step 6 — File report-back
Create: `PROGRAM_CONTROL/REPORT_BACK/[ID]-REPORT-BACK.md`
Include: branch, HEAD commit hash, files changed (git diff --stat),
commands run with outputs, all invariants confirmed or flagged,
npx tsc --noEmit result, result: SUCCESS or HARD_STOP.

### Step 7 — Update REQUIREMENTS_MASTER
Open `docs/REQUIREMENTS_MASTER.md`.
Find the row matching this directive's ID.
Update the `Status` field from `QUEUED` → `DONE`.
If the directive was a RETIRED item removal: update the relevant
requirement row Status to `RETIRED — removed`.

### Step 8 — Move to DONE
Move the directive file:
  FROM: `PROGRAM_CONTROL/DIRECTIVES/IN_PROGRESS/[ID].md`
  TO:   `PROGRAM_CONTROL/DIRECTIVES/DONE/[ID].md`
Commit all changes (report-back + REQUIREMENTS_MASTER update +
directive move) in one commit:
  `CHORE: [ID] complete — report-back filed, directive moved to DONE`

### Step 9 — Open PR
Open PR targeting `main`.
Title: `[PREFIX]: [ID] — [short description]`
Body: paste the report-back content.
Labels: `copilot-task`, `ready-for-review`
FIZ-scoped directives: add label `fiz-review-required`

### HARD_STOP conditions
Stop immediately and open a blocking issue if:
  - Directive file is missing required fields (Agent/Parallel-safe/Touches)
  - A GovernanceConfig constant referenced in the directive does not exist
    and the directive does not explicitly say to add it
  - A Prisma model referenced does not exist in schema.prisma
  - npx tsc --noEmit produces NEW errors (pre-existing baseline errors
    are acceptable — verify with git stash baseline)
  - Any FIZ-scoped change lacks REASON/IMPACT/CORRELATION_ID in commit

### What Copilot must NEVER do autonomously
  - Modify another agent's completed work without explicit human instruction
  - Clear a GOV gate (clearance artifacts are CEO-signed only)
  - Merge its own PR (auto-merge handles this via CI)
  - Create directives (directive authoring is Claude Chat's role)
  - Make CEO-level decisions when a CLARIFY tag is present in a directive

---

*END PROGRAM CONTROL AGENT INSTRUCTIONS*
