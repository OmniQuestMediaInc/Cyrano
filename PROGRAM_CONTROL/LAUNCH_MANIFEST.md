# ChatNow.Zone — LAUNCH MANIFEST

> **Authority:** Kevin B. Hartley (CEO, OmniQuest Media Inc.)
> **Issued:** 2026-04-24 (Payload 9 — Build Complete)
> **Hard launch target:** 2026-10-01
> **Reference:** Business Plan §G.6 (AWS launch), REDBOOK §3 (rate cards), §5 (Recovery)

This manifest captures the four launch sequences that must execute in order
between Build Complete (today) and Hard Launch (2026-10-01). Each sequence
is owned by a single named operator who reports back into
`PROGRAM_CONTROL/REPORT_BACK/` on completion.

---

## 1. Pixel Legacy Creator Onboarding Flow

**Owner:** Creator Operations (GuestZone primary)
**Trigger window:** T-90 days → T-30 days from hard launch

### Goals
1. Onboard the founding cohort of "Pixel Legacy" creators with first-mover
   benefits visible in the OnePager.
2. Validate the end-to-end Diamond + Concierge experience with real
   creators before public traffic.

### Deliverables
- [ ] Curated invitation list (target 250 Pixel Legacy creators) signed by Creator Ops + CEO
- [ ] Onboarding kit shipped digitally:
  - REDBOOK rate-card explainer (REDBOOK §3 + Diamond Tier table)
  - CreatorControl.Zone walkthrough video (Payload 5)
  - Cyrano Layer 1 whisper-cue cheat sheet (8 categories)
  - Three-bucket wallet primer (LEDGER_SPEND_ORDER)
  - Welfare Guardian Score creator-facing FAQ (GateGuard / Payload 3)
- [ ] First Diamond Concierge appointment booked end-to-end with a Pixel Legacy creator (test case)
- [ ] Recovery flow rehearsed: extension, recovery fee, Token Bridge, 3/5ths Exit

### Gates
- CreatorControl.Zone live in staging
- Diamond Concierge appointment scheduler healthy (`DFSP_CONCIERGE_APPOINTMENT_BOOKED`)
- Hub `forwardGuardedLedgerRequest` exercised for at least 50 transactions in staging

## 2. Mic Drop Reveal Sequence

**Owner:** Marketing + CEO
**Trigger window:** T-30 days → T-0

### Goals
- Coordinated public reveal: brand drop, founding-creator showcase, press kit, dashboards live.

### Deliverables
- [ ] Reveal-day timeline rehearsed (T-72h, T-48h, T-24h, T-2h, T-0)
- [ ] Press kit (REDBOOK rate cards + Diamond Tier table + Welfare Guardian Score positioning)
- [ ] Founding-creator OnePagers (250 cohort) staged for distribution at T-0
- [ ] Black-Glass Interface demo loop ready (placeholder until G101+ ships)
- [ ] Bill 149 (Ontario) AI disclosure on every AI-assisted creator surface (`OBS.BILL_149_DISCLOSURE_PREFIX`)

### Gates
- CEO sign-off on Mic Drop dry-run filed in `PROGRAM_CONTROL/CLEARANCES/`
- Observability dashboards green (Cyrano p95, GateGuard latency, Flicker n'Flame Scoring tier transitions, Ledger throughput)

## 3. First 3,000 Creator Rate-Lock

**Owner:** Finance + Creator Operations
**Trigger window:** Open at T-0; closes when 3,000 unique creator IDs activated

### Goals
- Lock the first 3,000 creators into the founding rate card with a contractual commitment recorded in the ledger.

### Deliverables
- [ ] Rate-lock ledger entry written for each cohort member (`reason_code = 'FOUNDING_RATE_LOCK'`)
- [ ] Eligibility rules:
  - Diamond payout floor `$0.075/token` for the founding cohort
  - Velocity multipliers honoured per `DIAMOND_TIER.VELOCITY_MULTIPLIERS`
  - Volume tier brackets per `DIAMOND_TIER.VOLUME_TIERS` (10k–27.5k / 30k–57.5k / 60k+)
- [ ] Hub `forwardGuardedLedgerRequest` instrumented to tag founding-cohort transactions
- [ ] Cohort dashboard live (read-only) for CEO + Finance

### Gates
- `services/ledger/redbook-rate-card.service.ts` returns founding-cohort rates correctly for at least 100 staging creators
- Audit trail: `AUDIT_IMMUTABLE_DIAMOND` emitted for every rate-lock

## 4. GateGuard Processor LOI Data Package (stub)

**Owner:** Compliance + GateGuard squad
**Trigger window:** T-60 days → T-14 days

### Goals
- Assemble the data package for the AV-check / payment processor LOI conversations. This is a stub — the full package is delivered by Compliance to the named processors and is not part of the public release.

### Deliverables
- [ ] GateGuard architecture summary (sourced from `docs/ARCHITECTURE_OVERVIEW.md` §3 + §4)
- [ ] Welfare Guardian Score methodology (sanitised — no scoring weights in the public PDF)
- [ ] Audit hash-chain attestation (Payload 6) — sample WORM export + integrity-verification log
- [ ] Append-only ledger evidence (`infra/postgres/init-ledger.sql` excerpts)
- [ ] FT-033 network isolation diagram (from `docs/ARCHITECTURE_OVERVIEW.md` §1)
- [ ] CEO cover letter

### Gates
- Compliance counsel sign-off on the data package contents
- CEO sign-off on the cover letter

---

## 5. Cross-Cutting Reporting

Every owner files a report-back into `PROGRAM_CONTROL/REPORT_BACK/` using
`docs/DIRECTIVE_TEMPLATE.md`. Report-back filenames follow
`LAUNCH_<sequence-id>_<owner>_<yyyy-mm-dd>.md`.

## 6. CEO Final Gate

The hard-launch authorisation is filed in
`PROGRAM_CONTROL/CLEARANCES/LAUNCH_GATE_2026-10-01.md` and is the
single document that converts this manifest from "in flight" to
"executed". No agent — Claude Code, Copilot, or human — may flip the
production feature flags without that clearance.
