# OQMInc Thread Bootstrap
**Always-current master orientation document**
Authority: Kevin B. Hartley, CEO — OmniQuest Media Inc.
Last updated: Thread 14 — 2026-04-18
Repo: OmniQuestMediaInc/ChatNowZone--BUILD

---

## HOW TO USE THIS DOCUMENT

Read this at the START of every new Claude Chat thread.
Read the handoff document AFTER this. Then proceed.

This document replaces the "paste six GitHub API URLs" ritual.
The handoff carries only: current PR state, QUEUE state, next action.
Everything else lives here and in the sibling REFERENCE_LIBRARY files.

---

## 1. CORE IDENTIFIERS

| Field | Value |
|-------|-------|
| Company | OmniQuest Media Inc. (OQMInc™) |
| CEO / CD / LD | Kevin B. Hartley |
| Platform | ChatNow.Zone (chatnow.zone) — CANONICAL NAME |
| Secondary platform | Cyrano — 60–120 days post-CNZ stabilization |
| Repo | OmniQuestMediaInc/ChatNowZone--BUILD |
| Hard deadline | 1 October 2026 |
| Exec team | Blaine Lenher, Darrell Peckford |
| **BANNED ENTITY** | **[REDACTED — governance §12] — NEVER reference this individual or firm in any OmniQuest Media Inc. material** |

---

## 2. REFERENCE LIBRARY INDEX

All structural files in `REFERENCE_LIBRARY/` on main.
Read via: `git show main:REFERENCE_LIBRARY/{filename}`
Or via GitHub contents API:
`https://api.github.com/repos/OmniQuestMediaInc/ChatNowZone--BUILD/contents/REFERENCE_LIBRARY/{filename}`

| File | Contents |
|------|----------|
| 00_THREAD_BOOTSTRAP.md | This document — always read first |
| 01_CANONICAL_LOCKS.md | All CEO-locked invariants, tier rules, expiry |
| 02_DOMAIN_TAXONOMY.md | All directive series, status, agent routing |
| 03_FEATURE_BRIEFS.md | FC, OPS, DISC, CCZ surface specifications |
| 04_AI_REFERENCE_INDEX.md | AI resources mapped to directives |
| 05_OSS_REPO_REGISTRY.md | All 9 reference repos + branch access |
| 06_PROJECT_DECISIONS.md | Architecture decisions log |
| TEMPLATES/ | Reusable directive and workflow templates |

## 2B. BUILDD CONTROL — GOOGLE DRIVE

Primary Drive folder for all CNZ control documents:
**BUILDD CONTROL - CNZ**
Folder ID: `1zB0MZjj92wovoBuhi0TkelZ_t0oNSCHO`
URL: https://drive.google.com/drive/folders/1zB0MZjj92wovoBuhi0TkelZ_t0oNSCHO

What lives in Drive (not repo):
- Thread handoff documents (Google Docs — required for Claude Code delivery)
- QUEUE, IN_PROGRESS, DONE, BACKLOGS directive folders
- INTEL reports and OQMInc business documents
- OQMInc Templates folder (master templates)

What lives in REFERENCE_LIBRARY/ (not Drive):
- Canonical locks, taxonomy, feature briefs, AI index
- OSS repo registry, decisions log, thread bootstrap

Subfolder IDs (to be confirmed and populated at Thread 15 open):
| Subfolder | ID |
|-----------|-----|
| QUEUE | [CONFIRM AT THREAD 15] |
| IN_PROGRESS | [CONFIRM AT THREAD 15] |
| DONE | [CONFIRM AT THREAD 15] |
| BACKLOGS | [CONFIRM AT THREAD 15] |
| HANDOFFS | [CONFIRM AT THREAD 15] |
| REPORT_BACK | [CONFIRM AT THREAD 15] |
| OQMInc Templates | [CONFIRM AT THREAD 15] |

CRITICAL — Directive delivery to Claude Code:
Directives sent via Drive MUST be Google Docs (Zapier convert=true).
Plain text files return 403. Hard constraint — never plain text.

---

## 3. REFERENCE BRANCHES (never merge to main)

Read any file: `git show {branch}:{filepath}`

| Branch | Key CNZ Use |
|--------|-------------|
| refs/oss/booking-api | CCZ-004, DISC-001/004, OPS-006 |
| refs/oss/socketio-chat | OBS-001/002, CCZ-001, OPS-003 |
| refs/oss/react-chat-app | CCZ-001/002, OBS-001 |
| refs/oss/discussion-platform | FC-001–006, OPS-004 |
| refs/oss/live-polling | OBS Flicker n'Flame Scoring (FFS) broadcast |
| refs/oss/zoom-clone | OBS ShowZone Theatre UI, DISC |
| refs/oss/loadbalancer-nginx | Bijou SFU infra, OPS deployment |
| refs/oss/social-media-app | FC-003, CCZ-003, OPS-006 notifications |
| refs/oqminc/ai-resources | OBS-005, HZ, NN-001/002, DFSP |

