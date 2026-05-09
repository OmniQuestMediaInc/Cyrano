## HANDOFF
- Built: Added `.github/AGENTS.md` continuous-flow agent instructions, added `.github/workflows/copilot-internal.yml`, updated auto-merge for explicit agent fast-path handling, and configured CodeQL/Super-Linter workflows to skip PR runs for `copilot/*`, `grok/*`, and `agent/*` branches.
- Intentionally left incomplete: Direct server-side branch protection/ruleset mutation was not executed from this PR branch; `.github/branch-protection-agent-fast-path.md` captures required settings for maintainers.
- Next first task: Apply the documented `main` branch protection/ruleset settings in repository settings and verify required check names exactly match workflow job names.
