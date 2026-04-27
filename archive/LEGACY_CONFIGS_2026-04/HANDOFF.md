# HANDOFF — LEGACY_CONFIGS quarantine (2026-04-24)

## Why this folder exists

This directory holds the pre-v10 root `LEGACY_CONFIGS/` payload that was
checked in alongside the active monorepo config. Per the
**OQMI_GOVERNANCE §12 repo hygiene invariant** and the 2026-04-24 Repo
Prep & Cleanup directive, the folder was moved here verbatim so that:

1. The root tree contains exactly one authoritative set of tool configs
   (`.eslintrc.js`, `.prettierrc`, `tsconfig.json`, `package.json`).
2. Historical configs remain auditable (append-only archive) in case a
   CI failure, forensic replay, or Copilot bootstrap needs them.

No content inside this folder has been modified. It is **read-only for
audit only** — do not wire these configs back into CI, prettier, eslint,
or tsc.

## What was moved

| From                         | To                                               |
| ---------------------------- | ------------------------------------------------ |
| `LEGACY_CONFIGS/.eslintrc.js`  | `archive/LEGACY_CONFIGS_2026-04/.eslintrc.js`    |
| `LEGACY_CONFIGS/.gitignore`    | `archive/LEGACY_CONFIGS_2026-04/.gitignore`      |
| `LEGACY_CONFIGS/.prettierrc`   | `archive/LEGACY_CONFIGS_2026-04/.prettierrc`     |
| `LEGACY_CONFIGS/package.json`  | `archive/LEGACY_CONFIGS_2026-04/package.json`    |
| `LEGACY_CONFIGS/tsconfig.json` | `archive/LEGACY_CONFIGS_2026-04/tsconfig.json`   |

The empty `LEGACY_CONFIGS/` directory was then removed from the repo
root.

## Invariants confirmed

- Append-only: this folder is not referenced by any tooling.
- No secrets were present in the moved files (verified with a scan for
  `.env`, tokens, credentials — clean).
- No code imports depend on the `LEGACY_CONFIGS/*` path prefix. A
  repo-wide grep confirms only comments in `.eslintrc.js` reference the
  historical path.

## Deletion rule

This folder may be deleted **no earlier than 2027-04-24** (12-month
audit retention) and only after an explicit CEO-signed clearance in
`PROGRAM_CONTROL/CLEARANCES/`.

## Next agent's first task

None. This is a terminal handoff — the quarantine is complete and
self-contained. Consult `PROGRAM_CONTROL/REPO_MANIFEST.md` for the
live directory map.
