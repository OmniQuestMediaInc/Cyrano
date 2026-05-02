# Error code + reason_code catalog — wireframe binding

Companion to `docs/UX_INTEGRATION_BRIEF.md` §4. Two columns of
vocabulary, two audiences.

- **`reason_code`** — operator/audit-facing. Rides on every ledger
  entry, audit event, and gate decision. Surfaces in audit log rows,
  ops dashboards, support tickets. Wireframes treat reason codes as
  small chips next to events.
- **`error_code`** — end-user-facing. Surfaces in toasts, banners,
  modal overlays. Wireframes treat error codes via the recommended
  copy slot below.

The two vocabularies overlap (same string can appear as both) but the
audience and component family differ. Keep separate.

---

## End-user error codes (every code = a copy slot)

Wireframes show the copy in the slot, not the raw code. Code stays
visible only in a "show details" expander for support routing.

| `error_code` | Recommended copy slot | UI component family |
|---|---|---|
| `TIER_INSUFFICIENT` | "Requires {tier_required} or higher" | inline-disabled CTA + tooltip |
| `STEP_UP_REQUIRED` | "Confirm with MFA to continue" | step-up-modal |
| `GEO_BLOCKED` | "Not available in your region" | geo-block-overlay |
| `KYC_REQUIRED` | "ID verification required to continue" | kyc-step-card |
| `AGE_VERIFICATION_REQUIRED` | "Age verification required" | gateguard-av-flow |
| `WELFARE_GUARDIAN_PAUSE` | "Take a moment — pause active for {n}m" | welfare-intervention-overlay |
| `GATEGUARD_DENY` | "Transaction declined for safety" | decision-banner (HARD_DECLINE) |
| `GATEGUARD_COOLDOWN` | "Please try again in {cooldown_remaining}" | decision-banner (COOLDOWN) |
| `GATEGUARD_HUMAN_ESCALATE` | "Routed to support — case #{case_id}" | decision-banner (HUMAN_ESCALATE) |
| `LEDGER_INSUFFICIENT_BUCKETS` | "Not enough tokens — top up?" | inline-error on wallet CTA |
| `LEDGER_INSUFFICIENT_FOR_DIAMOND_FLOOR` | "Quote below platform floor — try a larger bundle" | quote-card error state |
| `IDEMPOTENCY_REPLAY` | (no surface — silent success) | none |
| `IDEMPOTENCY_CONFLICT` | "This action was already requested differently — open support" | error-modal with correlation_id |
| `RATE_LIMITED` | "Slow down — try again in {retry_after_seconds}s" | inline-throttle banner |
| `CYRANO_SESSION_EXPIRED` | "Time's up — extend session?" | cyrano-topup-modal |
| `CYRANO_SESSION_DENIED` | depends on inner reason_code: TIER_INSUFFICIENT / KYC_REQUIRED / GATEGUARD_DENY | reason-code chip on request CTA |
| `RECOVERY_3_5THS_REQUIRES_OVERRIDE` | "Sent to an operator for review" | recovery-status-card |
| `LEGAL_HOLD_ACTIVE` | "Account on legal hold — contact support (ref #{hold_id})" | full-account-lockout |
| `BILL_149_DISCLOSURE_REQUIRED` | (the disclosure prefix string itself) | compliance-prefix-banner |
| `PUBLISH_GATE_BLOCKED` | "Profile incomplete: {missing_fields}" | publish-block-card |
| `PROFILE_AGE_REVERIFY_REQUIRED` | "Age re-verification required (every {n} days)" | gateguard-av-flow (re-verify) |
| `MEMBERSHIP_EXPIRING_SOON` | "{tier} expires in {hours}h — renew?" | header-warning-banner |
| `MEMBERSHIP_EXPIRED` | "{tier} expired — recover or 3/5ths exit?" | restricted-experience-overlay |
| `WALLET_BUCKET_EMPTY` | "{bucket} bucket is empty — drawing from {next_bucket}" | wallet-passive-indicator |
| `STRIPE_CARD_DECLINED` | "Card declined — try another payment method" | payment-form error |
| `WEBHOOK_DUPLICATE` | (no end-user surface — operator-only) | none |
| `OBS_NOT_READY` | "Connect OBS before going live" | creator-readiness-banner |
| `CHAT_AGGREGATOR_NOT_READY` | "Connect chat aggregator to receive cross-platform tips" | creator-readiness-banner |
| `STUDIO_AFFILIATION_PENDING` | "Studio affiliation pending — earnings will accrue once approved" | creator-status-banner |

---

## Operator/audit reason codes (every code rides on a ledger row)

Wireframes display the raw `reason_code` as a chip on audit-log rows,
ledger detail screens, support-case detail screens. Tooltip on hover
shows the human description.

