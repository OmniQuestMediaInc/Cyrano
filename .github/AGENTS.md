# OmniQuest Agent Instructions — Continuous Flow Mode

## Agent Roster (2026-05-11)

- **Grok** — Primary build agent. Handles service authoring, schema design, complex refactors, FIZ-scoped work. Branch prefix: `grok/*`.
- **Copilot** — Secondary agent. Repo chores, file moves, config edits, multi-file mechanical work. Branch prefix: `copilot/*`.
- **Claude Code** — ⚠️ RETIRED 2026-05-11. No longer an authorized build agent. Any directive assigned to `claude-code` is re-routed to Grok automatically by the directive-dispatch workflow.

## Operating Mode

- Strict Droid Mode (no creative deviation)
- All commits must use exact FIZ format with rule_applied_id
- Every payload must end with full ship-gate + ## HANDOFF block

## Fast-Path Rules for Agent Branches

- Branches matching: copilot/_, grok/_, agent/\*
- Reduced CI gates: CI + Lint + ship-gate only (skip full CodeQL / Super-Linter on small or internal changes)
- Auto-merge enabled immediately upon green ship-gate
- Parallel job execution strongly encouraged

## Post-Payload Requirements

- Always run full `yarn ship-gate` (or equivalent)
- Update MEMORY.md or OQMI_SYSTEM_STATE.md with concise summary
- Flag any cross-repo impacts
