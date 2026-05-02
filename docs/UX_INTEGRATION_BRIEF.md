# UX Integration Brief — ChatNow.Zone (CNZ) + Cyrano

**Authority:** OmniQuest Media Inc. — Canonical Corpus v10
**Branch of record:** `claude/alpha-testing-ux-brief-N8M57`
**Status:** `@alpha-frozen` — binding target for Grok wireframe handoff
**Companion docs:** `docs/ux/STATE_MACHINES.md`, `docs/ux/ERROR_REASON_CODES.md`,
`docs/ux/01-wallet-three-bucket.md`, `docs/ux/02-diamond-command-center.md`,
`docs/ux/03-creator-control.md`
**Cross-stack pair:** `OmniQuestMediaInc/RedRoomRewards` — see §7

---

## How to read this brief

Grok binds wireframes to **presenter contracts** (`ui/types/*.ts`) — not to the
raw API and not to the eventual Next.js renderer. The presenter layer is the
stable, JSON-safe shape that survives backend refactors. Every screen element
in a wireframe must trace to a named field on one of the contracts listed in §1.

Naming is non-negotiable. The values in `docs/DOMAIN_GLOSSARY.md` are
canonical. If a name in this brief conflicts with the glossary, the glossary
wins; raise a reconciliation row in the §7 block.

Three of CNZ's prior reference values drifted from code; this brief uses the
in-code values:

- **Wallet buckets** — three (`purchased | membership | bonus`), per
  `ui/types/public-wallet-contracts.ts:10` and `LEDGER_SPEND_ORDER`. The
  glossary's two-bucket reference (PURCHASED/GIFTED) is stale and is
  reconciled in §7.
- **FFS bands** — `COLD | WARM | HOT | INFERNO`, per
  `ui/types/creator-control-contracts.ts:6`. Earlier "cool/warm/hot/high-heat"
  copy is non-canonical.
- **Pixel Legacy seat-cap** — 3,000 (per glossary). Earlier "3,500" copy is
  non-canonical.

---

## §1. Frozen presenter contracts (the binding target)

Every presenter contract below is marked `@alpha-frozen` in TSDoc. Field
additions are versioned migrations; field removals require CEO sign-off.

| Contract file | Surface(s) | Top-level view model |
|---|---|---|
| `ui/types/admin-diamond-contracts.ts` | `/admin/diamond`, `/admin/recovery` | `DiamondCommandCenterView`, `RecoveryCommandCenterView` |
| `ui/types/public-wallet-contracts.ts` | `/wallet`, `/tokens`, `/diamond/purchase` | `WalletThreeBucketView`, `TokenBundleRateCard`, `DiamondPurchaseQuoteCard` |
| `ui/types/creator-panel-contracts.ts` | `/creator/control` | `CreatorCommandCenterView` |
| `ui/types/creator-control-contracts.ts` | `/creator/control` (subordinate) | `CreatorControlDashboard`, `CyranoPanelFeed` |
| `ui/types/rewards-contracts.ts` | `/rewards`, Diamond Concierge member surface | `RewardsDashboardView`, `DiamondConciergeDashboardView` |
| `ui/types/gamification-contracts.ts` | `/creator/gamification`, in-chat game surfaces | `CreatorGamificationDashboard`, `PlayerGameOption`, `PlayOutcomeView` |

**View-model presenters** (pure TypeScript composers — no I/O):

- `ui/view-models/diamond-concierge.presenter.ts`
- `ui/view-models/creator-control.presenter.ts`
- `ui/view-models/public-wallet.presenter.ts`
- `ui/view-models/gamification.presenter.ts`
- `ui/view-models/rewards.presenter.ts`

**Page builders** (consume presenters → emit `{ metadata, view, tree }`):

- `ui/app/admin/diamond/page.ts`, `ui/app/admin/recovery/page.ts`
- `ui/app/creator/control/page.ts`
- `ui/app/tokens/page.ts`, `ui/app/diamond/purchase/page.ts`, `ui/app/wallet/page.ts`
- `ui/app/rewards/page.ts`

**Render plan primitives** — `ui/components/render-plan.ts` (`el()`,
`RenderElement`). Wireframes annotate with `test_id` (already used in the
existing render plans) so QA bindings survive across UI rewrites.

---

## §2. Endpoint / surface inventory by role

