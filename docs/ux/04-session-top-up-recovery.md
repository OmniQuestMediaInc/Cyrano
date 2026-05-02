# 04 — Session Top-Up & Recovery

**Role:** VIP Member (VIP and above)
**Purpose:** Recover an expired or low-time Cyrano session by purchasing additional minutes
**Status:** Alpha Frozen
**Authority:** Kevin B. Hartley, CEO — OmniQuest Media Inc.

---

## API / Presenter Binding

| Operation | Endpoint | Notes |
|---|---|---|
| Get top-up options | `GET /cyrano/session/top-up-options` | Returns available minute bundles for guest's tier |
| Purchase top-up | `POST /cyrano/session/top-up` | FIZ-scoped; requires `correlation_id` + `idempotency_key` |
| Resume session | NATS: `cyrano.session.resumed` | Emitted by server on payment confirmation |

**FIZ scope:** `POST /cyrano/session/top-up` touches CZT balance — FIZ rules apply.
Commit prefix for any changes to this endpoint: `CYR: + FIZ:` with `REASON`, `IMPACT`,
`CORRELATION_ID` in commit message.

---

## Trigger Conditions

The top-up modal is triggered by either:

1. **NATS `cyrano.session.expired` event** — session has reached 0 minutes (hard expiry).
2. **Guest taps "Top Up Session" CTA** — proactive top-up while session is still active
   (sticky banner visible when ≤ 5 minutes remain).

---

## State Machine: Top-Up Flow

```
SESSION EXPIRED  (or guest taps Top Up CTA)
    │
    ▼
TOP_UP_MODAL_OPEN
    │
    ├──[guest selects bundle + confirms]──▶ PAYMENT_PENDING
    │                                           │
    │                                           ├──[payment success]──▶ RESUMED
    │                                           │                          │
    │                                           │      (NATS: cyrano.session.resumed)
    │                                           │                          ▼
    │                                           │                  Session continues
    │                                           │
    │                                           └──[payment failed]──▶ TOP_UP_MODAL_OPEN
    │                                                                   (error shown inline)
    │
    └──[guest dismisses]──▶ SESSION CLOSED
                              (guest routed to home; session not recoverable)
```

- `reason_code: CYRANO_SESSION_EXPIRED` is present on the `AuditRow` for the expiry event.
- `reason_code: TOP_UP_CONFIRMED` is written on successful purchase.
- `reason_code: TOP_UP_FAILED` is written on payment failure (with error detail).
- `correlation_id` from the original session is carried through the top-up transaction.

---

## Layout: Top-Up Modal

```
┌─────────────────────────────────────────────────────────┐
│  ⏱ Session Ended                                        │
│  Your Cyrano session has ended.                         │
│  Add time to continue your story.                       │
├─────────────────────────────────────────────────────────┤
│  Select a time bundle:                                  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  ○  30 minutes   —  {price_czt} CZT             │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │  ●  60 minutes   —  {price_czt} CZT  ★ Popular  │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │  ○  120 minutes  —  {price_czt} CZT             │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  WalletBuckets balance:                                 │
│  Purchased: {czt_purchased} CZT                         │
│  Gifted:    {czt_gifted} CZT                            │
├─────────────────────────────────────────────────────────┤
│  [Dismiss]                     [Add Time — {price} CZT] │
└─────────────────────────────────────────────────────────┘
```

### Payment In-Progress State

After guest taps "Add Time":

```
┌─────────────────────────────────────────────────────────┐
│  ⏱ Adding time…                                         │
│  [Loading spinner]                                      │
│  Please wait — do not close this window.                │
└─────────────────────────────────────────────────────────┘
```

UI is locked (no dismiss) while payment is pending to prevent duplicate submissions.
`idempotency_key` prevents double-charge on retry.

### Payment Failed State

```
┌─────────────────────────────────────────────────────────┐
│  ⚠ Payment could not be processed                       │
│  {error_message}                                        │
│  reason_code: TOP_UP_FAILED  ref: {correlation_id}      │
├─────────────────────────────────────────────────────────┤
│  [Dismiss]                              [Try Again]     │
└─────────────────────────────────────────────────────────┘
```

"Try Again" generates a new `idempotency_key` for the retry attempt.

### Insufficient Balance

If guest's CZT balance is below the selected bundle price:

```
┌─────────────────────────────────────────────────────────┐
│  Insufficient balance for this bundle.                  │
│  Current balance: {total_czt} CZT                       │
│  [Buy CZT →]         or         [Choose smaller bundle] │
└─────────────────────────────────────────────────────────┘
```

"Buy CZT" routes to the CZT purchase flow (CNZ wallet bridge — out of scope for Cyrano Alpha UI).

---

## Proactive Top-Up CTA (≤ 5 Minutes Remaining)

When `cyrano.session.tick` indicates ≤ 5 minutes remaining, a sticky banner renders at the
bottom of the session chat surface (above the input bar):

```
┌─────────────────────────────────────────────────────────┐
│  ⏱ 4 min remaining  —  [Top Up Session]                 │
└─────────────────────────────────────────────────────────┘
```

Tapping "Top Up Session" opens the top-up modal while the session is still active.
On successful top-up, the modal dismisses and the timer resets to the purchased duration
(added to remaining time).

---

## Session Dismissed Without Top-Up

If the guest taps "Dismiss" on the expiry modal:

1. Session state transitions to `CLOSED`.
2. Guest is routed to the Cyrano home / persona gallery.
3. The session transcript is preserved (read-only) for 24 hours in the guest's account.
4. `AuditRow` written with `reason_code: SESSION_DISMISSED_NO_TOPUP`.

---

## Idempotency

| Field | Requirement |
|---|---|
| `correlation_id` | Must match the originating session's `correlation_id` |
| `idempotency_key` | New UUID v4 per top-up attempt (not per session) |

The server returns HTTP 200 with the cached response if the same `idempotency_key` is replayed
within 24 hours, preventing double-charge on network retry.

---

## Compliance

| Layer | Trigger | Action |
|---|---|---|
| Welfare Guardian `SOFT_NUDGE` | Guest top-up count ≥ 3 in single day | Non-blocking nudge on modal header |
| Welfare Guardian `COOL_DOWN` | FFS INFERNO band active during top-up | 5-min cool-down before top-up is permitted |
| Welfare Guardian `HARD_DECLINE_HCZ` | WGS critical threshold | Top-up blocked; HCZ escalation; `reason_code: HARD_DECLINE_HCZ` |
| Bill 149 | CZT purchase (if routed to CNZ bridge) | Handled by CNZ wallet surface |
| FIZ | All CZT balance mutations in top-up endpoint | `REASON`, `IMPACT`, `CORRELATION_ID` required in commit |

---

## Copy Slots

```
Modal title (expired):    ⏱ Session Ended
Modal title (proactive):  ⏱ Add More Time
Modal body:               Add time to continue your story.
Bundle label:             {N} minutes — {price_czt} CZT
Popular badge:            ★ Popular
CTA:                      Add Time — {price_czt} CZT
Dismiss:                  Dismiss
In-progress:              Adding time… Please wait.
Failed title:             ⚠ Payment could not be processed
Insufficient:             Insufficient balance for this bundle.
Sticky banner:            ⏱ {N} min remaining — [Top Up Session]
```

---

*Binding: `services/narrative-engine/src/narrative.types.ts` ·
NATS: `cyrano.session.expired`, `cyrano.session.resumed`, `cyrano.session.tick` ·
FIZ-scoped endpoint: `POST /cyrano/session/top-up`*
