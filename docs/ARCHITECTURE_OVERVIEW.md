# Architecture Overview — ChatNow.Zone (Payloads 1 → 8)

**Authority:** OmniQuest Media Inc. — Canonical Corpus v10
**Status at 2026-04-25:** Functionally complete for internal alpha
(PAYLOAD 7 frontend polish + PAYLOAD 8 ship-gate verification landed).
**Branch of record:** `claude/frontend-polish-concierge-ui-mlqrR`.

This document is the single, top-level map of the ChatNow.Zone build.
For per-service detail, follow the links into `services/*/` and
`docs/`. For the live status of any individual requirement, consult
`docs/REQUIREMENTS_MASTER.md`.

---

## 1. Domain layers

| Layer                | Path                                                         | Purpose                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Governance constants | `services/core-api/src/config/governance.config.ts`          | Single source of truth for REDBOOK rate cards, Diamond Tier table, Recovery Engine rules, ledger spend order.                                                      |
| Canonical Ledger     | `services/ledger/`                                           | Three-bucket wallet, append-only hash chain, idempotent spend, payout.                                                                                             |
| Diamond Concierge    | `services/diamond-concierge/`                                | Volume + velocity pricing, safety-net metadata, liquidity snapshot.                                                                                                |
| Recovery Engine      | `services/recovery/` + `services/ledger/recovery.service.ts` | Token Bridge, Three-Fifths Exit, expiration distribution.                                                                                                          |
| GateGuard Sentinel   | `services/core-api/src/gateguard/`                           | Pre-processor for every PURCHASE / SPEND / PAYOUT; Welfare Guardian Score.                                                                                         |
| RBAC + step-up       | `services/core-api/src/auth/`                                | Role decision + audit + step-up coordination.                                                                                                                      |
| Compliance           | `services/core-api/src/compliance/`                          | Audit chain, geo fencing, sovereign CAC, legal hold, WORM export.                                                                                                  |
| Immutable audit      | `services/core-api/src/audit/`                               | Hash-chained ledger of every sensitive action; integrity verifier.                                                                                                 |
| Flicker n'Flame Scoring            | `services/creator-control/src/ffs.engine.ts`           | Deterministic tier computation from telemetry.                                                                                                                     |
| Creator Control      | `services/creator-control/`                                  | Broadcast Timing + Session Monitoring copilots, single-pane snapshot.                                                                                              |
| Cyrano Layer 1       | `services/cyrano/`                                           | 8-category whisper engine, persona memory, latency SLO.                                                                                                            |
| Integration Hub      | `services/integration-hub/`                                  | Wires Ledger ↔ GateGuard, Recovery ↔ Concierge, Flicker n'Flame Scoring ↔ CreatorControl + Cyrano.                                                                               |
| Notification         | `services/notification/`                                     | 48h warnings, personal-touch follow-ups, dispatcher abstraction.                                                                                                   |
| UI layer             | `ui/`                                                        | Type contracts + view-model presenters + page render plans for `/admin/diamond`, `/admin/recovery`, `/creator/control`, `/tokens`, `/diamond/purchase`, `/wallet`. |
| Tests                | `tests/integration/` + `tests/e2e/`                          | Jest integration suite + Payload-8 end-to-end flows.                                                                                                               |
| Program control      | `PROGRAM_CONTROL/`                                           | Directive queue / in-progress / done; report-backs; ship-gate verifier.                                                                                            |

## 2. Payload roll-up

| Payload | Theme                    | Headline deliverable                                                                              |
| ------- | ------------------------ | ------------------------------------------------------------------------------------------------- |
| 1       | Canonical Ledger         | Three-bucket wallet + hash-chain + idempotent writes.                                             |
| 2       | Recovery Engine          | REDBOOK §5 — Token Bridge, 3/5ths Exit, Expiration.                                               |
| 3       | GateGuard                | Welfare Guardian Score + middleware + decisioner.                                                 |
| 4       | OBS + Streaming          | Flicker n'Flame Scoring sample contract + OBS bridge + chat aggregator stubs.                                   |
| 5       | Creator Control / Cyrano | Single-pane workstation + 8-category whisper engine.                                              |
| 6       | Immutable Audit          | Append-only hash-chain + WORM export + Canonical Compliance Checklist.                            |
| 7       | Frontend Polish          | Diamond Concierge UI + CreatorControl pages + guest rate cards + dark mode + SEO + accessibility. |
| 8       | E2E Validation           | Ship-gate verifier + comprehensive end-to-end tests + final docs.                                 |

## 3. Real-time fabric (NATS)

NATS JetStream is the only chat / telemetry transport. REST polling is
forbidden by governance doctrine. Topic naming lives at
`services/nats/topics.registry.ts`.