CNZ has six distinct viewer roles. The matrix below maps each surface to
who sees it, what triggers step-up auth, and the canonical permission name
(see `services/core-api/src/auth/rbac.service.ts`).

| Surface | Guest | VIP / VIP_SILVER / VIP_GOLD / VIP_PLATINUM | VIP_DIAMOND | Creator (Pixel Legacy + Standard) | OQMI Operator (Admin / CS / Compliance / Legal) | Diamond Concierge (operator role, zero earn) |
|---|---|---|---|---|---|---|
| `/tokens` (rate cards) | view | view | view | — | view (audit) | view (audit) |
| `/wallet` | own | own | own | — | view (any wallet, audit) | view (any wallet, audit) |
| `/diamond/purchase` | — | view (gated) | full | — | view (audit) | full (operator-side quote tooling) |
| `/creator/control` | — | — | — | own surface | view (any creator, audit) | view (any creator, audit) |
| `/creator/gamification` | — | — | — | own surface | view + `rate_card:configure` (step-up) | — |
| `/admin/diamond` | — | — | — | — | full (RBAC: `admin.diamond_command_center`) | full |
| `/admin/recovery` | — | — | — | — | full (`admin.recovery_command_center`) | full |
| `/rewards` | own | own | own | — | view (audit) | — |
| Diamond Concierge member surface | — | — | view + book session | — | view (audit) | full (operator schedule) |
| Compliance overlays (legal hold, geo-block UI) | — | — | — | — | full (`legal_hold:trigger`, `geo_block:modify` — both step-up) | — |
| WORM export trigger | — | — | — | — | full (`worm:export` — step-up) | — |

**Step-up actions** (RBAC-1 in `ship-gate-verifier.ts:194-201`):

- `refund:override` → `REFUND_OVERRIDE`
- `suspension:override` → `ACCOUNT_FREEZE`
- `ncii:suppress` → `CONTENT_DELETION`
- `legal_hold:trigger` → `TAKEDOWN_SUBMISSION`
- `geo_block:modify` → `GEO_BLOCK_MODIFICATION`
- `rate_card:configure` → `PAYOUT_CHANGE`
- `worm:export` → `WALLET_MODIFICATION`

Wireframes must show the step-up modal as a **single shared component**
across all seven actions — same shape, same NATS audit emission
(`STEP_UP_CHALLENGE_ISSUED` / `_VERIFIED` / `_FAILED`).

**Diamond Concierge clarification:** in-code definition is *"Security and
Fraud function with hospitality surface"* (`docs/DOMAIN_GLOSSARY.md:102`).
Treat it as an operator role with zero earn (matches RRR). The
"Diamond Concierge handoff offered to a VIP_DIAMOND member" is a service
*offered by* this role, not a tier attribute on the member.

---

## §3. State machines

Full catalog with transition tables and CTA-per-state mapping lives in
`docs/ux/STATE_MACHINES.md`. Headline machines wireframes must respect:

