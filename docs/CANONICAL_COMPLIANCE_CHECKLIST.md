# Canonical Compliance Checklist — L0 Ship-Gate

**Document:** `docs/CANONICAL_COMPLIANCE_CHECKLIST.md`
**Owner:** OmniQuest Media Inc. — Kevin B. Hartley, CEO
**Governing Documents:**
- `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OQMI_GOVERNANCE.md`
- Canonical Corpus v10 (Chapter 7 — Compliance & Governance)
- REDBOOK §5 — Recovery & Refund Doctrine
- Business Plan B.5 — GateGuard Sentinel Pre-Processor
- `docs/AUDIT_CERTIFICATION_V1.md`

> This checklist pins the L0 invariants that must be TRUE before
> ChatNow.Zone crosses the hard-launch gate on 2026-10-01.
> Each row maps to a verifiable artefact (code path, migration, test).
> Compliance is enforced continuously via `/audit/chain/verify` and
> the hash-chained `immutable_audit_events` ledger.

---

## 1. Immutable Audit Architecture — L0

| # | Invariant | Enforcement | Artefact |
| - | --- | --- | --- |
| 1.1 | Every sensitive action emits a hash-chained audit event | Service layer + DB triggers | `services/core-api/src/audit/immutable-audit.service.ts` |
| 1.2 | Audit ledger is append-only — no UPDATE, no DELETE | PostgreSQL triggers | `prisma/migrations/20260424120000_immutable_audit_architecture/migration.sql` |
| 1.3 | `hash_current = SHA-256(hash_prior ‖ payload_hash)` | `ImmutableAuditService.computeChainHash` | `immutable-audit.service.ts:computeChainHash` |
| 1.4 | Raw PII / secrets NEVER enter the ledger | `payload_hash` only — caller redacts | `immutable-audit.service.ts:hashPayload` + `audit-bridge.service.ts:redact` |
| 1.5 | `correlation_id` is globally unique → idempotent emission | Unique index + service short-circuit | `emit()` idempotency branch |
| 1.6 | Integrity verification replays the full chain on demand | `/audit/chain/verify` endpoint | `immutable-audit.controller.ts` |
| 1.7 | Periodic WORM export seals ordered event ranges | SHA-256 hash_seal persisted | `worm_export_records` + `/audit/chain/worm-export` |
| 1.8 | Chain-integrity failure publishes NATS P0 signal | `AUDIT_CHAIN_INTEGRITY_FAILURE` topic | `topics.registry.ts` |

## 2. RBAC + Step-Up Authentication — L0

| # | Invariant | Enforcement | Artefact |
| - | --- | --- | --- |
| 2.1 | Every permission check flows through `RbacService.authorize()` | Audit-emitting wrapper | `services/core-api/src/auth/rbac.service.ts` |
| 2.2 | Role matrix is single-source: VIEWER < CREATOR < MODERATOR < COMPLIANCE < ADMIN | `PERMISSION_MATRIX` in `RbacGuard` | `auth/rbac.guard.ts` |
| 2.3 | Step-up auth is REQUIRED for irreversible actions | `PERMISSION_TO_STEP_UP` gating | `auth/rbac.service.ts` |
| 2.4 | Step-up uses TOTP / backup codes only — SMS is prohibited | `StepUpMethod` type + `StepUpService` comments | `auth/step-up.service.ts` |
| 2.5 | Every allow / deny emits an `RBAC_DECISION` audit event | `ImmutableAuditService.emit` from `RbacService` | `auth/rbac.service.ts:authorize` |
| 2.6 | Challenge + verification + failure emit separate audit events | Bridged via `AuditBridgeService` | `audit/audit-bridge.service.ts` |

### 2.7 Actions requiring step-up

- Wallet mutations (`WALLET_MODIFICATION`)
- Payout / rate-card changes (`PAYOUT_CHANGE`)
- Takedown / legal-hold submission (`TAKEDOWN_SUBMISSION`)
- Account freeze / suspension (`ACCOUNT_FREEZE`)
- Content deletion (`CONTENT_DELETION`)
- Refund / 3/5ths Exit override (`REFUND_OVERRIDE`)
- Geo block modification (`GEO_BLOCK_MODIFICATION`)
- Payment detail changes (`PAYMENT_DETAIL_CHANGE`)

## 3. Canonical Compliance Lockdown — L0

| # | Invariant | Enforcement | Artefact |
| - | --- | --- | --- |
| 3.1 | Three-bucket spend order: PROMOTIONAL_BONUS → MEMBERSHIP_ALLOCATION → PURCHASED | Ledger service + defence-in-depth middleware | `finance/ledger.service.ts:debitWallet` + `finance/three-bucket-spend-guard.middleware.ts` |
| 3.2 | Advisory AI (Cyrano, GateGuard) is advisory-only — never autonomous on finance paths | GateGuard decisions audit-logged + human-escalate on HARD_DECLINE | `gateguard/gateguard.service.ts` + audit bridge |
| 3.3 | Processor abstraction boundary — no direct PSP calls from feature code | `PaymentsModule` + processor SPI | `payments/*` |
| 3.4 | Legal hold lifecycle events are captured in the immutable chain | Bridge: `LEGAL_HOLD_APPLIED` / `LEGAL_HOLD_LIFTED` | `audit/audit-bridge.service.ts` |
| 3.5 | Reconciliation drift raises a RED_BOOK_ESCALATION audit event | Bridge: `RECONCILIATION_DRIFT_DETECTED` | `audit/audit-bridge.service.ts` |
| 3.6 | GateGuard pre-processor runs before every `/purchase`, `/spend`, `/payout` | `GateGuardMiddleware.forRoutes` | `app.module.ts` |
| 3.7 | Human authorization boundary — no irreversible action without step-up + audit | `RbacService` + `ImmutableAuditService` | `auth/rbac.service.ts` |

## 4. Operational / Ship-Gate Readiness

| # | Invariant | Status | Gate |
| - | --- | --- | --- |
| 4.1 | Prisma schema drift = 0 vs. migrations | ✅ migration `20260424120000_immutable_audit_architecture` added | `yarn prisma:generate` |
| 4.2 | Lint passes with `--max-warnings 0` | Verified per commit | `yarn lint` |
| 4.3 | Unit + integration tests pass | Verified per commit | `yarn test` |
| 4.4 | Audit chain verification endpoint returns `valid=true` | Required before each release | `GET /audit/chain/verify` |
| 4.5 | WORM export succeeds for latest 24h window | Required before each release | `POST /audit/chain/worm-export?from=…&to=…` |
| 4.6 | NATS topics list is single-source-of-truth | No ad-hoc topic strings in services | `services/nats/topics.registry.ts` |

## 5. FIZ (Financial / Irreversible / Zonal) Commit Discipline

All commits that touch a financial or audit path MUST carry the four-line
FIZ trailer:

```
FIZ: <invariant-id>
Rule-Applied-Id: <RULE_ID>
Affected-Systems: <ledger|audit|rbac|gateguard|recovery|diamond>
Canonical-Ref: <Corpus §, or REDBOOK §, or Business Plan B.x>
```

Schema changes additionally require a Human-Review entry in
`docs/AUDIT_CERTIFICATION_V1.md` before merge.

---

**Last verified:** 2026-04-24 — PAYLOAD 6 immutable audit architecture landed.
