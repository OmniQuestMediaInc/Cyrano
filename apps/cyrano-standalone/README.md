# Cyrano Layer 2 — Standalone Next.js App

**Status:** Scaffolding only. Phase 3.10 of the FFS / SenSync / CZT / VelocityZone
upgrade. Wires the persistent-worlds copilot UI that VIP / Diamond creators can
unlock as a separate runtime.

## Scope

- VIP-gated Cyrano whisper console with persistent session memory
  (sourced from `services/cyrano/src/session-memory.store.ts`, Postgres-backed
  via the `cyrano_session_memory` table).
- CZT monetization surface for premium Cyrano modes (no ShowToken — single
  CZT economy applies here too).
- Reads `ffs.score.update`, `sensync.bpm.update`, and
  `cyrano.suggestion.emitted` over NATS (proxied via the core API).

## Ship gate

Layer 2 must NOT ship until:

1. Layer 1 is hardened (persistence + adaptive prompts) — done.
2. Cyrano Layer 1 NATS topics are stable — done.
3. SenSync consent UI is live in the main UI shell — pending.

## Local dev

```bash
cd apps/cyrano-standalone
yarn install
yarn dev
```

The app reaches the rest of the platform via the core API (HTTP + NATS
subscriptions); it does not embed the monorepo Prisma client directly.
