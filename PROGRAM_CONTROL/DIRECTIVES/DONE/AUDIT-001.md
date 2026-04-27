### DIRECTIVE: AUDIT-001

**Status:** `[ ] TODO`
**Commit prefix:** `AUDIT:`
**Target path:** `services/core-api/src/compliance/audit-chain.service.ts` (CREATE)
**Risk class:** R0
**Gate:** Do not start until MOD-001 is merged.

**Context:** The Canonical Corpus (Chapter 7, §5 + Appendix D) defines the hash-chained
audit event model. Each event is hash-linked to the prior event block:
`E(n) → HASH(E(n-1) + E(n))`. The integrity verification tool must confirm
replay-to-commit consistency. This service computes and verifies the hash chain.
SHA-256 is the required algorithm (per `WormExportService` precedent).

**Task:** Create `services/core-api/src/compliance/audit-chain.service.ts`

The service must implement:

- `computeEventHash(prior_hash: string, event_payload: object): string` — SHA-256 of `prior_hash + JSON.stringify(event_payload)`
- `verifyChain(events: AuditChainEvent[]): AuditChainVerificationResult` — replays the chain and confirms each stored hash matches computed hash
- `GENESIS_HASH` constant — `'0'.repeat(64)` — used as prior hash for the first event
- All operations use Node.js `crypto.createHash('sha256')` — no external libraries
- Logger instance present
- NATS publish on chain integrity failure (`AUDIT_CHAIN_INTEGRITY_FAILURE` topic)

```typescript
export interface AuditChainEvent {
  event_id: string;
  prior_hash: string;
  stored_hash: string;
  payload: object;
  created_at_utc: string;
}

export interface AuditChainVerificationResult {
  valid: boolean;
  events_verified: number;
  first_failure_event_id: string | null;
  failure_reason: string | null;
  verified_at_utc: string;
  rule_applied_id: string;
}
```

**Add `AuditChainService` to `ComplianceModule` providers and exports.**

**Add NATS topic if not present:**

```typescript
AUDIT_CHAIN_INTEGRITY_FAILURE: 'audit.chain.integrity_failure',
```

**Validation:**

- `computeEventHash('0'.repeat(64), { id: 'e1' })` produces a 64-character hex string
- `verifyChain([])` returns `valid: true`, `events_verified: 0`
- `verifyChain()` returns `valid: false` and identifies the first tampered event
- `verifyChain()` returns `valid: true` for a correctly chained sequence
- NATS published on integrity failure
- `npx tsc --noEmit` zero new errors

**Report-back file:** `PROGRAM_CONTROL/REPORT_BACK/AUDIT-001-AUDIT-CHAIN-SERVICE.md`
