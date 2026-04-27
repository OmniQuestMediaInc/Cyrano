# ChatNow.Zone

> **✅ BUILD COMPLETE — CANONICAL COMPLIANT (Alpha Launch Ready)**
> Payloads 1–10 executed and verified. All L0 ship-gates closed per Canonical Corpus v10 + REDBOOK + Business Plan v2.8.
> **Date:** April 24, 2026 · **Next steps:** Pixel Legacy onboarding, payment processor testing, CEO launch clearance sign-off.

> **ChatNow.Zone — Canonical Corpus v10 governed monorepo (TypeScript + Prisma + Postgres).**
> **Status: BUILD COMPLETE (Payload 9, 2026-04-24) — Alpha Launch Ready (September 2026 target).**

The ChatNow.Zone build is the primary production platform for
OmniQuest Media Inc. (OQMInc™). Every commit is bound by the OQMI
governance invariants: append-only finance, deterministic execution,
idempotent services, multi-tenant mandate, and zero secrets in the
tree.

---

## Authoritative docs

- **Governance doctrine:** [`PROGRAM_CONTROL/OQMI_GOVERNANCE.md`](PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_GOVERNANCE.md) — invariants, agent roles, PR-lifecycle authority.
- **Coding doctrine:** [`PROGRAM_CONTROL/OQMI_SYSTEM_STATE.md`](PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_SYSTEM_STATE.md) — OQMI Coding Doctrine v2.0.
- **Program control pipeline:** [`PROGRAM_CONTROL/`](PROGRAM_CONTROL/) — directive queue, in-progress, done, report-backs, repo manifest, ship-gate verifier.
- **Architecture overview (Payloads 1–8):** [`docs/ARCHITECTURE_OVERVIEW.md`](docs/ARCHITECTURE_OVERVIEW.md).
- **Pre-launch L0 checklist:** [`docs/PRE_LAUNCH_CHECKLIST.md`](docs/PRE_LAUNCH_CHECKLIST.md).
- **Engineering docs root:** [`docs/`](docs/) — `DOMAIN_GLOSSARY.md`, `REQUIREMENTS_MASTER.md`, `MEMBERSHIP_LIFECYCLE_POLICY.md`, `ROADMAP_MANIFEST.md`, compliance, doctrine.
- **Agent instructions (GitHub Copilot + Claude Code):** [`.github/copilot-instructions.md`](.github/copilot-instructions.md).
- **Backlog snapshot:** [`OQMI_SYSTEM_STATE.md`](OQMI_SYSTEM_STATE.md) (repo root — periodic snapshot of ship-gate and invariant-audit status).
- **Architecture overview (Payload 9):** [`docs/ARCHITECTURE_OVERVIEW.md`](docs/ARCHITECTURE_OVERVIEW.md) — full system map + cross-Payload invariants.
- **Pre-launch checklist:** [`docs/PRE_LAUNCH_CHECKLIST.md`](docs/PRE_LAUNCH_CHECKLIST.md) — go/no-go for the 2026-10-01 hard launch.
- **Launch manifest:** [`PROGRAM_CONTROL/LAUNCH_MANIFEST.md`](PROGRAM_CONTROL/LAUNCH_MANIFEST.md) — Pixel Legacy onboarding, Mic Drop reveal, 3,000-creator rate-lock, GateGuard LOI data package.

---

## Quickstart — local bring-up

Prerequisites: Node ≥ 20 (< 23), Yarn ≥ 1.22, Docker + Docker Compose.

```bash
# 1. Install workspace dependencies
yarn install --frozen-lockfile

# 2. Generate Prisma client + apply schema
yarn prisma:generate
yarn prisma:push

# 3. Typecheck + lint + test (must be green before bring-up)
yarn typecheck
yarn lint
yarn test

# 4. Launch Postgres + Redis + NATS + core-api (Postgres 5432 and Redis 6379
#    are internal-only by design — FT-033 network-isolation invariant)
docker compose up --build
```

