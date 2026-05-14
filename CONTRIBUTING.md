# Contributing — CyranoZone Cleanup Mode

**Company:** OmniQuest Media Inc. (OQMInc™)
**Governance authority:** `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_GOVERNANCE.md`
**Infrastructure authority:** `governance/OQMI_INFRASTRUCTURE_AND_SECURITY_POLICY.md`
**Naming authority:** `docs/DOMAIN_GLOSSARY.md`
**Package manager:** Yarn (canonical — do not use npm or pnpm)
**Platform time standard:** America/Toronto

---

## 1. Who can contribute

Contributions are accepted from:

- OQMInc-authorized coding agents (GitHub Copilot, Grok, and any agent
  listed in `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_GOVERNANCE.md §4.1`)
- OQMInc engineering staff
- CEO-authorized external contributors

All contributions are governed by `OQMI_GOVERNANCE.md`. Read it in full
before opening a PR.

---

## 2. Getting started

```bash
# Clone the repo (Yarn is required)
git clone https://github.com/OmniQuestMediaInc/CyranoZone.git
cd CyranoZone

# Install dependencies
yarn install

# Copy environment template
cp .env.example .env
# Fill in the required values — never commit .env

# Start backing services
docker-compose up db redis nats -d

# Run database migrations
yarn prisma migrate dev

# Seed the database
yarn prisma db seed
```

### Running the platform locally

```bash
# Start core API backend
yarn workspace core-api dev          # → http://localhost:3000

# Start portals (separate terminals)
cd apps/portals/main                  && yarn dev   # → :3001
cd apps/portals/ink-and-steel         && yarn dev   # → :3002
cd apps/portals/lotus-bloom           && yarn dev   # → :3003
cd apps/portals/desperate-housewives  && yarn dev   # → :3004
cd apps/portals/barely-legal          && yarn dev   # → :3005
cd apps/portals/dark-desires          && yarn dev   # → :3006
```

Or bring everything up with Docker Compose:

```bash
docker-compose up
```

---

## 3. Coding standards

### 3.1 Language and tooling

- **TypeScript** throughout. `tsconfig.json` is strict — no `any` unless
  explicitly justified by a comment.
- **ESLint** (`yarn lint`) and **Prettier** (`yarn format`) must pass before
  opening a PR. CI enforces both.
- **Yarn workspaces** — do not use `npm` or `pnpm`. Lock file is
  `yarn.lock`; do not commit `package-lock.json`.

### 3.2 Naming

Consult `docs/DOMAIN_GLOSSARY.md` before introducing any new domain term,
identifier, database column, or NATS topic. The glossary is the naming
authority — HARD_STOP if a required term is absent and raise a naming
question to Program Control. Do not invent terms.

### 3.3 Domain separation (§5.4)

- UI, game, and feature logic must never be mixed with financial, auth, or
  ledger logic.
- Services communicate via NATS JetStream or the declared REST API; no
  direct cross-service imports.

### 3.4 Financial integrity zone (FIZ)

Any change touching `services/ledger/`, `services/gateguard-sentinel/`,
payout paths, wallet/balance columns, or any FIZ-scoped path defined in
`OQMI_GOVERNANCE.md §8 (FIZ Path Expansions)` must use the four-line commit
format:

```
FIZ: <subject line>
REASON: <why this change is required>
IMPACT: <what financial-integrity surface is affected>
CORRELATION_ID: <idempotency / audit correlation id>
```

FIZ PRs carry the label `fiz-review-required` and are Human-Review
Category — they require CEO merge regardless of CI state.

---

## 4. Commit discipline

Every commit must be:

- **Atomic** — one logical change per commit
- **Descriptive** — message states what changed and why
- **Scoped** — prefixed from the canonical enum in
  `docs/DOMAIN_GLOSSARY.md` under **COMMIT PREFIX ENUM — CANONICAL**

The most specific applicable prefix wins. `FIZ:` overrides all other
prefixes when financial-integrity paths are touched.

---

## 5. Pull request process

### 5.1 Default (auto-merge)

PRs auto-merge on the cleanup fast path when CI is green or gray and the ship-gate remains satisfied:

- All CI checks pass
- No merge conflicts
- No unresolved errors
- PR does not touch a Human-Review Category (see §5.2 below)
- PR does not touch financial/ledger paths (cleanup mode safeguard)

For this cleanup cycle, super-linter, CI, and ship-gate are the branch-protection baseline for non-financial work.

**Merge method is squash** — one feature branch = one commit on `main`.

### 5.2 Human-Review Categories (CEO merge required)

The following require CEO PR merge:

1. Changes to `OQMI_GOVERNANCE.md`
2. Schema migrations touching financial columns (`balance`, `tokens`,
   `payout`, `escrow`, `commission`, `wallet`, `ledger_entry`, or
   any money-like column)
3. New compliance constants

Financial / ledger / compliance paths stay on human-review merge. Non-financial cleanup work should use the fast path.

### 5.3 Error resolution

If CI fails, the opening agent or contributor must attempt to resolve
errors autonomously before escalating. See
`OQMI_GOVERNANCE.md §2.3` for the full error-resolution clause.

### 5.4 PR labels

| Label                   | Meaning                             |
| ----------------------- | ----------------------------------- |
| `copilot-task`          | Opened by GitHub Copilot agent      |
| `ready-for-review`      | Agent work complete, awaiting merge |
| `fiz-review-required`   | Touches Financial Integrity Zone    |
| `needs-conflict-review` | Overlapping directive conflict      |
| `CEO_GATE: YES`         | Requires CEO merge                  |

---

## 6. Branch naming

| Branch type   | Pattern                 | Example                       |
| ------------- | ----------------------- | ----------------------------- |
| Copilot agent | `copilot/<short-id>`    | `copilot/cyr-core-001`        |
| Grok agent    | `grok/<short-id>`       | `grok/phase-0.2-ship-gate`    |
| Human feature | `feature/<description>` | `feature/voice-cloning-tts`   |
| Hotfix        | `hotfix/<ticket>`       | `hotfix/auth-step-up-restore` |

Delete branches after merge. Stale branches (no open PR, no commits in
30 days) are subject to automated pruning.

---

## 7. Testing

```bash
# Run all tests
yarn test

# Integration tests only
yarn test:integration

# E2E tests only
yarn test:e2e

# Type-check (no emit)
npx tsc --noEmit
```

All tests must pass before opening a PR. Never remove or skip existing
tests to make CI green — this violates `OQMI_GOVERNANCE.md §4.3`.

---

## 8. Security rules

- **Never commit secrets, tokens, credentials, or PII.** Use `.env` (git-ignored).
- Database (`postgres:5432`) and cache (`redis:6379`) must stay on the
  internal `backend` Docker network — never expose to a public interface.
- All sensitive actions must emit an audit event (see `OQMI_GOVERNANCE.md §6.5`).
- Step-up authentication is required for wallet/balance mutations, account
  suspensions, content takedowns, and any break-glass action.

---

## 9. Reporting and escalation

### 9.1 Agent work orders

Agents operate from directives in `PROGRAM_CONTROL/DIRECTIVES/QUEUE/`.
Completed work is filed to `PROGRAM_CONTROL/DIRECTIVES/DONE/` with a
corresponding report-back in `PROGRAM_CONTROL/REPORT_BACK/`.

### 9.2 Escalation

Escalate to CEO only when an `OQMI_GOVERNANCE.md §3.1` condition is met.
Never ask for confirmation of an already-assigned task. See §3.2 for a
full list of when **not** to escalate.

### 9.3 HANDOFF block

Any agent leaving work incomplete must place a `## HANDOFF` block at the
bottom of the relevant file or in a `HANDOFF.md` in the affected service
folder, stating: what was built, what was left incomplete, and the next
agent's first task.

---

## 10. Corporate information

**OmniQuest Media Inc. (OQMInc™)**
Ontario Corporation — Canada
CEO: Kevin B. Hartley
Platforms: Cyrano™ Standalone · ChatNow.Zone™
Cloud region: `ca-central-1` (Canada)

---

_[rule_applied_id: GOVERNANCE-EQ-v1]_