| Machine | Source of truth | States | Drives UI elements |
|---|---|---|---|
| Token purchase + three-bucket allocation | `services/ledger/ledger.service.ts` (`record`, `spend`) + `services/core-api/src/config/governance.config.ts` (`LEDGER_SPEND_ORDER`) | `PENDING → GATEGUARD_PRE_PROCESS → APPROVED|COOLDOWN|HARD_DECLINE|HUMAN_ESCALATE → LEDGER_RECORDED → SETTLED` | Buy CTA, GateGuard banner, spend-order indicator |
| Three-bucket spend order | `LEDGER_SPEND_ORDER = ['purchased', 'membership', 'bonus']` | deterministic; `will_drain_next` field on `WalletBucketRow` | Wallet draw order indicator |
| Recovery lifecycle | `ui/types/admin-diamond-contracts.ts:9-16` | `OPEN → TOKEN_BRIDGE_OFFERED → TOKEN_BRIDGE_ACCEPTED → THREE_FIFTHS_EXIT_POLICY_GATED → THREE_FIFTHS_EXIT_OFFERED → EXPIRATION_PROCESSED → RESOLVED` | Recovery case row, CTA tile (Token Bridge / 3/5ths Exit) |
| Membership lifecycle | `docs/MEMBERSHIP_LIFECYCLE_POLICY.md` | `ACTIVE → EXPIRING (48h warning) → EXPIRED → RECOVERED → 3/5THS_EXIT` | 48h warning banner, recovery CTAs |
| Cyrano session lifecycle | `services/cyrano/` (Layer 1 + Layer 2 grant events) | `GRANTED → MINUTES_DECREMENTING → EXPIRED → TOP_UP_PURCHASED → RESUMED` | Minutes meter, top-up modal |
| Cyrano persona scope | new in this brief; follows persona switcher in `CyranoWhisperPanel.personas_available` | `creator-global → cyrano-template → per-VIP custom` | Persona switcher dropdown grouping |
| FFS tier transitions | `services/creator-control/src/ffs.engine.ts` + `ui/types/creator-control-contracts.ts:6` | `COLD ↔ WARM ↔ HOT ↔ INFERNO` (deterministic, no debouncing) | FFS meter, payout-rate indicator, persona scaling badge |
| Welfare Guardian bands | `services/core-api/src/gateguard/welfare-guardian.scorer.ts` (thresholds 40 / 70 / 90) | `OK (0-39) → SOFT_NUDGE (40-69) → COOL_DOWN (70-89) → HARD_DECLINE_HCZ (90-100)` | Welfare panel badge, intervention overlay |
| Step-up auth challenge | `services/core-api/src/auth/rbac.service.ts` + NATS `STEP_UP_*` topics | `CHALLENGE_ISSUED → MFA → GRANTED|DENIED → AUDIT_RECORDED` | Shared modal across all 7 step-up actions |
| Pixel Legacy onboarding | `docs/DOMAIN_GLOSSARY.md` (3,000 seat cap) | `APPLY → SEAT_CAP_CHECK → GRANTED_PIXEL_LEGACY|GRANTED_STANDARD` | Onboarding wizard step 3 |
| Diamond Concierge handoff | `services/integration-hub/src/hub.service.ts` (`emitDiamondConciergeHandoff`) | `HIGH_HEAT_DETECTED → HANDOFF_OFFERED → QUOTE_ISSUED ($0.077 floor) → ACCEPTED|DECLINED` | Handoff CTA card on `/admin/diamond` |
| GateGuard decision (every financial write) | `ui/types/admin-diamond-contracts.ts:102` | `APPROVE → COOLDOWN → HARD_DECLINE → HUMAN_ESCALATE` | Buy CTA, decision banner, ops live feed |
| Cyrano subscription tier (Cyrano standalone app, distinct from MembershipTier) | `services/core-api/src/subscription/subscription.types.ts` | `SPARK → FLAME → INFERNO` (tier upgrades; ACTIVE / EXPIRED status) | Cyrano standalone upgrade screen |

**Important separation:** the **subscription tier** (SPARK/FLAME/INFERNO,
Cyrano standalone) and the **MembershipTier** (GUEST/VIP/.../VIP_DIAMOND, CNZ
core) are **two distinct domains**. Wireframes must never conflate them.

---

## §4. Error code + reason_code catalog

`reason_code` rides on every ledger row, audit event, and gate decision —
audience is the operator (audit log, ops dashboards). `error_code` is the
user-facing surface — copy slot lives next to the error catalog. Same
vocabulary, different audiences.

Full enumeration with recommended copy slots in
`docs/ux/ERROR_REASON_CODES.md`. The most-frequent codes wireframes must
handle:

| Code | Surface | UI behavior | Copy slot |
|---|---|---|---|
| `TIER_INSUFFICIENT` | gated CTA | disable + tooltip | "Requires {tier_required}" |
| `STEP_UP_REQUIRED` | admin write CTA | open shared step-up modal | "Confirm with MFA to continue" |
| `GEO_BLOCKED` | any mutation | block with sovereign-CAC overlay | "Not available in your region" |
| `KYC_REQUIRED` | payout / first purchase | route to KYC flow | "ID verification required" |
| `AGE_VERIFICATION_REQUIRED` | signup, first high-value | route to GateGuard AV | "Age verification required" |
| `WELFARE_GUARDIAN_PAUSE` | spend / chat send | overlay (intervention) | "Take a breath — pause active" |
| `GATEGUARD_DENY` | purchase / spend / payout | hard-decline banner | "Transaction declined for safety" |
| `LEDGER_INSUFFICIENT_BUCKETS` | spend | inline error on wallet | "Not enough tokens" |
| `IDEMPOTENCY_REPLAY` | financial write retry | silent success (return original) | (no UI surface) |
| `IDEMPOTENCY_CONFLICT` | diverging payload retry | hard error + correlation_id surface | "This action was already requested differently" |
| `CYRANO_SESSION_EXPIRED` | Cyrano session | top-up modal | "Time's up — extend session?" |
| `RECOVERY_3_5THS_REQUIRES_OVERRIDE` | refund flow | route to operator queue | "Sent to operator for review" |
| `LEGAL_HOLD_ACTIVE` | any wallet mutation | full lockout + ref number | "Account on legal hold — contact support" |
| `BILL_149_DISCLOSURE_REQUIRED` | any CREATOR_AUTO=true output | prefix banner above message | (the disclosure prefix string itself) |
| `PUBLISH_GATE_BLOCKED` | creator publish | block + remediation list | "Profile incomplete: {missing_fields}" |

