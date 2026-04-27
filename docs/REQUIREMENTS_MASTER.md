# REQUIREMENTS MASTER — ChatNow.Zone
**Authority:** Kevin B. Hartley, CEO — OmniQuest Media Inc.
**Source:** Tech Debt Delta 2026-04-16 + CEO corrections 2026-04-16
**Repo:** OmniQuestMediaInc/ChatNowZone--BUILD
**Hard launch deadline:** 1 October 2026
**Last updated:** 2026-04-16

> How to use this file:
> Agents: read this file before selecting your next directive.
> Update the Status column when a directive closes.
> Never mark a requirement DONE without a filed report-back.
> Status values: QUEUED | IN_PROGRESS | DONE | DEFERRED | RETIRED | VERIFY | NEEDS_DIRECTIVE | CLARIFY

---

## STATUS KEY

| Status | Meaning |
|--------|---------|
| QUEUED | Directive authored, in QUEUE, ready to execute |
| IN_PROGRESS | Directive executing — PR open |
| DONE | Code on main, report-back filed, verified |
| VERIFY | Existing code — confirm it satisfies current spec before ship |
| DEFERRED | Not required for Sept 2026 launch. Architecture must not block. |
| RETIRED | Removed from codebase. No code should reference this. |
| NEEDS_DIRECTIVE | Requirement confirmed, directive not yet authored |
| CLARIFY | Blocked — CEO decision required before directive can be authored |

---

## SECTION 1 — TOKEN ARCHITECTURE

**Single currency: ChatZoneTokens (CZT). No other token types exist.**

| ID | Requirement | Tag | Status | Directive | FIZ |
|----|-------------|-----|--------|-----------|-----|
| TOK-001 | Remove ShowZoneTokens (SZT) from schema, wallet service, conversion engine, UI, allotment job. Migrate any SZT balance records to CZT equivalent. | RETIRED | DONE | TOK-RETIRE-001 | YES |
| TOK-002 | Remove Venue Scarcity Token logic (SKU, pricing catalogue, inventory-gating, wallet references) | RETIRED | DONE | TOK-RETIRE-001 | NO |
| TOK-003 | Remove Wristband/Physical Token from bundle ladder, wallet, payout engine, UI | RETIRED | DONE | TOK-RETIRE-001 | NO |
| TOK-004 | Remove Standard-to-ShowToken conversion engine and conversion UI | RETIRED | DONE | TOK-RETIRE-001 | NO |
| TOK-005 | Rework dual-balance wallet UI to single CZT balance display only | RETIRED | QUEUED | TOK-RETIRE-001 | NO |
| TOK-006 | Token origin tagging (PURCHASED / GIFTED) on CZT only. Critical for refund calc and ASC 606 breakage. | CHANGED | DONE | TOK-AUDIT-001 | YES |
| TOK-007 | Premium environment pricing: replace SZT-gating with CZT quantity threshold checks per venue | CHANGED | NEEDS_DIRECTIVE | — | NO |
| TOK-008 | Bundle ladder: rearchitect to CZT-only single-currency ladder. Remove all SZT entries. CZT quantities CEO-confirmed before build. | CHANGED | CLARIFY | — | YES |
| TOK-009 | Diamond floor guarantee: 10,000+ CZT bulk purchase floors creator payout at RATE_WARM ($0.080) regardless of heat. Store diamond_floor_active bool on purchase record. | NET-NEW | NEEDS_DIRECTIVE | — | YES |
| TOK-010 | CZT-only wallet Prisma schema: remove show_token_balance, szt_*, venue_scarcity_*, wristband_token_* columns. Rename standard_token_balance to czt_balance. Origin tag at DB level. | NET-NEW | NEEDS_DIRECTIVE | — | YES |

---

## SECTION 2 — CREATOR PAYOUT ENGINE (FairPay/FairPlay)

**Payout is performance-determined by Flicker n'Flame Scoring (FFS) in real time.**

