# State machines — wireframe binding catalog

Companion to `docs/UX_INTEGRATION_BRIEF.md` §3. Each machine here is a
binding contract between Grok's wireframes and CNZ's runtime. Every
state has a CTA prescription so wireframes show the right action at
the right moment, and every transition has a triggering event so the
wireframe knows whether the surface is NATS-driven or
request/response.

---

## SM-01 — Token purchase + three-bucket allocation

**Source of truth:** `services/ledger/ledger.service.ts` (`record`,
`spend`); `services/core-api/src/config/governance.config.ts`
(`LEDGER_SPEND_ORDER`); `services/core-api/src/gateguard/gateguard.middleware.ts`.

```
                 ┌──────────────────────────────────────────────────────┐
[user clicks Buy]│                                                      │
       │         │                                                      │
       ▼         │                                                      │
   PENDING ───► GATEGUARD_PRE_PROCESS ──► APPROVED ──► LEDGER_RECORDED ─┤
                  │                                                     │
                  ├──► COOLDOWN          (cooldown_until_utc surfaced)  │
                  ├──► HARD_DECLINE      (terminal; reason_code shown)  │
                  └──► HUMAN_ESCALATE    (route to HCZ; case_id shown)  │
                                                                        │
                                                                  SETTLED
```

| State | Wire surface | UI element | CTA |
|---|---|---|---|
| PENDING | optimistic local | spinner on Buy CTA | Cancel |
| GATEGUARD_PRE_PROCESS | NATS `GATEGUARD_EVALUATION_COMPLETED` | "Reviewing for safety…" microcopy | none |
| APPROVED | NATS `GATEGUARD_DECISION_APPROVED` | green check, advance to record | none |
| COOLDOWN | NATS `GATEGUARD_DECISION_COOLDOWN` | overlay with countdown | "Try again in {n}" |
| HARD_DECLINE | NATS `GATEGUARD_DECISION_HARD_DECLINE` | error banner with reason_code chip | "Contact support" |
| HUMAN_ESCALATE | NATS `GATEGUARD_DECISION_HUMAN_ESCALATE` | escalation card with case_id | "Open case" |
| LEDGER_RECORDED | request/response on Buy reply | bucket-update animation | none |
| SETTLED | next render of `WalletThreeBucketView` | three-bucket display refreshed | "View wallet" |

---

## SM-02 — Three-bucket spend order

**Source of truth:** `LEDGER_SPEND_ORDER = ['purchased', 'membership', 'bonus']`
in `services/core-api/src/config/governance.config.ts`. UI surface: every
spend (gift, tip, game play, Cyrano top-up).

Deterministic — there is no UI debounce or user-elected bucket. The
`will_drain_next: true` flag on `WalletBucketRow`
(`ui/types/public-wallet-contracts.ts:80`) marks the bucket the next
spend draws from.

| Bucket | Priority | Visual |
|---|---|---|
| `purchased` | 1 | dollar-sign motif; "Drains first" indicator when populated |
| `membership` | 2 | tier-color motif; "Drains next" when purchased empty |
| `bonus` | 3 | promo motif; "Last to drain" indicator |

Spend always exhausts higher-priority buckets before drawing from
lower-priority ones. UI must never offer the user a bucket selector.

---

## SM-03 — Recovery lifecycle

**Source of truth:** `RecoveryStageTag` in
`ui/types/admin-diamond-contracts.ts:9`.

```
OPEN ─► TOKEN_BRIDGE_OFFERED ─► TOKEN_BRIDGE_ACCEPTED ─┐
   │                                                   ├─► RESOLVED
   ├─► THREE_FIFTHS_EXIT_POLICY_GATED ─► THREE_FIFTHS_EXIT_OFFERED ─┤
   │                                          ▲                     │
   │                                          │ requires CEO override
   │                                          │
   └─► EXPIRATION_PROCESSED ──────────────────────────────────────────┘
```