---

## §5. Tier + entitlement rules

### Six-tier MembershipTier (CNZ core)

Source of truth: `docs/MEMBERSHIP_LIFECYCLE_POLICY.md` v1.0. Locked enum:
`GUEST | VIP | VIP_SILVER | VIP_GOLD | VIP_PLATINUM | VIP_DIAMOND`.

| Tier | Paid? | Cyrano access | Diamond Concierge eligibility | Inferno multiplier visible | Notes |
|---|---|---|---|---|---|
| `GUEST` | no | none | no | no | 31-day expiry |
| `VIP` | no | starter | no | when own session in HOT/INFERNO | 30-day age re-verify |
| `VIP_SILVER` | yes | extended | no | yes | 90+1d block |
| `VIP_GOLD` | yes | extended | no | yes | 90+1d block |
| `VIP_PLATINUM` | yes | premium | no | yes | 90+1d block |
| `VIP_DIAMOND` | yes | premium + voice | yes ($0.077 floor visible) | yes | binds Diamond Concierge per locked rules |

### UI-simplified `GuestTier` (presenter shorthand for /tokens, /wallet, /diamond/purchase)

`ui/types/public-wallet-contracts.ts:8` collapses the six-tier enum to three
display buckets: `GUEST | MEMBER | DIAMOND`. This is a **presenter-layer
simplification only** — the canonical six-tier enum still drives every
permission decision. Wireframes for guest-facing rate cards may use the
three-tier form; admin and operator surfaces must use the six-tier form.

### Creator types

| Type | Payout floor / ceiling | Lifetime Cyrano | Notes |
|---|---|---|---|
| Pixel Legacy | $0.075–$0.090 + Pixel Legacy Signing Bonus | flag set | 3,000 pre-launch registrant cap |
| Standard | $0.075–$0.090 | no | post-cap registrants |

### Diamond Concierge "zero earn" rule

Diamond Concierge operators do not earn from sessions they handle —
identical to RRR's CEO D2 rule. The UI must hide payout indicators on the
operator-side Concierge schedule view.

### FFS scaling visibility

`ui/types/creator-panel-contracts.ts:21-24`: `scaling_pct_applied: 0, 5, or 10`
when FFS tier hits HOT (5%) or INFERNO (10%). The "inferno multiplier"
badge surfaces only at INFERNO; HOT shows the 5% indicator without the
inferno-specific badge.

### Diamond Tier $0.077 platform floor

`services/diamond-concierge/src/diamond.service.ts` enforces the floor;
`platform_floor_applied: boolean` on `DiamondPurchaseQuoteCard` lets the UI
show "Floor applied" microcopy when true. **Distinct from** the
`RATE_DIAMOND_FLOOR = $0.080` creator payout floor on 10,000+ CZT bulk
(`docs/DOMAIN_GLOSSARY.md:82`) — different field, different audience.

---

## §6. Idempotency + rate-limit envelope

CNZ separates `correlation_id` from `idempotency_key` (matches RRR; matches
Stripe / AWS / Square). The UI must persist both across retries:

- `correlation_id` — links related operations across services for tracing.
  Required on every NATS event and audit row.
- `idempotency_key` — prevents double-spend on a single financial write.
  Returns the original entry on replay; returns conflict on diverging payload.

| Wire response | UI behavior |
|---|---|
| 200 with `idempotency_replay: true` | silent success — no toast, no double-confirmation |
| 409 `IDEMPOTENCY_CONFLICT` | hard error; surface `correlation_id` so user can open a support case |
| 429 with `retry_after_seconds` | exponential backoff with surfaced wait time and a "Try again in {n}s" countdown |
| NATS subscription drop | "Reconnecting…" pill in header; never silent fail; retry with backoff |
| GateGuard decision `COOLDOWN` | surface cooldown_until_utc; disable CTA until elapsed |
| GateGuard decision `HUMAN_ESCALATE` | route to HCZ contact pathway; show case_id |

