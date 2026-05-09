# Main Branch Protection — Agent Fast-Path Settings

Apply these settings to `main` branch protection / ruleset:

- Require status checks to pass before merging.
- Required checks for agent branches (`copilot/*`, `grok/*`, `agent/*`):
  - `CI / Workspace Quality (lint / typecheck / format / test)`
  - `CI / Ship-Gate Verifier`
  - `Copilot Internal Fast-Path / fast-gate`
- Keep governance/security checks enabled for non-agent branches:
  - `CodeQL / Analyze (javascript-typescript)`
  - `Lint (Super-Linter) / Super-Linter`
- Keep existing review, signed-commit, and linear-history safeguards unchanged.
