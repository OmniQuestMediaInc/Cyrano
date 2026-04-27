# FLAGS.md — ZoneBot Zoey
**WO-002 — Open Business Decisions Requiring CEO Review**
**Date:** 2026-04-25

---

## FLAG-001: Sick Day Carryover Policy
**Status:** OPEN — awaiting CEO decision
**Question:** Does unused sick time carry forward to the next calendar year?
If yes, how many hours maximum may carry over, and does it expire mid-year?

**Default installed:** `sick_carryover_hours = 0` (no carryover until confirmed).
**Schema ready:** `sick_carryover_hours` and `sick_carryover_expires` columns exist.

---

## FLAG-002: Spin-Wheel Incentive Triggers
**Status:** OPEN — partial spec
**Question:** Exactly when is the $50 spin-wheel incentive triggered?
Options discussed: (a) every coverage gap filled voluntarily,
(b) on-call pickup of a STAT holiday, (c) random draw on shift completion.

**Default installed:** `HCZ_INCENTIVE_v1` ledger records all awards; trigger logic
is left to a follow-up directive.

---

## FLAG-003: Budget Forecast Approval Workflow
**Status:** OPEN
**Question:** Who approves weekly budget forecasts (Finance Manager, GM, or CEO)?
Does approval flow through GateGuard Sentinel?

**Default installed:** `status = DRAFT` — no approval workflow wired yet.

---

## FLAG-004: Hiring Model Confidence Threshold
**Status:** OPEN
**Question:** At what confidence score (0.0–1.0) should a hiring recommendation
auto-escalate vs. remain advisory only?

**Default installed:** All recommendations are advisory-only.

---

## FLAG-005: Moderation Cooldown — HCZ vs. GuestZone Alignment
**Status:** OPEN
**Question:** The moderation cooldown (4h/24h) is implemented here for HCZ staff.
Should it be unified with the GuestZone GZ_SCHEDULING constants, or remain
a separate HCZ-specific constant?

**Default installed:** Separate `HCZ.MOD_COOLDOWN_HOURS = 4` constant.

---

## FLAG-006: Stagger Offset per Department
**Status:** OPEN
**Question:** Should the 15-minute stagger offset apply uniformly across all
departments, or be configurable per department?

**Default installed:** 15-minute uniform offset.

---

*All flags must be resolved before the HCZ scheduling system moves to ACTIVE status.*