Webhook receipt envelope (FIZ): `WEBHOOK_RECEIVED → WEBHOOK_VERIFIED |
WEBHOOK_REJECTED | WEBHOOK_DUPLICATE → WEBHOOK_DEAD_LETTER` — operator
dashboards display these; no end-user surface.

---

## §7. Cross-stack vocabulary (CNZ ↔ RRR)

Canonical source: `docs/DOMAIN_GLOSSARY.md`. The reconciliation block at the
end of this document (the **droid-ready code block**) lists every term that
must match between CNZ and RRR repos, with the canonical resolution.

Cross-cut terms:

- `ChatNow.Zone` — never aliased, never abbreviated, never `<XXXChatNow.com>`
- `OmniQuest Media Inc.` / `OQMInc` / `OQMI` — corporate parent
- `Diamond Concierge` — same operator role across both stacks; zero earn
- VIP tier names — `GUEST | VIP | VIP_SILVER | VIP_GOLD | VIP_PLATINUM | VIP_DIAMOND` (no bare `Diamond`, no bare `OmniPass+` as tiers)
- `Pixel Legacy` (3,000 cap) vs `Standard` creator types
- Three-bucket wallet (`purchased | membership | bonus`) ↔ RRR escrow analog
- `CZT` = ChatZoneTokens, the only CNZ currency
- `Flicker n'Flame Scoring (FFS)` — bands `COLD | WARM | HOT | INFERNO`; inferno multiplier visible at INFERNO only
- `Welfare Guardian Score (WGS)` — interventions `SOFT_NUDGE | COOL_DOWN | HARD_DECLINE_HCZ` at thresholds 40 / 70 / 90
- `GateGuard Sentinel` — pre-processor with decisions `APPROVE | COOLDOWN | HARD_DECLINE | HUMAN_ESCALATE`
- `Cyrano` — sub-brand; whisper console (L1) on creator surface, standalone runtime (L2) for member voice sessions
- `Bill 149 disclosure prefix` — every `CREATOR_AUTO=true` AI output
- `correlation_id` (trace) vs `idempotency_key` (financial replay) — distinct, never collapsed

Component-ontology cross-walk:

| RRR component | CNZ component family | Shared primitive |
|---|---|---|
| Escrow display | Wallet three-bucket display | bucket-row primitive |
| Tier badge | Tier badge | takes `tier_name` + optional `cap_pct` as props; never bake names in |
| Audit row | Audit chain row | takes `reason_code` + `correlation_id` as props |
| Step-up modal | Step-up modal | identical shape across both stacks |
| Reason-code chip | Reason-code chip | identical shape; copy resolution per stack |

---

## §8. What's NOT in the UI for Alpha (do not wireframe)

- **Slot machine** — RETIRED across all OQMI properties (CEO directive,
  this thread). `ui/components/slot-machine.ts` is a throw-stub; the
  `SLOT_MACHINE` value on `GameType` (`gamification-contracts.ts:5`) is
  marked `@deprecated` for backend type-compat only, never rendered. Wheel
  of Fortune and Dice remain in scope for the gamification surface.
- **Black-Glass Interface visual treatment** — deferred to v2 per
  `OQMI_SYSTEM_STATE.md` §4 (Payload 7 ships brand tokens + dark-mode
  default; full treatment is post-alpha)
- **Risk Engine surfaces** — D002 NEEDS_DIRECTIVE; no UI for Alpha
- **OBS Broadcast Kernel hardening surfaces** — D004 NEEDS_DIRECTIVE; no UI for Alpha
- **Cyrano Layer 3+ surfaces** — only L1 (creator whisper) and L2 (member
  voice) are in scope; L3 HCZ Whisper and L4 Enterprise API are deferred
- **Live payment processor flows** — Stripe integration is wired but
  Alpha shows a "Test mode" banner; no real card-entry forms in scope
- **WORM export rendering for end-users** — operator-only
- **Legal hold trigger UI for non-operators** — operator-only
- **Slot machine companion screens** (in-chat slot UI, prize-pool editor
  for slots) — RETIRED per above