CI blocks any PR from refs/* to main.
See: .github/workflows/protect-ref-branches.yml

---

## 4. QUICK CANONICAL LOCKS

Full detail in 01_CANONICAL_LOCKS.md. Summary:

**MembershipTier enum — 6 values, LOCKED:**
GUEST, VIP, VIP_SILVER, VIP_GOLD, VIP_PLATINUM, VIP_DIAMOND

**Retired (NEVER use as enum values):**
DAY_PASS, ANNUAL (as tier), OMNIPASS_PLUS (as tier), standalone DIAMOND

**Products (NOT tiers):** OmniPass, OmniPass+, ShowZonePass, SilverBullet

**Platform name:** ChatNow.Zone / chatnow.zone
**Currency:** ChatZoneTokens (CZT)
**Payout engine:** Flicker n'Flame Scoring (FFS) (RATE_COLD → RATE_INFERNO)
**Video infra:** LiveKit OSS self-hosted (Bijou SFU)

---

## 5. GOV GATE STATUS

| Gate | Status | Affects |
|------|--------|---------|
| GOV-FINTRAC | ✅ CEO-AUTHORIZED-STAGED 2026-04-11 | DFSP-002–008 |
| GOV-AGCO | ✅ CEO-AUTHORIZED-STAGED 2026-04-11 | Same |
| GOV-AV | ⏳ BRANCH-AND-HOLD | AV-001 only |

---

## 6. CURRENT PIPELINE STATE
*(Update this section at every thread close)*

**Last thread:** 14 (2026-04-18)
**Policy doc:** docs/MEMBERSHIP_LIFECYCLE_POLICY.md v1.0 — authoritative

### ⚠️ OPEN INTEGRITY FLAG
PRs #254 and #255 merged [WIP] Remove MembershipTier enum to main.
Schema state UNVERIFIED. Fire THREAD14-SCHEMA-INTEGRITY-AUDIT to
Claude Code before any directive work. Prompt is authored and ready.

### Open PRs
- #265 — MEMB-001 schema foundation — OPEN, not yet merged
- RRR-P1-006 — Platform name canonicalization — OPEN, not yet merged

### QUEUE State (2026-04-18)
- THREAD11-COPILOT-INTAKE.md — status uncertain
- THREAD11-DIRECTIVE-SERIES-001.md — status uncertain

### Authored, Not Yet Issued
- CI wiring CHORE — paste to Copilot (§7.1 Thread 13 handoff)
- MEMB-002 scope — blocked on #265 merge (§7.2 Thread 13 handoff)

### RRR Program
- docs/RRR_CEO_DECISIONS_FINAL_2026-04-17.md exists on main
- D-numbered decisions NOT YET cross-checked vs canonical locks
- Action: read RRR doc in full, surface any contradictions

---

## 7. NEXT IMMEDIATE ACTIONS (in priority order)

1. Fire THREAD14-SCHEMA-INTEGRITY-AUDIT to Claude Code (droid mode)
2. Await audit report-back — no directive work until complete
3. Merge PR #265 (MEMB-001) and RRR-P1-006 after audit confirms clean
4. Fire CI wiring CHORE to Copilot (§7.1 Thread 13 handoff)
5. Author and issue MEMB-002 to Claude Code
6. Fire refs/* harvest directive to Claude Code

---

## 8. OPEN POLICY TBDs

| Section | Topic | Status |
|---------|-------|--------|
| §9.1 | OmniPass/OmniPass+ token multiplier values | OPEN |
| §9.2 | OmniPass/OmniPass+ pricing, expiry, renewal | OPEN |
| §9.3 | Other pass-domain products | OPEN |
| §9.4 | Paid-tier drip schedule specifics | DEFERRED to MEMB-005 |
| §9.5 | SilverBullet pricing + nudge cadence | OPEN |
| §9.6 | Token-expiry rescue sequence | OPEN |
| §9.7 | Quarterly Silver Surge mechanics | OPEN |
| §9.8 | Diamond Concierge binding | ESTABLISHED |

Diamond Concierge: 11:00 AM–11:00 PM guest billing-address TZ,
last call 10:30 PM, binds to VIP_DIAMOND only.

---

## 9. NEW PLATFORM SURFACES (authorized 2026-04-18)

Pending REQUIREMENTS_MASTER.md addition before directives can be written:

| Series | Surface | Brief Location |
|--------|---------|----------------|
| FC-00N | CreatorZone Fan Community | 03_FEATURE_BRIEFS.md |
| OPS-00N | OQMInc Internal Operations Platform | 03_FEATURE_BRIEFS.md |
| DISC-00N | ShowZone Discovery Guide | 03_FEATURE_BRIEFS.md |
| CCZ-00N | Creator Care Zone | 03_FEATURE_BRIEFS.md |

---

## THREAD CLOSE PROTOCOL

At close of every thread, the outgoing Claude Chat instance MUST:
1. Update Section 6 (Current Pipeline State) above
2. Update Section 7 (Next Immediate Actions) above
3. Update Section 9 if new surfaces or series authorized
4. Commit changes to REFERENCE_LIBRARY/00_THREAD_BOOTSTRAP.md
   with commit message: `CHORE: update THREAD_BOOTSTRAP — Thread {N} close`
5. Then write the detailed handoff document to
   PROGRAM_CONTROL/HANDOFFS/THREAD-{N}-HANDOFF.md as usual