The `api` service exposes `http://localhost:3000` with a `/health`
endpoint and mounts every Payload 1–8 module (Ledger, Recovery,
GateGuard, Streaming, CreatorControl, Cyrano, Diamond Concierge,
Immutable Audit) plus the Integration Hub. `db`, `redis`, and `nats`
remain on the internal `backend` network and are not reachable from
the host.

The compose file requires four secrets to be present in the
environment (or a developer-local `.env.local` — **never** committed):

- `DB_PASSWORD`
- `REDIS_PASSWORD`
- `WEBHOOK_SIGNING_SECRET`
- `RBAC_STEP_UP_SIGNING_SECRET`

Module-level feature flags (`LEDGER_ENABLED`, `GATEGUARD_ENABLED`,
`CYRANO_ENABLED`, …) default to `true` and can be flipped per
environment without rebuilding the container.

---

## Package scripts

| Command                                 | Purpose                                                            |
| --------------------------------------- | ------------------------------------------------------------------ |
| `yarn lint` / `yarn lint:fix`           | ESLint `services/**/*.ts` (zero warnings)                          |
| `yarn format` / `yarn format:check`     | Prettier across the tree                                           |
| `yarn typecheck` / `yarn typecheck:api` | `tsc --noEmit` (root / core-api)                                   |
| `yarn test`                             | Jest integration + E2E suite (`tests/integration/` + `tests/e2e/`) |
| `yarn prisma:generate`                  | Regenerate Prisma client from `prisma/schema.prisma`               |
| `yarn prisma:push`                      | Push Prisma schema to the database                                 |
| `yarn seed:scheduling`                  | Seed GuestZone scheduling reference data                           |
| `yarn ship-gate`                        | Run `PROGRAM_CONTROL/ship-gate-verifier.ts` (L0 compliance report) |

---

## Architecture map (Payloads 1–8)

| Surface                                                   | Path                                                                |
| --------------------------------------------------------- | ------------------------------------------------------------------- |
| Canonical Ledger (three-bucket + hash chain)              | `services/ledger/`                                                  |
| Diamond Concierge (volume + velocity quotes)              | `services/diamond-concierge/`                                       |
| Recovery Engine (Token Bridge / 3/5ths Exit / Expiration) | `services/recovery/` + `services/ledger/recovery.service.ts`        |
| GateGuard Sentinel + Welfare Guardian                     | `services/core-api/src/gateguard/`                                  |
| RBAC + step-up                                            | `services/core-api/src/auth/`                                       |
| Compliance + WORM + audit chain                           | `services/core-api/src/compliance/`, `services/core-api/src/audit/` |
| CreatorControl + Cyrano                                   | `services/creator-control/`, `services/cyrano/`                     |
| Integration Hub                                           | `services/integration-hub/`                                         |
| UI presenters + page builders                             | `ui/types/`, `ui/view-models/`, `ui/app/`, `ui/config/`             |
| End-to-end tests                                          | `tests/e2e/`                                                        |
| Ship-gate verifier                                        | `PROGRAM_CONTROL/ship-gate-verifier.ts`                             |

Detailed map: [`docs/ARCHITECTURE_OVERVIEW.md`](docs/ARCHITECTURE_OVERVIEW.md).

---

## Architecture summary

Eight payloads compose the canonical runtime:

| # | Payload | Highlights |
| - | --- | --- |
| 1 | Canonical Financial Ledger | Three-bucket wallet, REDBOOK rate cards, append-only triggers |
| 2 | REDBOOK Recovery + Diamond Concierge | Extension / recovery / Token Bridge / 3/5ths Exit |
| 3 | GateGuard Sentinel + Welfare Guardian Score | Pre-processor on every ledger touch |
| 4 | OBS Streaming Bridge + Flicker n'Flame Scoring (FFS) | Deterministic tier transitions, theatre + Bijou |
| 5 | CreatorControl.Zone + Cyrano L1 + Integration Hub | Whisper copilot ≤ 350 ms, cross-Payload wiring |
| 6 | Immutable Audit Architecture | Hash-chain + WORM export + Canonical Compliance Checklist |
| 7 | RBAC Step-Up + Compliance Lockdown | Step-up challenge + Legal Hold model |
| 8 | (Cross-cutting) | Covered by Payloads 1–7 |
| 9 | Deployment Readiness + Launch Prep | This release — see `docs/ARCHITECTURE_OVERVIEW.md` |

See [`docs/ARCHITECTURE_OVERVIEW.md`](docs/ARCHITECTURE_OVERVIEW.md) for
the full topology, cross-Payload contracts, and AWS deploy plan.

## Ship-gate status (vs Canonical Corpus L0)

Snapshot at 2026-04-25 (Payload 7 + 8):

- **PAYLOAD 1 (Canonical Ledger)** — DONE. Three-bucket wallet + hash chain.
- **PAYLOAD 2 (Recovery Engine)** — DONE. REDBOOK §5 pillars wired.
- **PAYLOAD 3 (GateGuard)** — DONE (scaffold + middleware).
- **PAYLOAD 4 (OBS bridge / Flicker n'Flame Scoring)** — DONE (scaffold).
- **PAYLOAD 5 (CreatorControl + Cyrano L1)** — DONE.
- **PAYLOAD 6 (Immutable audit + RBAC + compliance)** — DONE.
- **PAYLOAD 7 (Frontend polish + Diamond Concierge UI)** — DONE.
- **PAYLOAD 8 (E2E validation + ship-gate verifier)** — DONE.

Remaining `NEEDS_DIRECTIVE` items (deferred to post-alpha): Black-Glass
Interface (G101+), Cyrano Layer 2, FairPay + NOWPayouts wiring, OBS
Broadcast Kernel hardening, `legal_holds.correlation_id` migration.
See `docs/REQUIREMENTS_MASTER.md` for the live matrix.

---

## Invariants (excerpt)

1. **Append-only finance** — no `UPDATE`/`DELETE` on ledger tables.
   Enforced via Postgres triggers in `infra/postgres/init-ledger.sql`.
2. **`correlation_id` + `reason_code`** required on every financial /
   audit write.
3. **Postgres (5432) / Redis (6379)** never on public interfaces.
4. **Chat + haptic events via NATS.io** — REST polling forbidden.
5. **No secrets, tokens, credentials, or PII in logs.**
6. **Governance §12:** the banned entity ([REDACTED] — see governance
   doc) must never appear in any OQMInc material.

Full invariant set and enforcement rules:
[`PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_GOVERNANCE.md`](PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_GOVERNANCE.md).

---

## Contributing

Work flows through the **PROGRAM_CONTROL directive pipeline**:

1. Claude Chat authors a directive into `PROGRAM_CONTROL/DIRECTIVES/QUEUE/`.
2. An agent (Claude Code, GitHub Copilot, or human contributor) moves
   the directive to `IN_PROGRESS/`, opens a branch, executes exactly
   as written, and files a report-back in `PROGRAM_CONTROL/REPORT_BACK/`.
3. PR is reviewed per `.github/CODEOWNERS` + `ci.yml` + `super-linter.yml`;
   on merge the directive moves to `DONE/` and
   `docs/REQUIREMENTS_MASTER.md` is updated.

Do not push directly to `main`. Branch naming: `claude/<id>-<suffix>`,
`copilot/<id>-<suffix>`, or `<team>/<short-slug>`.

---

## License & authority

All content © OmniQuest Media Inc. Final authority: Kevin B. Hartley
(CEO). No agent clears a GOV gate without CEO-signed clearance in
`PROGRAM_CONTROL/CLEARANCES/`.