- **GGS-AV iframe visual treatment** — gate is wired; final visual
  treatment is post-alpha

---

## §9. Real-time event topology (NATS-driven vs request/response)

NATS JetStream is the **only** transport for chat / haptic / live audit /
Cyrano session events / FFS / Welfare distress. REST polling for these is
forbidden by governance (`docs/ARCHITECTURE_OVERVIEW.md:50-52`). Topic
registry: `services/nats/topics.registry.ts`.

| Surface | Transport | Topics |
|---|---|---|
| `/creator/control` FFS meter | NATS | `FFS_SCORE_UPDATE`, `FFS_TIER_CHANGED`, `FFS_PEAK` |
| `/creator/control` Cyrano whisper panel | NATS | `CYRANO_SUGGESTION_EMITTED`, `CYRANO_SUGGESTION_DROPPED`, `CYRANO_FFS_FRAME_CONSUMED` |
| `/creator/control` price nudge card | NATS | `CREATOR_CONTROL_PRICE_NUDGE` |
| Chat send / receive | NATS | `CHAT_INGEST_RAW`, `CHAT_RESPONSE_OUTBOUND`, `CHAT_BROADCAST_STAGGERED` |
| Welfare distress | NATS | `GATEGUARD_WELFARE_DISTRESS_DETECTED` |
| GateGuard decisions (live ops feed) | NATS | `GATEGUARD_DECISION_*` family |
| Audit chain emissions (live audit) | NATS | `AUDIT_IMMUTABLE_*` family |
| Step-up auth (modal lifecycle) | NATS | `STEP_UP_CHALLENGE_ISSUED|VERIFIED|FAILED` |
| Cyrano session grant (Layer 2) | NATS | `CYRANO_LAYER2_SESSION_GRANTED|DENIED` |
| Recovery case audit | NATS | `RECOVERY_*` and `AUDIT_IMMUTABLE_RECOVERY` |
| `/wallet` view | request/response | poll on focus only; no push needed |
| `/tokens` rate card | request/response | static per render |
| `/admin/diamond` aggregate dashboard | request/response + NATS overlays | `DiamondCommandCenterView` is one-shot; gateguard_feed + welfare_panel update via NATS |
| `/rewards` history + balance | request/response | poll on focus |
| Diamond Concierge handoff offer | NATS | `HUB_DIAMOND_CONCIERGE_HANDOFF` |

NATS subscription drop UI behavior: surface a "Reconnecting…" pill;
never silent fail. Reconnect with exponential backoff; hold the last
known frame visible during reconnect.

---

## §10. Compliance / disclosure overlay system

A small set of overlays must be visually consistent across every surface:

| Overlay | Trigger | Surface | Component family |
|---|---|---|---|
| Bill 149 disclosure prefix | every CREATOR_AUTO=true AI output | inline above creator message | `compliance-prefix-banner` |
| Geo-block / sovereign CAC denial | request from blocked region | full-screen overlay before any mutation | `geo-block-overlay` |
| Age verification gate | first signup, every high-value spend, admission to gated zones | modal flow → GateGuard AV | `gateguard-av-flow` |
| Identity verification (KYC) | first payout, first high-value purchase | full flow card | `kyc-step-card` |
| Step-up auth | every action in the §2 step-up list | shared modal | `step-up-modal` |
| Welfare Guardian intervention | WGS crosses 40 / 70 / 90 | overlay (40 = SOFT_NUDGE banner; 70 = COOL_DOWN block; 90 = HARD_DECLINE_HCZ + HCZ contact) | `welfare-intervention-overlay` |
| Legal hold | account flagged | full account lockout + reference number | `legal-hold-lockout` |
| Reconciliation drift detected (operator only) | NATS `RECONCILIATION_DRIFT_DETECTED` | ops dashboard banner | `ops-drift-banner` |

All overlays must:
1. Be operable from keyboard (focus trap + ESC behavior per accessibility config)
2. Surface `correlation_id` for support-case routing
3. Emit a NATS audit event on dismiss / accept
4. Use the shared `compliance-overlay` primitive — single component, props vary

---

## Cross-stack vocabulary reconciliation — droid handoff

Paste the block below into both `OmniQuestMediaInc/cyrano` (this repo) and
`OmniQuestMediaInc/RedRoomRewards`. Each row is `term | canonical_resolution
| repo_action`. Droids in each repo apply the canonical resolution to
glossary, types, comments, and migrations as scoped per row.