Key topic families:

- `LEDGER_*` — wallet, payout, recovery
- `GATEGUARD_*` — decisions, telemetry
- `CREATOR_CONTROL_*` — heat, nudge, broadcast suggestions
- `CYRANO_*` — suggestions, drops, persona changes
- `AUDIT_IMMUTABLE_*` — chain writes per event class
- `WORM_EXPORT_*` — export started / completed
- `RECOVERY_*` — case open, offer, accept

## 4. Data + persistence

- **Postgres** (port 5432, internal-only) — primary store.
  Schema lives at `prisma/schema.prisma`; ledger triggers at
  `infra/postgres/init-ledger.sql`.
- **Redis** (port 6379, internal-only) — Bull queues + dedup window
  for the warning queue.
- **Append-only invariant** — Postgres triggers reject UPDATE/DELETE
  on every ledger / audit / consent / session / vault / suppression /
  identity-verification table.

## 5. Identity, RBAC, step-up

`RbacService.authorize` is the only correct entry point for any
mutating service. It returns `{ permitted, step_up_required }`. The
following permissions require completed step-up before the underlying
action can execute:

| Permission            | Step-up action           |
| --------------------- | ------------------------ |
| `refund:override`     | `REFUND_OVERRIDE`        |
| `suspension:override` | `ACCOUNT_FREEZE`         |
| `ncii:suppress`       | `CONTENT_DELETION`       |
| `legal_hold:trigger`  | `TAKEDOWN_SUBMISSION`    |
| `geo_block:modify`    | `GEO_BLOCK_MODIFICATION` |
| `rate_card:configure` | `PAYOUT_CHANGE`          |
| `worm:export`         | `WALLET_MODIFICATION`    |

Every authorization check produces an immutable audit event via
`ImmutableAuditService.emit`.

## 6. UI architecture (PAYLOAD 7)

The UI layer is a thin, render-agnostic layer:

- **Type contracts** in `ui/types/` — JSON-safe shapes (`bigint` → string at the boundary).
- **View-model presenters** in `ui/view-models/` — pure TypeScript classes
  that compose service outputs into renderable view models. No NestJS,
  no I/O.
- **Render plans** in `ui/components/render-plan.ts` — framework-agnostic
  tree of `RenderElement` nodes that document the exact UI surface a
  Next.js (or any other) renderer must produce.
- **Page builders** in `ui/app/<route>/page.ts` — accept presenter
  inputs and return a `{ metadata, view, tree }` triple.
- **Theme + SEO + accessibility** in `ui/config/` — single source of
  truth for branding, route metadata, breakpoints, and dark-mode tokens.

The Next.js bootstrap is **not yet committed**; Payload 7 builds the
contract surface so a follow-up payload can drop a Next.js renderer
adapter that consumes `RenderElement` trees without rewriting the
view-models.

## 7. Build + test surface

| Command                                         | Purpose                                |
| ----------------------------------------------- | -------------------------------------- |
| `yarn lint` / `yarn lint:fix`                   | ESLint `services/**/*.ts`.             |
| `yarn format` / `yarn format:check`             | Prettier across the tree.              |
| `yarn typecheck` / `yarn typecheck:api`         | `tsc --noEmit`.                        |
| `yarn test`                                     | Jest integration + unit suite.         |
| `yarn prisma:generate`                          | Regenerate Prisma client.              |
| `yarn prisma:push`                              | Push Prisma schema.                    |
| `yarn seed:scheduling`                          | Seed GuestZone reference data.         |
| `ts-node PROGRAM_CONTROL/ship-gate-verifier.ts` | Run the L0 ship-gate compliance check. |

## 8. Governance binding

Every commit is bound to:

1. **OQMI Coding Doctrine v2.0** — `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_SYSTEM_STATE.md`.
2. **OQMI Governance** — `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_GOVERNANCE.md`.
3. **REDBOOK §3–§5** — pricing, recovery, payout governance.
4. **Canonical Compliance Checklist** — `PROGRAM_CONTROL/CANONICAL_COMPLIANCE_CHECKLIST.md`.
5. **Hard banned-entity §12** — never reference the redacted name in any artifact.

## 9. Open work (not in PAYLOADs 1–8)

- Black-Glass Interface (G101+) — full visual treatment of the rendered
  HTML / OBS overlays.
- Cyrano Layer 2 — LLM + Prisma memory persistence.
- FairPay + NOWPayouts wiring — D006, E002.
- OBS Broadcast Kernel — D004 (current state: scaffold + bridge stubs).
- `legal_holds.correlation_id` migration (FIZ-scoped follow-up).

These items are tracked in `docs/REQUIREMENTS_MASTER.md` with
status `NEEDS_DIRECTIVE`.