| `reason_code` | Where written | Operator-facing description |
|---|---|---|
| `PURCHASE` | every CZT purchase ledger row | Token purchase |
| `SPEND` | every CZT spend ledger row | Token spend |
| `PAYOUT` | creator payout ledger row | Creator payout |
| `STIPEND_DISTRIBUTED` | membership stipend distribution | Tier monthly stipend distributed |
| `WELCOME_CREDIT` | first-month welcome credit (currently inactive) | $100 welcome credit on $250 first-month spend |
| `TOKEN_BRIDGE_BONUS` | recovery — bridge offer accepted | Token Bridge bonus applied (20%) |
| `THREE_FIFTHS_REFUND` | recovery — 3/5ths exit | 3/5ths refund processed (60%) |
| `EXPIRATION_REDISTRIBUTION` | wallet expiration | Tokens redistributed at expiration |
| `PIXEL_LEGACY_SIGNING_BONUS` | Pixel Legacy month-4 bonus | Pixel Legacy creator signing bonus |
| `PAYOUT_SCALING_APPLIED` | FFS tier pushes payout up | Payout scaling applied for FFS tier |
| `BROADCAST_TIMING_COPILOT` | broadcast suggestion emitted | Broadcast timing copilot suggestion |
| `REDBOOK_SECTION_3` | rate card row source | REDBOOK §3 rate card |
| `FIZ-002-REVISION-2026-04-11` | 3/5ths exit policy gate | 3/5ths exit policy revision |
| `WELFARE_GUARDIAN_v1` | every WGS scoring event | Welfare Guardian Score v1 |
| `GATEGUARD_APPROVE` | gate approval | GateGuard approved |
| `GATEGUARD_COOLDOWN` | gate cooldown | GateGuard cooldown applied |
| `GATEGUARD_HARD_DECLINE` | gate hard decline | GateGuard hard decline |
| `GATEGUARD_HUMAN_ESCALATE` | gate human escalation | GateGuard escalated to HCZ |
| `GATEGUARD_AV_PASS` / `GATEGUARD_AV_FAIL` | AV check returned | Age verification result |
| `STEP_UP_CHALLENGE_ISSUED` | RBAC step-up start | Step-up MFA issued |
| `STEP_UP_CHALLENGE_VERIFIED` | RBAC step-up success | Step-up MFA verified |
| `STEP_UP_CHALLENGE_FAILED` | RBAC step-up failure | Step-up MFA failed |
| `LEGAL_HOLD_APPLIED` / `LEGAL_HOLD_LIFTED` | legal hold lifecycle | Legal hold state change |
| `WORM_EXPORT_TRIGGERED` / `WORM_EXPORT_COMPLETED` | WORM export lifecycle | WORM export state change |
| `RECONCILIATION_DRIFT_DETECTED` | reconciliation alarm | Drift detected — operator review required |
| `CYRANO_SUGGESTION_EMITTED` / `CYRANO_SUGGESTION_DROPPED` | whisper engine | Cyrano suggestion lifecycle |
| `CYRANO_LAYER2_SESSION_GRANTED` / `CYRANO_LAYER2_SESSION_DENIED` | Layer 2 session grant | Standalone Cyrano session decision |
| `CYRANO_LAYER4_RATE_LIMITED` | enterprise API rate limit | Layer 4 enterprise rate limit |
| `MEMBERSHIP_SUBSCRIPTION_CREATED` / `_CANCELLED` / `_EXPIRED` | membership lifecycle | Subscription state change |
| `STUDIO_AFFILIATION_GRANTED` / `_REVOKED` | studio affiliation | Studio affiliation state change |
| `BENEFIT_LIMIT_REACHED` | tier benefit cap hit | Tier limit reached on {dimension} |
| `PROMO_APPLIED` / `PROMO_EXPIRED` | promotion engine | Promo lifecycle |
| `WEBHOOK_VERIFIED` / `WEBHOOK_REJECTED` / `WEBHOOK_DUPLICATE` / `WEBHOOK_DEAD_LETTER` | FIZ webhook hardening | Webhook lifecycle |
| `DFSP_OTP_ISSUED` / `_VERIFIED` / `_FAILED` / `_EXPIRED` | DFSP OTP module | Platform OTP lifecycle |
| `DFSP_ACCOUNT_HOLD_APPLIED` / `_RELEASED` | DFSP account-recovery hold | Account hold lifecycle |
| `INTEGRITY_HOLD_AUTHORIZED` / `_RELEASED` / `_CAPTURED` | DFSP integrity hold | Integrity hold lifecycle |

---

## Surfacing rules

1. Audit-log rows always show `reason_code` + `correlation_id` + `actor_id`
   + timestamp.
2. End-user errors always show `error_code` resolved to the copy slot;
   the raw code is only in a collapsed "details" expander.
3. Both surfaces always include `correlation_id` for support routing —
   end-user surface in the details expander; operator surface inline.
4. No surface ever exposes `payload_hash` / `hash_prior` / `hash_current`
   to end users — those are operator-only on the audit chain viewer.