```text
# OQMI CROSS-STACK VOCABULARY RECONCILIATION — 2026-05-02
# Authority: CEO (Kevin B. Hartley) — directive issued via UX_INTEGRATION_BRIEF
# Scope: OmniQuestMediaInc/cyrano + OmniQuestMediaInc/RedRoomRewards
# Apply order: 1) glossary 2) types/enums 3) comments 4) tests
# A "code-binding" change requires a versioned migration; a "doc-only"
# change is a CHORE: commit. FIZ: prefix only when financial-integrity
# fields are touched.

ROW 01 | term: ChatNow.Zone
       | canonical: "ChatNow.Zone" (exact casing; never abbreviated; never <XXXChatNow.com>)
       | cyrano:  enforce in DOMAIN_GLOSSARY (already canonical); add lint rule banning ChatNow.com / chatnow / chatnowzone in user-facing copy
       | rrr:     enforce in DOMAIN_GLOSSARY; same lint rule

ROW 02 | term: Diamond Concierge
       | canonical: operator role with zero earn (security + fraud function with hospitality surface). Service offered by this role to VIP_DIAMOND members; never a tier attribute on the member.
       | cyrano:  align glossary line ("specialty operator role"); ensure DiamondConciergeService.quotePrice path treats the operator as zero-earn; remove "tier-attribute" framing from any inline doc
       | rrr:     keep current model (already aligned); confirm zero-earn rule visible on member-facing booking surface

ROW 03 | term: idempotency_key vs correlation_id
       | canonical: TWO DISTINCT CONCEPTS. idempotency_key prevents double-spend on a single financial write. correlation_id traces related operations across services. Never collapse.
       | cyrano:  keep the distinction (already enforced); add explicit comment on every financial write helper noting which one is which; reject any merged `correlation_id_for_idempotency` usage
       | rrr:     keep the distinction (already enforced); same comment policy

ROW 04 | term: Slot machine
       | canonical: RETIRED across OQMI properties. Wheel of Fortune and Dice remain in scope.
       | cyrano:  ui/components/slot-machine.ts → throw-stub; gamification-contracts.ts GameType.SLOT_MACHINE → @deprecated for type-compat only; document in §8 of UX_INTEGRATION_BRIEF
       | rrr:     keep retired (already CEO D1); ensure no resurrected references

ROW 05 | term: reason_code vs error_code
       | canonical: TWO DISTINCT AUDIENCES. reason_code is operator/audit-facing on every ledger entry; error_code is end-user-facing surface. Same vocabulary may overlap; treat copy slots separately.
       | cyrano:  audit-row component takes reason_code as a prop; user-facing error component takes error_code
       | rrr:     identical pattern; share the audit-row primitive shape

ROW 06 | term: Tier badge component
       | canonical: One component family across both stacks. Takes (tier_name, optional cap_pct) as props. Never bakes in tier names.
       | cyrano:  six-tier names: GUEST | VIP | VIP_SILVER | VIP_GOLD | VIP_PLATINUM | VIP_DIAMOND
       | rrr:     five-tier names: PLATINUM | GOLD | SILVER | MEMBER | GUEST
       | both:    ship same component; different name prop per stack

ROW 07 | term: Three-bucket wallet
       | canonical: CNZ wallet uses three buckets — purchased | membership | bonus — with deterministic spend order LEDGER_SPEND_ORDER.
       | cyrano:  align glossary §TOKEN ECONOMY (currently lists PURCHASED/GIFTED — stale); add bucket: 'membership' to glossary; keep WalletBucket type as canonical
       | rrr:     RRR has three analogous buckets (Consumer Points Wallet, Model Allocation Wallet, Promotional Bonus); confirm WalletBuckets primitive can serve both stacks via prop variants

ROW 08 | term: Step-up auth
       | canonical: Identical state machine and modal shape across both stacks. challenge → MFA → grant|deny → audit.
       | cyrano:  7 step-up actions per RBAC (refund:override, suspension:override, ncii:suppress, legal_hold:trigger, geo_block:modify, rate_card:configure, worm:export)
       | rrr:     analogous actions on POST /admin/refunds, /admin/adjustments, high-value POST /earn — adopt CNZ's NATS topic shape for STEP_UP_CHALLENGE_*
       | both:    share the step-up-modal component family

ROW 09 | term: Bill 149 disclosure prefix
       | canonical: Required prefix on every CREATOR_AUTO=true AI-generated creator output. Self-contained string.
       | cyrano:  enforced via BILL_149_DISCLOSURE_PREFIX constant
       | rrr:     adopt same constant if/when AI-generated copy ships

ROW 10 | term: Welfare Guardian Score thresholds
       | canonical: 40 / 70 / 90 → SOFT_NUDGE / COOL_DOWN / HARD_DECLINE_HCZ. Score 0-39 = OK (no intervention).
       | cyrano:  enforced in welfare-guardian.scorer.ts (cooldownAt: 40 / hardDeclineAt: 70 / humanEscalateAt: 90)
       | rrr:     mirror thresholds if surfacing welfare badges; share the welfare-intervention-overlay primitive

ROW 11 | term: FFS tier names
       | canonical: COLD | WARM | HOT | INFERNO. NOT cool/warm/hot/high-heat. NOT capitalised differently.
       | cyrano:  enforced in ui/types/creator-control-contracts.ts:6
       | rrr:     adopt same names if surfacing inferno-multiplier visuals

ROW 12 | term: Pixel Legacy seat-cap
       | canonical: 3,000 pre-launch creator registrants (per glossary). NOT 3,500.
       | cyrano:  enforced in glossary; correct any drifted reference to 3,000
       | rrr:     N/A (RRR has no creator seat cap)

ROW 13 | term: GateGuard Sentinel decisions
       | canonical: APPROVE | COOLDOWN | HARD_DECLINE | HUMAN_ESCALATE. Single source of truth for any financial-write or content-moderation gate.
       | cyrano:  enforced via GateGuardDecision type
       | rrr:     adopt same decision vocabulary on RRR's gate analog; share decision-banner primitive

ROW 14 | term: WORM export
       | canonical: Operator-only surface. Trigger requires worm:export step-up.
       | cyrano:  enforced
       | rrr:     adopt if RRR ships an export trigger

ROW 15 | term: VIP_DIAMOND
       | canonical: Always written VIP_DIAMOND. Bare "DIAMOND" as a MembershipTier value is RETIRED.
       | cyrano:  enforced via append-only guard in prisma/seed.test.ts
       | rrr:     N/A — but if RRR ever names a top tier, do not call it bare DIAMOND

ROW 16 | term: OmniPass / OmniPass+
       | canonical: PRODUCTS in the Entitlement / Pass / Product domain. NEVER MembershipTier values.
       | cyrano:  enforced; OMNIPASS_PLUS removed from MembershipTier enum
       | rrr:     mirror if RRR adds Pass products

ROW 17 | term: Recovery stages
       | canonical: OPEN | TOKEN_BRIDGE_OFFERED | TOKEN_BRIDGE_ACCEPTED | THREE_FIFTHS_EXIT_POLICY_GATED | THREE_FIFTHS_EXIT_OFFERED | EXPIRATION_PROCESSED | RESOLVED
       | cyrano:  enforced via RecoveryStageTag in admin-diamond-contracts.ts:9
       | rrr:     adopt the same stage taxonomy on RRR's recovery analog if it surfaces; share the recovery-case-row primitive

ROW 18 | term: Diamond Velocity Bands
       | canonical: DAYS_14 | DAYS_30 | DAYS_90 | DAYS_180 | DAYS_366
       | cyrano:  enforced via DiamondVelocityBand in admin-diamond-contracts.ts:7
       | rrr:     adopt only if surfacing analog (likely no — RRR has no velocity-priced product today)

ROW 19 | term: GuestTier (presenter shorthand) vs MembershipTier (canonical)
       | canonical: GuestTier (GUEST | MEMBER | DIAMOND) is a presenter-layer simplification for guest-facing rate cards only. Permission decisions always use MembershipTier.
       | cyrano:  enforced; documented in §5 of UX_INTEGRATION_BRIEF
       | rrr:     N/A as a separate concept; RRR's tier name set is the single source

ROW 20 | term: Subscription tier (Cyrano standalone) vs MembershipTier (CNZ core)
       | canonical: SPARK | FLAME | INFERNO is the Cyrano standalone Stripe-billed subscription tier. It is NOT the same as MembershipTier. Never conflate in UI or analytics.
       | cyrano:  enforced via SubscriptionTier type in subscription.types.ts
       | rrr:     N/A
```
