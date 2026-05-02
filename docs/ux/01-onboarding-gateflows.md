# UX Spec — GateGuard + Step-Up Auth Flow

**Document:** `docs/ux/01-onboarding-gateflows.md`
**Stack:** Shared / Cross-Stack (all stacks)
**Status:** draft
**Authority:** OmniQuest Media Inc. — Kevin B. Hartley, CEO
**Last updated:** 2026-04-28

---

## 1. Overview

This spec defines the full UX contract for identity verification and elevated-action
authentication across all ChatNow.Zone venues. It applies whenever a Guest, VIP,
Member, Creator, or Operator must prove identity or confirm a high-value action
before the platform allows the request to proceed.

**Binding surface:** `GateGuardSentinelAV` contract + `StepUpAuthModal` (shared
component, rendered as a full-screen modal overlay).

---

## 2. Role Coverage

| Role | Trigger condition |
|------|-------------------|
| Guest (`GUEST`) | AV challenge on any CZT spend; mandatory before tier elevation |
| VIP (`VIP`) | Step-up on elevated actions; 30-day age re-verify cadence |
| VIP Silver / Gold / Platinum / Diamond | Step-up on every new paid block purchase; AV re-verify on each renewal |
| Creator | AV at registration; step-up on payout-touching actions |
| Operator / Admin | Step-up REQUIRED for every irreversible action (see §6) |

---

## 3. State Machine

```
challenge_issued
      │
      ▼
  mfa_or_biometric          ← TOTP / backup code (SMS prohibited — §2.4 compliance)
  or document_upload         ← Document + selfie (AV path)
      │
      ├─ GRANT ──────────────► audit_emit(reason_code, correlation_id)
      │                            │
      │                            └──► resume_original_flow
      │                                     + success_toast
      │
      └─ DENY ───────────────► audit_emit(reason_code, correlation_id)
                                   │
                                   ├─ welfare_score < SOFT_NUDGE threshold
                                   │       └──► inline error + retry allowed
                                   │
                                   ├─ welfare_score ≥ COOL_DOWN threshold
                                   │       └──► mandatory 5-min pause + SOFT_NUDGE banner
                                   │
                                   └─ welfare_score ≥ HARD_DECLINE_HCZ threshold
                                           └──► full block + HCZ escalation + RedBook
```

Every state transition emits an immutable audit event via `ImmutableAuditService`
(see `services/core-api/src/audit/`) with the fields:
- `correlation_id` — globally unique, idempotent
- `reason_code` — machine-readable outcome tag
- `rule_applied_id` — compliance fingerprint
- `zk_proof_hash` — zero-knowledge compliance proof (GGS requirement)

---

## 4. Layout Intent — Modal Overlay

The `StepUpAuthModal` renders as a **full-screen overlay** on all viewports.

### 4.1 Visual Hierarchy

```
┌──────────────────────────────────────────────────────┐
│  [Dark overlay, full-screen]                         │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │  HEADER                                        │  │
│  │  "Identity Verification Required"              │  │
│  │  (red accent border on critical-tier actions)  │  │
│  ├────────────────────────────────────────────────┤  │
│  │  WELFARE GUARDIAN BAND — badge strip           │  │
│  │  [green → amber → red based on WGS tier]      │  │
│  ├────────────────────────────────────────────────┤  │
│  │  PROGRESS STEPPER                              │  │
│  │  ① Verify Identity  ② Confirm  ③ Complete     │  │
│  ├────────────────────────────────────────────────┤  │
│  │  BODY — mutually exclusive input zones         │  │
│  │                                                │  │
│  │  AV path:                                      │  │
│  │    [ Document upload panel ]                   │  │
│  │    [ Selfie capture panel  ]                   │  │
│  │                                                │  │
│  │  Step-up MFA path:                             │  │
│  │    [ 6-digit TOTP / backup-code input ]        │  │
│  │                                                │  │
│  ├────────────────────────────────────────────────┤  │
│  │  COMPLIANCE OVERLAYS (conditional)             │  │
│  │  Bill 149 ON prefix — shown when AI content    │  │
│  │  follows the verified action                   │  │
│  ├────────────────────────────────────────────────┤  │
│  │  FOOTER CTAs                                   │  │
│  │  [ Continue ]          [ Cancel ]              │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

### 4.2 Colour Tokens

| State | Background | Accent / border |
|-------|------------|-----------------|
| Standard | Dark (`#0A0A0F`) | None |
| Warning (SOFT_NUDGE) | Dark | Amber |
| Critical (HARD_DECLINE_HCZ) | Dark | Red (`--color-critical`) |

---

## 5. Compliance Overlays

### 5.1 Welfare Guardian Band Badge

Displayed as a fixed badge strip directly below the modal header.
State driven by `WelfareGuardianScore` result (`welfare_score`, `tier`):

| WGS tier | Badge colour | Label |
|----------|-------------|-------|
| `low` (0–39) | Green | Welfare check: OK |
| `medium` (40–64) | Amber | Welfare check: Caution |
| `high` (65–84) | Orange | Welfare check: High — pause recommended |
| `critical` (85–100) | Red | Welfare check: Critical — HCZ escalation |

The badge is **non-dismissible**. It must remain visible for the full duration
of the modal session.

### 5.2 Bill 149 ON Disclosure Prefix

When the action that triggered the flow will result in AI-generated content
being delivered to the Guest (e.g. a Cyrano-assisted interaction), prepend
the following disclosure inside the modal body before the input zone:

> **AI Disclosure (Bill 149 ON):** The content or assistance that follows
> this verification may be generated or influenced by artificial intelligence.