| Stage | Operator CTA on `/admin/recovery` | Member-facing visibility |
|---|---|---|
| `OPEN` | Open case detail | "Recovery review in progress" banner |
| `TOKEN_BRIDGE_OFFERED` | View Token Bridge offer | Token Bridge CTA card on member wallet |
| `TOKEN_BRIDGE_ACCEPTED` | Process bridge | "Bridge processed" toast |
| `THREE_FIFTHS_EXIT_POLICY_GATED` | Send to operator queue | "Sent to operator for review" |
| `THREE_FIFTHS_EXIT_OFFERED` | Approve / deny refund | 3/5ths refund CTA card |
| `EXPIRATION_PROCESSED` | Close case | "Tokens expired" banner |
| `RESOLVED` | (none) | "Case resolved" history row |

Reason codes carried through every transition: `TOKEN_BRIDGE_BONUS_PCT`,
`THREE_FIFTHS_REFUND_PCT`, `FIZ-002-REVISION-2026-04-11`, etc.

---

## SM-04 — Membership lifecycle

**Source of truth:** `docs/MEMBERSHIP_LIFECYCLE_POLICY.md` v1.0.

```
ACTIVE ──► EXPIRING (48h warning sent) ──► EXPIRED ──► RECOVERED ─► (back to ACTIVE)
                  │                            │
                  └─────────────► 3/5THS_EXIT ─┘
```

| State | UI surface | CTA |
|---|---|---|
| ACTIVE | normal experience | none |
| EXPIRING | header banner with hours-until-expiry | "Renew" / "Recover" |
| EXPIRED | restricted experience overlay | "Recover" / "3/5ths Exit" / "Re-subscribe" |
| RECOVERED | success toast | none |
| 3/5THS_EXIT | terminal lockout with refund status | "View refund status" |

Notification cadence: 48h warning is idempotent within the warning
window (`RecoveryEngine.send48HourWarning`); UI must not spam.

---

## SM-05 — Cyrano session lifecycle (Layer 2 standalone)

**Source of truth:** `services/cyrano/` Layer 2 grant events; NATS
`CYRANO_LAYER2_SESSION_GRANTED|DENIED`.

```
[user requests session] ─► CYRANO_LAYER2_SESSION_GRANTED ─► MINUTES_DECREMENTING
                       └► CYRANO_LAYER2_SESSION_DENIED   ─► (terminal; reason_code)

MINUTES_DECREMENTING ─► EXPIRED ─► [user buys top-up] ─► TOP_UP_PURCHASED ─► RESUMED
                              └─► [user closes session] ─► (terminal)
```

| State | UI element |
|---|---|
| GRANTED | session minutes meter starts |
| MINUTES_DECREMENTING | live minute counter; warning when <5 minutes |
| EXPIRED | full overlay: "Time's up" with top-up modal |
| TOP_UP_PURCHASED | brief "Adding minutes…" indicator |
| RESUMED | meter refreshed with new total |
| DENIED | reason_code chip on the request CTA (TIER_INSUFFICIENT, KYC_REQUIRED, etc.) |

---

## SM-06 — Cyrano persona scope

New machine introduced in this brief. Reflects how
`CyranoWhisperPanel.personas_available`
(`ui/types/creator-panel-contracts.ts:46-52`) groups personas.

```
creator-global  ─► cyrano-template  ─► per-VIP-custom
   (default)         (creator-tuned)     (per-member)
```

Wireframe surface: persona switcher dropdown with three sections in
this order. Each section header labels the scope. Active persona
indicated via `active: true` field on the persona entry.

---

## SM-07 — FFS tier transitions

**Source of truth:** `services/creator-control/src/ffs.engine.ts`;
`FfsTier` in `ui/types/creator-control-contracts.ts:6`.

```
COLD ◄──► WARM ◄──► HOT ◄──► INFERNO
```

Deterministic transitions — no UI debounce. Transitions emit
`FFS_TIER_CHANGED` (NATS); meter component must redraw on receipt.

| Tier | Score range | Payout scaling | UI cue |
|---|---|---|---|
| COLD | 0-33 | 0% | grey gauge fill |
| WARM | 34-60 | 0% | yellow gauge fill |
| HOT | 61-85 | 5% | orange gauge fill + "+5%" indicator |
| INFERNO | 86-100 | 10% | red gauge fill + "+10%" indicator + Inferno badge |

---

## SM-08 — Welfare Guardian bands