| ID | Requirement | Tag | Status | Directive | FIZ |
|----|-------------|-----|--------|-----------|-----|
| PAY-001 | RATE_COLD: heat 0-33 = $0.075/CZT. Immutable constant in payout engine. | NET-NEW | QUEUED | PAY-RATES-001 | YES |
| PAY-002 | RATE_WARM: heat 34-60 = $0.080/CZT | NET-NEW | QUEUED | PAY-RATES-001 | YES |
| PAY-003 | RATE_HOT: heat 61-85 = $0.085/CZT | NET-NEW | QUEUED | PAY-RATES-001 | YES |
| PAY-004 | RATE_INFERNO: heat 86-100 = $0.090/CZT | NET-NEW | QUEUED | PAY-RATES-001 | YES |
| PAY-005 | RATE_DIAMOND_FLOOR: $0.080 minimum on 10,000+ CZT bulk. Higher rate applies if heat warrants. | NET-NEW | QUEUED | PAY-RATES-001 | YES |
| PAY-006 | Purchase-moment lock: Flicker n'Flame Scoring multiplier captured at tx_initiated. Rate stored immutably on transaction record. Cannot be recalculated at delivery. | NET-NEW | NEEDS_DIRECTIVE | — | YES |
| PAY-007 | Human-action only guardrail: block clipboard paste on all tip/CZT-spend UI. Keyboard and touch only. | NET-NEW | NEEDS_DIRECTIVE | — | NO |
| PAY-008 | Audio modulation check: rate escalation above RATE_COLD requires active audio signal. Silent room cannot accumulate heat above Cold. Enforce in OBS kernel. | NET-NEW | NEEDS_DIRECTIVE | — | NO |
| PAY-009 | Purchase-response correlation: guest CZT purchase events are dominant weight in Flicker n'Flame Scoring composite. Passive presence does not elevate heat. | NET-NEW | NEEDS_DIRECTIVE | — | YES |
| PAY-010 | 100% tip pass-through: VERIFY platform_deduction = 0 on all tip transactions after CZT migration. Add test coverage. | VERIFY | VERIFY | — | YES |
| PAY-011 | Tip transaction record: add heat_score_at_tip (int) and payout_rate_applied (decimal) fields. | CHANGED | NEEDS_DIRECTIVE | — | YES |
| PAY-012 | Creator rate display: show live rate range ($0.075-$0.090), current Flicker n'Flame Scoring tier, and active rate. Not a static number. | CHANGED | NEEDS_DIRECTIVE | — | NO |
| PAY-013 | Remove founding creator static rate assignment at registration. Superseded by Pixel Legacy + Tease rate. | SUPERSEDED | DONE | TOK-RETIRE-001 | YES |

---

## SECTION 3 — MIC DROP / PIXEL LEGACY / DAY 91 PARITY

| ID | Requirement | Tag | Status | Directive | FIZ |
|----|-------------|-----|--------|-----------|-----|
| MIC-001 | rate_state enum in payout config: TEASE or MIC_DROP. Includes scheduled_activation_at timestamp. Creator dashboard updates immediately on MIC_DROP activation. | NET-NEW | NEEDS_DIRECTIVE | — | YES |
| MIC-002 | Rate state audit log: every transition logged with activation_timestamp, authorized_by (CEO user_id), affected_creator_count. Immutable append-only. | NET-NEW | NEEDS_DIRECTIVE | — | YES |
| MIC-003 | pixel_legacy bool on creator record. First 3,000 registrants. Gates Mic Drop rate from Day 1. | CHANGED | NEEDS_DIRECTIVE | — | YES |
| MIC-004 | Atomic counter enforcement at exactly 3,000 (SELECT FOR UPDATE). Race condition handled. No registrant #3,001 receives flag. | NET-NEW | NEEDS_DIRECTIVE | — | YES |
| MIC-005 | Pixel Legacy Signing Bonus: Month 3 activity threshold triggers bonus in Month 4 Cycle 2 payout. reason_code: PIXEL_LEGACY_SIGNING_BONUS. Separate ledger line. | NET-NEW | NEEDS_DIRECTIVE | — | YES |
| MIC-006 | Month 3 activity threshold: configurable in config table (not hardcoded). CEO provides value before Month 3 opens. | CLARIFY | CLARIFY | — | YES |
| MIC-007 | creator_registration_day field: integer on creator record, days since platform launch (day 0). | NET-NEW | NEEDS_DIRECTIVE | — | YES |
| MIC-008 | Day 91 trigger job: all creators registered Days 1-90 auto-upgraded to full 7.5-9c range. Idempotent. | NET-NEW | NEEDS_DIRECTIVE | — | YES |
| MIC-009 | Day 91 parity audit log: run_timestamp, creator_count_evaluated, creator_count_upgraded, job_id. Immutable. | NET-NEW | NEEDS_DIRECTIVE | — | YES |