This overlay is **conditional** — shown only when the post-verification
destination surfaces AI content.

---

## 6. Auto-Trigger Conditions

The GateGuard Sentinel pre-processor automatically raises a step-up challenge
for the following high-value actions (from §2.7 of the Canonical Compliance
Checklist):

| Action category | Audit event tag |
|-----------------|-----------------|
| Large CZT purchase (threshold from `GovernanceConfig`) | `WALLET_MODIFICATION` |
| Cyrano top-up spend above bulk tier | `WALLET_MODIFICATION` |
| Admin / Operator ledger adjustment | `PAYOUT_CHANGE` |
| Payout or rate-card change | `PAYOUT_CHANGE` |
| Account freeze / suspension | `ACCOUNT_FREEZE` |
| Content deletion | `CONTENT_DELETION` |
| Takedown / legal-hold submission | `TAKEDOWN_SUBMISSION` |
| Refund / Three-Fifths Exit override | `REFUND_OVERRIDE` |
| Payment detail change | `PAYMENT_DETAIL_CHANGE` |
| Geo block modification | `GEO_BLOCK_MODIFICATION` |

Auto-trigger logic lives in `services/core-api/src/auth/rbac.service.ts`
(`PERMISSION_TO_STEP_UP` gating) and `services/core-api/src/gateguard/`.

---

## 7. Interaction Flows

### 7.1 Happy Path (GRANT)

1. Guest / Operator initiates a high-value action.
2. GateGuard Sentinel pre-processor intercepts — emits `challenge_issued`.
3. `StepUpAuthModal` renders (full-screen overlay, dark background).
4. Welfare Guardian Band badge renders (colour-coded by current WGS tier).
5. Progress stepper shows step 1 active.
6. Depending on context:
   - **AV path** — document upload panel + selfie capture panel presented.
   - **MFA step-up path** — 6-digit TOTP / backup-code input presented.
7. Guest completes verification; system emits `GRANT` audit event with
   `reason_code`, `correlation_id`, `zk_proof_hash`.
8. Modal dismisses.
9. **Success toast** displayed: "Identity verified — continuing your request."
10. Original flow resumes uninterrupted.

### 7.2 Deny Path — Soft (retry allowed)

1. Verification fails (welfare_score below `SOFT_NUDGE` threshold).
2. Inline error rendered inside modal body.
3. Guest may retry; attempt count tracked and surfaced in progress stepper.
4. Audit event emitted per attempt.

### 7.3 Deny Path — COOL_DOWN

1. `WelfareGuardianScore` returns tier `high` (65–84).
2. Modal switches to COOL_DOWN state; Welfare Guardian Badge turns orange.
3. Mandatory 5-minute pause enforced — countdown timer shown.
4. `SOFT_NUDGE` care banner rendered:
   > "We noticed some unusual activity. Please take a moment before continuing."
5. After pause, Guest may reattempt.
6. Audit event emitted with `reason_code: COOL_DOWN`.

### 7.4 Deny Path — HARD_DECLINE_HCZ (critical)

1. `WelfareGuardianScore` returns tier `critical` (85–100).
2. Modal header border switches to red accent.
3. Action is fully blocked.
4. HCZ escalation is raised automatically.
5. RedBook playbook ID (`redbook_playbook_id`) attached to the audit event.
6. Guest sees:
   > "We're unable to proceed with this action at this time. Our support team
   > has been notified and will follow up."
7. Cancel CTA is the only active footer control.
8. Audit event emitted with `reason_code: HARD_DECLINE_HCZ`, `correlation_id`,
   `zk_proof_hash`.

### 7.5 Cancel

1. Guest taps **Cancel** in the footer.
2. Modal dismisses without emitting a GRANT.
3. Original flow is abandoned; Guest returns to their prior screen.
4. No audit penalty; cancellation is logged as `challenge_abandoned`.

---

## 8. Presenter / Binding Contract

| Binding | Detail |
|---------|--------|
| GGS AV contract | `GateGuardSentinelAV` — `services/core-api/src/gateguard/` |
| Step-up service | `StepUpService` — `services/core-api/src/auth/step-up.service.ts` |
| RBAC guard | `RbacGuard` / `RbacService` — `services/core-api/src/auth/` |
| Audit emission | `ImmutableAuditService` — `services/core-api/src/audit/` |
| NATS publish | `GATEGUARD_*` topic family — `services/nats/topics.registry.ts` |
| Welfare score | `WelfareGuardianScore` (`welfare_score`, `tier`) |
| Shared modal component | `StepUpAuthModal` (Black-Glass surface; `BG:` prefix for commits) |

---

## 9. Accessibility Requirements

- Modal must trap keyboard focus for the duration of the overlay.
- All CTAs reachable via Tab order; Enter submits the active CTA.
- Welfare Guardian Badge colour changes accompanied by an ARIA live-region
  announcement.
- Progress stepper exposes `aria-current="step"` on the active step.
- Document upload panel supports keyboard-accessible file chooser.

---

## 10. Open Items (draft)

| # | Item | Owner |
|---|------|-------|
| 10.1 | Confirm `GovernanceConfig` key name for large-purchase threshold | Program Control |
| 10.2 | Biometric (HeartSync / SenSync™) step-up path detail — deferred to HZ spec | HZ team |
| 10.3 | Exact TOTP retry-limit count before COOL_DOWN escalates | Auth team |
| 10.4 | Animation spec for modal entry / exit | Black-Glass designer |
| 10.5 | Localisation strings for Bill 149 ON disclosure | Compliance |