**Source of truth:** `services/core-api/src/gateguard/welfare-guardian.scorer.ts`
(thresholds 40 / 70 / 90 — verified in `ship-gate-verifier.ts:159-162`).

```
0   ────────── 40 ────────── 70 ────────── 90 ────────── 100
   OK            SOFT_NUDGE     COOL_DOWN     HARD_DECLINE_HCZ
   (no UI)       (banner)       (block 5min)  (lockout + HCZ)
```

| Band | Score | Intervention | UI |
|---|---|---|---|
| OK | 0-39 | none | none |
| SOFT_NUDGE | 40-69 | non-blocking | toast banner with reason chip |
| COOL_DOWN | 70-89 | blocking 5-min | overlay with countdown |
| HARD_DECLINE_HCZ | 90-100 | lockout | overlay with "Contact HCZ" CTA + case_id |

---

## SM-09 — Step-up auth challenge

**Source of truth:** `services/core-api/src/auth/rbac.service.ts`; NATS
`STEP_UP_CHALLENGE_ISSUED|VERIFIED|FAILED`.

```
[operator clicks gated action] ─► CHALLENGE_ISSUED ─► MFA prompt
                                                          │
                                          ┌─── verified ──┴── failed ───┐
                                          ▼                              ▼
                                      GRANTED                         DENIED
                                          │                              │
                                          └────► AUDIT_RECORDED ◄────────┘
```

Single shared `step-up-modal` component across all 7 step-up actions
(see brief §2). Modal surfaces:
- Action label (e.g. "Confirm refund override")
- MFA input
- `correlation_id` (visible in collapsed footer for support routing)
- Spinner during verify
- Success / failure toast
- Audit event ID after AUDIT_RECORDED

---

## SM-10 — Pixel Legacy onboarding

**Source of truth:** glossary §CREATOR PAYOUT (3,000 cap); creator
onboarding service.

```
APPLY ─► SEAT_CAP_CHECK ─► GRANTED_PIXEL_LEGACY (if cap not reached)
                       └─► GRANTED_STANDARD       (if cap reached)
```

Wireframe surface: onboarding wizard step "Pixel Legacy status" — shows
either "You're a Pixel Legacy creator (locked-in benefits)" or "Pixel
Legacy seats are full — Standard creator onboarding" with the rate
range visible in either case.

---

## SM-11 — Diamond Concierge handoff

**Source of truth:** `services/integration-hub/src/hub.service.ts`
(`emitDiamondConciergeHandoff`); `services/diamond-concierge/`.

```
HIGH_HEAT_DETECTED (FFS HOT/INFERNO + spend velocity)
        │
        ▼
HANDOFF_OFFERED ─► QUOTE_ISSUED ($0.077 platform floor applied)
                              ├─► ACCEPTED ─► session opened
                              └─► DECLINED ─► no further action
```

Operator-side surface (`/admin/diamond`): handoff CTA card with
`platform_floor_applied: true|false` chip on the quote.

Member-side surface (Diamond Concierge member panel): "Concierge offer
available" CTA → quote modal → accept/decline.

---

## SM-12 — GateGuard decision (every financial write)

**Source of truth:** `GateGuardDecision` type;
`gateguard-feed` row on `DiamondCommandCenterView.gateguard_feed`
(`ui/types/admin-diamond-contracts.ts:97-107`).

```
PURCHASE | SPEND | PAYOUT
        │
        ▼
GateGuard evaluation
        │
   ┌────┼────┬─────────────┐
   ▼    ▼    ▼             ▼
APPROVE COOLDOWN HARD_DECLINE HUMAN_ESCALATE
```

Used as the "decision banner" component family across every financial
CTA. Reason codes always surfaced as chips.

---

## SM-13 — Cyrano subscription tier (Cyrano standalone)

**Source of truth:** `services/core-api/src/subscription/subscription.types.ts`.

This is a **separate** machine from MembershipTier. Cyrano standalone
is the Stripe-billed personal AI companion app. SubscriptionTier:
`SPARK | FLAME | INFERNO`. Status: `ACTIVE | PAST_DUE | CANCELED |
EXPIRED`.

Wireframes for the Cyrano standalone app must use this tier set;
wireframes for ChatNow.Zone core must use MembershipTier. Never mix.