---

## SECTION 4 — GUEST WELCOME CREDIT

**Build complete but hold inactive (welcome_credit_active: false)
pending Ontario consumer protection legal review. CEO + legal sign-off
required before activation.**

| ID | Requirement | Tag | Status | Directive | FIZ |
|----|-------------|-----|--------|-----------|-----|
| GWC-001 | Trigger: Guest reaches $250.00 cumulative gross spend in first calendar month. | NET-NEW | NEEDS_DIRECTIVE | — | YES |
| GWC-002 | Credit: $100.00 CZT to Guest wallet. Type: WELCOME_CREDIT. reason_code: WELCOME_CREDIT. Separate ledger line. | NET-NEW | NEEDS_DIRECTIVE | — | YES |
| GWC-003 | eligible_for_welcome_credit bool on Guest record. Set false after issuance. One-time only. | NET-NEW | NEEDS_DIRECTIVE | — | YES |
| GWC-004 | First-month gate: if $250 not reached in Month 1, eligibility closes permanently. month_1_window_closed bool. | NET-NEW | NEEDS_DIRECTIVE | — | NO |
| GWC-005 | welcome_credit_active bool in platform config. Default: false. Toggle requires CEO + legal. Build inactive. | NET-NEW | NEEDS_DIRECTIVE | — | NO |

---

## SECTION 5 — CYRANO ARCHITECTURE

**CNZ subsystem at launch. Commit prefix: CYR:
Lives at services/cyrano/**

| ID | Requirement | Tag | Status | Directive | FIZ |
|----|-------------|-----|--------|-----------|-----|
| CYR-001 | Retire standalone Cyrano platform, subscription billing, separate accounts, parallel build workstream. | RETIRED | NEEDS_DIRECTIVE | — | NO |
| CYR-002 | L1 CNZ Creator Feature: LLM integration (Anthropic Claude API) consuming Flicker n'Flame Scoring, tipping velocity, chat sentiment via NATS. Suggestion panel in CreatorControl.Zone UI. Latency under 2s. | NET-NEW | NEEDS_DIRECTIVE | — | NO |
| CYR-003 | L2 Consumer Audio Platform: standalone audio session type within CNZ. Voice-native. Persona management. Gold/Diamond gating. Year 3+ standalone fork path preserved. | NET-NEW | NEEDS_DIRECTIVE | — | NO |
| CYR-004 | L3 HCZ Whisper Intelligence: RedBook scenario classifier feeds Cyrano prompt engine. Agent-facing overlay. No Guest surface. | NET-NEW | NEEDS_DIRECTIVE | — | NO |
| CYR-005 | L4 Enterprise B2B Whisper API: clean external API, key-gated, rate-limited. Year 3+. Architecture must support from launch. | DEFERRED | DEFERRED | — | NO |
| CYR-006 | LLM integration layer: Anthropic Claude API. Abstracted behind provider interface for future swapping. | NET-NEW | NEEDS_DIRECTIVE | — | NO |
| CYR-007 | Session memory store: persistent narrative memory keyed on (creator_id, guest_id). Versioned. | NET-NEW | NEEDS_DIRECTIVE | — | NO |
| CYR-008 | Persona management system: creator-defined personas, versioned, multiple active, switch without losing context. | NET-NEW | NEEDS_DIRECTIVE | — | NO |
| CYR-009 | Prompt template engine: maps (heat_tier, chat_sentiment, tipping_velocity_band) to narrative categories. Config-driven. | NET-NEW | NEEDS_DIRECTIVE | — | NO |

---

## SECTION 6 — DIAMOND CONCIERGE (Security and Fraud)

**FYI: Diamond Concierge is classified as Security and Fraud —
NOT Guest Services. This distinction must be reflected in all
routing, reporting, and documentation.**

| ID | Requirement | Tag | Status | Directive | FIZ |
|----|-------------|-----|--------|-----------|-----|
| DIA-001 | Reclassify Diamond Concierge as Security and Fraud function in all routing, reporting, documentation. | CHANGED | NEEDS_DIRECTIVE | — | NO |
| DIA-002 | Operating window: 11AM-11PM per Guest billing-address TZ. Last new booking: 10:30PM. Server-side enforcement. | CHANGED | NEEDS_DIRECTIVE | — | NO |
| DIA-003 | Transaction record schema: add mandatory risk assessment fields — intoxication_flag, belligerence_flag, coercion_flag, duress_flag, account_signal_snapshot (JSONB), go_no_go_decision (enum: APPROVE/MODIFY/DEFER/DECLINE), modified_amount (decimal nullable), agent_id (FK), assessment_timestamp. | NET-NEW | NEEDS_DIRECTIVE | — | NO |
| DIA-004 | Account signal auto-population at call initiation: dispute_history_count, session_spend_velocity, account_tenure_days, spend_tenure_ratio, geographic_anomaly_flag, prior_flagged_count. | NET-NEW | NEEDS_DIRECTIVE | — | NO |
| DIA-005 | Diamond qualification: zero chargebacks/disputes/refunds/flags + willingness to purchase min 10,000 CZT + lifetime spend $8,000-$10,000 cumulative + agent review. | NET-NEW | NEEDS_DIRECTIVE | — | NO |

---

## SECTION 7 — FULLY RETIRED SYSTEMS

**These systems must be found and removed from the codebase.
FYI: Wristband as a physical access identifier is RETAINED.
Only the wristband token economy/billing tier layer is retired.**

| ID | Requirement | Tag | Status | Directive | FIZ |
|----|-------------|-----|--------|-----------|-----|
| RET-001 | ShowZonePass purchase system (7 pass types, $1.99-$34.99): remove all pass SKUs, activation/expiry logic, zone access via pass, concurrent pass handling, 48hr upgrade offer, pass display in dashboard. | RETIRED | NEEDS_DIRECTIVE | — | NO |
| RET-002 | Wristband token economy: remove Solo/Linked/Family/Diamond wristband billing tiers, linked account access revocation chain, bonus token events via wristband. Wristband as physical access identifier is RETAINED. | RETIRED | NEEDS_DIRECTIVE | — | NO |

---

## SECTION 8 — SHOWTHEATRE AND BIJOU VENUE MECHANICS

**FYI CEO correction 2026-04-16: ShowTheatre is NOT deferred.
It is a launch requirement. Both ShowTheatre and theBijou are
standalone Cineplex-type digital venues. Payment is CZT only —
no SZT gating. Admissions and wristbands as access identifiers
still exist.**

| ID | Requirement | Tag | Status | Directive | FIZ |
|----|-------------|-----|--------|-----------|-----|
| SHW-001 | Hard seat capacity enforcement: Studio 50 / Lounge 150 / Theatre 400 / Grand 800. CZT payment. | NET-NEW | NEEDS_DIRECTIVE | — | NO |
| SHW-002 | Bijou Scheduler Service: velocity rules, schedule validation. LiveKit OSS self-hosted SFU. | NET-NEW | NEEDS_DIRECTIVE | — | NO |
| SHW-003 | Bijou Admission Service: standby queue with 10s accept window. | NET-NEW | NEEDS_DIRECTIVE | — | NO |
| SHW-004 | Bijou schema: bijou_shows, bijou_admissions, bijou_standby_queue tables (append-only). | NET-NEW | NEEDS_DIRECTIVE | — | YES |
| SHW-005 | Dwell log: 5-second heartbeat, creator_id, dwell_secs, session context. | NET-NEW | NEEDS_DIRECTIVE | — | NO |
| SHW-006 | Dynamic pricing engine: fill-rate triggers, yield management. CZT quantities. | NET-NEW | NEEDS_DIRECTIVE | — | NO |
| SHW-007 | Operating schedule windows (Matinee/Prime/Late, dark window enforcement, venue x window matrix). CZT gating replaces SZT gating. | CHANGED | NEEDS_DIRECTIVE | — | NO |
| SHW-008 | Session recording and embargo system: auto-record, Day 1-10 embargo, Day 11 Bolt unlock. CZT pricing. | CHANGED | NEEDS_DIRECTIVE | — | NO |
| SHW-009 | Content Bolt catalogue: VOD, embargo to Bolt state machine, rack rate. CZT only. | CHANGED | NEEDS_DIRECTIVE | — | NO |

---

## SECTION 9 — REFUND ARCHITECTURE

| ID | Requirement | Tag | Status | Directive | FIZ |
|----|-------------|-----|--------|-----------|-----|
| REF-001 | Zero-refund acknowledgment flow (3-point timestamped): VERIFY timestamps stored and retrievable for chargebacks. | VERIFY | VERIFY | — | NO |
| REF-002 | Refund-eligible balance = PURCHASED CZT only: VERIFY origin tag survives CZT migration. | VERIFY | VERIFY | — | YES |
| REF-003 | Valuation at 1,000 CZT bundle rate. Remove any SZT-denominated reference. | CHANGED | NEEDS_DIRECTIVE | — | YES |
| REF-004 | First Pass (2/3) / Second Pass (3/5) offer ratios: VERIFY unchanged after payout engine rebuild. | VERIFY | VERIFY | — | YES |
| REF-005 | Gifted CZT forfeiture on refund: VERIFY applies to CZT gifted balance only after migration. | VERIFY | VERIFY | — | YES |
| REF-006 | VAMP chargeback compliance: GGS Welfare Guardian Score is specifically designed to drive dispute rate below 0.75%. Confirm chargeback defence data retention job active. | CHANGED | NEEDS_DIRECTIVE | — | NO |

---

## SECTION 10 — GATEGUARD SENTINEL CORE

**Entirely new bounded service.
Path: services/gateguard-sentinel/
Commit prefix: GGS: (dual FIZ: + GGS: when touching ledger/payout)
Zero prior code exists.**

| ID | Requirement | Tag | Status | Directive | FIZ |
|----|-------------|-----|--------|-----------|-----|
| GGS-001 | Standalone service: services/gateguard-sentinel/. No direct coupling to CNZ app logic. CNZ calls GGS via internal API before forwarding to processor. | NET-NEW | NEEDS_DIRECTIVE | — | YES |
| GGS-002 | Latency: full dual-score response under 200ms P50, under 400ms P99. Over 400ms defaults to pass-through with deferred async welfare review flag. | NET-NEW | NEEDS_DIRECTIVE | — | NO |
| GGS-003 | Immutable audit log: every GGS decision written before decision returned to caller. Append-only. | NET-NEW | NEEDS_DIRECTIVE | — | YES |
| GGS-004 | No-bypass / no-master-override: maintenance mode requires CEO + Technical Lead dual auth. Generates audit event. | NET-NEW | NEEDS_DIRECTIVE | — | NO |
| GGS-005 | Welfare Guardian Score (WGS): dual fraud+welfare scoring. Rule sub-score R (weighted sum) + ML sub-score S (XGBoost). Ensemble: W = 0.4xR + 0.6xS. | NET-NEW | NEEDS_DIRECTIVE | — | YES |
| GGS-006 | WGS input signals: spend velocity, session duration/intensity, chat distress score, chasing behavior, relative spend ratio, device consistency, time-of-day, cross-Park spend, standard fraud signals. | NET-NEW | NEEDS_DIRECTIVE | — | NO |
| GGS-007 | WGS intervention tiers: Low (0-39) pass, Medium (40-64) soft nudge + optional 3DS, High (65-84) mandatory 5min cool-down, Critical (85-100) hard decline + auto HCZ escalation. | NET-NEW | NEEDS_DIRECTIVE | — | NO |
| GGS-008 | API output fields: welfare_score, fraud_score, confidence, reason_codes (max 5 RC-## format), recommended_intervention enum, zk_proof_hash. | NET-NEW | NEEDS_DIRECTIVE | — | YES |
| GGS-009 | Federated Welfare Intelligence Network: differential privacy (Laplace mechanism), FedAvg, OQMInc governance node, single-node launch mode. | NET-NEW | NEEDS_DIRECTIVE | — | NO |
| GGS-010 | Predictive Intervention Engine: soft nudge delivery, cool-down protocol, outcome learning feedback loop, webhook output (no PII in payload). | NET-NEW | NEEDS_DIRECTIVE | — | NO |
| GGS-011 | Zero-Knowledge Compliance Oracle: zk-SNARKs (Groth16/PLONK via snarkjs). Proof attests: age verified, consent satisfied, welfare check passed, RedBook followed. zk_proof_hash on every response. | NET-NEW | NEEDS_DIRECTIVE | — | YES |
| GGS-012 | ZK proof archival: 7 years minimum. Separate from operational DB. Immutable. | NET-NEW | NEEDS_DIRECTIVE | — | YES |
| GGS-013 | Session-Heat Welfare Flywheel: Flicker n'Flame Scoring to GGS feed via NATS. Heat spike + velocity hard rule (20+ point rise in 5min AND anomalous velocity = floor welfare score to 40). Max staleness 5s. | NET-NEW | NEEDS_DIRECTIVE | — | NO |
| GGS-014 | Human-AI Hybrid Escalation (RedBook-as-a-Service): auto-routing at welfare_score 85+, HCZ ticket pre-populated with dual scores + RedBook playbook ID. Agent decision feedback loop. Standalone licensable. | NET-NEW | NEEDS_DIRECTIVE | — | NO |

---

## SECTION 11 — GATEGUARD SENTINEL AV MODULE

**Commit prefix: GGS-AV:
Path: services/gateguard-sentinel/av/
Supersedes per-call Yoti/Veriff/Onfido model.**

| ID | Requirement | Tag | Status | Directive | FIZ |
|----|-------------|-----|--------|-----------|-----|
| GGS-AV-001 | Supersede per-call Yoti/Veriff/Onfido model. Yoti retained for L1 onboarding document verification only (abstracted behind interface). | SUPERSEDED | NEEDS_DIRECTIVE | — | NO |
| GGS-AV-002 | L1 Onboarding Verification: document upload + liveness check at account creation. Result stored as cryptographic verification token keyed on session_id (not user_id). Merchant never holds identity doc or biometric. | NET-NEW | NEEDS_DIRECTIVE | — | YES |
| GGS-AV-003 | L2 Continuous Contextual Re-Verification: cross-reference behavioral signals on every transaction. Triggers: new_device_flag, new_geography_flag (over 500km), anomalous_spend_pattern, session_inconsistency_score above threshold. No doc re-upload. No per-call cost. | NET-NEW | NEEDS_DIRECTIVE | — | NO |
| GGS-AV-004 | L3 Zero-Knowledge Age Attestation: API response contains only age_verified bool + av_zk_proof_hash. No age/DOB/identity data. Satisfies Quebec Law 25, GDPR Art 5(1)(c), Bill S-209. | NET-NEW | NEEDS_DIRECTIVE | — | YES |
| GGS-AV-005 | AV provider abstraction interface: Yoti at launch, swappable without touching AV business logic. | NET-NEW | NEEDS_DIRECTIVE | — | NO |
| GGS-AV-006 | Bill S-210 Reliable standard compliance. Bill S-209 positioning. UK Online Safety Act alignment. Compliance architecture document (counterparty name removed per §12 — see banned-entity invariant). | NET-NEW | NEEDS_DIRECTIVE | — | NO |
| GGS-AV-007 | av_zk_proof_hash archival: 7 years. Same infrastructure as core GGS ZK proofs. | NET-NEW | NEEDS_DIRECTIVE | — | YES |

---

## SECTION 12 — CROSS-CUTTING / COMPLIANCE / DOCTRINE

| ID | Requirement | Tag | Status | Directive | FIZ |
|----|-------------|-----|--------|-----------|-----|
| DOC-001 | Add GGS:, GGS-AV:, CYR: commit prefixes to OQMI_SYSTEM_STATE.md and copilot-instructions.md | NET-NEW | IN_PROGRESS | CHORE-PIPELINE-002 | NO |
| DOC-002 | FIZ path expansions: services/gateguard-sentinel/, services/gateguard-sentinel/av/, services/cyrano/ (payout-touching paths), schema migrations touching pixel_legacy/payout_rate/rate_state/welcome_credit_active/go_no_go_decision | NET-NEW | IN_PROGRESS | CHORE-PIPELINE-002 | NO |
| DOC-003 | Create docs/DOMAIN_GLOSSARY.md with all terms from Tech Debt Delta Section 12.4 | NET-NEW | IN_PROGRESS | CHORE-PIPELINE-005 | NO |
| DOC-004 | Warrant Response (Bill C-22): GGS audit log and ZK proof archive accessible to ProductionOrder workflow. | CHANGED | NEEDS_DIRECTIVE | — | NO |
| DOC-005 | Age Gating (Bill S-210): GGS AV is now the underlying infrastructure called by Sovereign CaC. | CHANGED | NEEDS_DIRECTIVE | — | NO |
| DOC-006 | AI Disclosure (Bill 149 ON): Cyrano L1 is an AI tool in creator/fan interactions. Disclosure applies to Cyrano session interface. | CHANGED | NEEDS_DIRECTIVE | — | NO |
| DOC-007 | Dwell settlement: VERIFY payout engine rebuild does not extend 120s settlement window. | VERIFY | VERIFY | — | NO |
| DOC-008 | 3DS2: VERIFY still mandatory on all top-ups after CZT migration. | VERIFY | VERIFY | — | NO |

---

## PIPELINE DIRECTIVES (META)

| ID | Requirement | Tag | Status | Directive | FIZ |
|----|-------------|-----|--------|-----------|-----|
| PIPE-001 | Add Agent/Parallel-safe/Touches routing fields to directive template and QUEUE files | NET-NEW | QUEUED | CHORE-PIPELINE-001 | NO |
| PIPE-002 | Update copilot-instructions.md with Autonomous Directive Protocol + new commit prefixes | NET-NEW | QUEUED | CHORE-PIPELINE-002 | NO |
| PIPE-003 | Build directive-dispatch.yml workflow + patch directive-intake.yml with PR instruction | NET-NEW | QUEUED | CHORE-PIPELINE-003 | NO |
| PIPE-004 | Create docs/REQUIREMENTS_MASTER.md (this file) | NET-NEW | QUEUED | CHORE-PIPELINE-004 | NO |
| PIPE-005 | Create docs/DOMAIN_GLOSSARY.md | NET-NEW | QUEUED | CHORE-PIPELINE-005 | NO |

---

## PREVIOUSLY COMPLETED (v5/v6 DFSP Series)

| Directive | Description | Status |
|-----------|-------------|--------|
| HOTFIX-AUTH-001 | StepUpService | DONE |
| KYC-001 | PublishGateService | DONE |
| MOD-001 | IncidentService | DONE |
| AUDIT-001 | AuditChainService | DONE |
| AUDIT-002 | LegalHoldService | DONE |
| INFRA-004 | ReconciliationService | DONE |
| PV-001 | DFSP Foundation Modules 1+2 | DONE |
| NATS-DFSP001-TOPICS | DFSP NATS pre-work | DONE |
| GOV-CONST-001 | April 12 governance constants | DONE |
| GZ-SCHEDULE-001 | GuestZone scheduling module | DONE |
| M5-VOICE-SAMPLE-COLLECTION | VoiceSampleService | DONE |
| DFSP-001 | Modules 3+4 OTP + Account Hold | DONE |
| CHORE-INFRA-BCRYPT-001 | bcrypt dependency | DONE |

---

Maintained by: Claude Chat (architecture) + Copilot/Claude Code (execution)
Update this file as part of every directive report-back commit.
CEO authority: Kevin B. Hartley — OmniQuest Media Inc.
