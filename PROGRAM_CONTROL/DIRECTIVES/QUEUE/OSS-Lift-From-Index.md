# OQMInc OSS Repo Registry

| Field | Value |
|---|---|
| **Document ID** | `REF-LIB-OSS-REG-01` |
| **Authority** | Kevin B. Hartley, CEO — OmniQuest Media Inc. |
| **Authored** | Thread 15 — 2026-04-19 |
| **Revised** | 2026-04-21 (migrated to flat `QUEUE/` path; licensing column added) |
| **Repo** | `OmniQuestMediaInc/ChatNowZone--BUILD` |
| **Status** | LIVE |
| **Location** | `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OSS-Repo-Registry.md` |

---

## Purpose

This file is the authoritative registry of all open-source reference repositories harvested into read-only `refs/oss/*` and `refs/oqminc/*` branches.

It is a **manifest only** — what each branch is, where it came from, and what shape it's in. The companion document `OSS-Lift-From-Index.md` defines *how* each branch may be used: lift policy, license status, reimplementation guidance, and per-branch detail cards.

**Read both documents together** when authoring or executing any directive that consumes a `refs/*` branch.

---

## How to Read a File from a Reference Branch

```bash
git show refs/oss/{branch-name}:{filepath}
```

Examples:

```bash
git show refs/oss/booking-api:prisma/schema.prisma
git show refs/oss/socketio-chat:app.js
git show refs/oss/discussion-platform:components/Posts/PostItem.tsx
```

---

## Registry — 9 Reference Repos

| # | Branch | Source Repository | License | Status | Primary Directive Series |
|---|---|---|---|---|---|
| 1 | `refs/oss/booking-api` | `CelaDaniel/Full-Stack-Booking-Management-API` | NONE DETECTED | 🔴 BLOCKED | CCZ-004, DISC-001/004, OPS-006 |
| 2 | `refs/oss/socketio-chat` | `CelaDaniel/nodejs-socketio-chat-application` | NONE DETECTED | 🔴 BLOCKED | OBS-001/002, CCZ-001, OPS-003 |
| 3 | `refs/oss/react-chat-app` | `CelaDaniel/React-Chat-App` | NONE DETECTED | 🔴 BLOCKED | CCZ-001/002, OBS-001 |
| 4 | `refs/oss/discussion-platform` | `CelaDaniel/next_discussion_platform` | **MIT** | 🟢 CLEAR | FC-001 → FC-006, OPS-004 |
| 5 | `refs/oss/live-polling` | `CelaDaniel/react-polling` | NONE DETECTED | 🔴 BLOCKED | OBS Flicker n'Flame Scoring (FFS) broadcast |
| 6 | `refs/oss/zoom-clone` | `CelaDaniel/zoom-clone` | NONE DETECTED | 🔴 BLOCKED | OBS ShowZone Theatre UI, DISC |
| 7 | `refs/oss/loadbalancer-nginx` | `CelaDaniel/loadbalancer-nginx-docker-nodejs` | NONE DETECTED | 🔴 BLOCKED | Bijou SFU infra, OPS deployment |
| 8 | `refs/oss/social-media-app` | `CelaDaniel/Social-media-react-app` | NONE DETECTED | 🔴 BLOCKED | FC-003, CCZ-003, OPS-006 notifications |
| 9 | `refs/oqminc/ai-resources` | `mahseema/free-ai-resources` | **MIT** | 🟢 CLEAR (link list) | OBS-005, HZ, NN-001/002, DFSP |

> **License-status note:** the original Thread 15 manifest recorded all nine source repos as MIT. Direct verification on 21 April 2026 showed only branches #4 and #9 carry an explicit license file. The other seven default to all-rights-reserved under copyright law and are now treated as **PATTERN-REFERENCE-ONLY**. See `OSS-Lift-From-Index.md` §2 for the full SEV-2 finding and §4 for the lift policy.

> **Source-repo correction:** branch #9's source was originally written as `CelaDaniel/free-ai-resources-x` in pre-Thread-15 documents. The canonical public repo is `mahseema/free-ai-resources` (MIT). Thread 15 BRANCH MANIFEST already noted the correction; this registry now reflects it.

---

## Access Rules (Invariant)

- `refs/*` branches are **PERMANENT** and **READ-ONLY**.
- They **NEVER** merge to `main` under any circumstances.
- They are **NEVER** deleted.
- Their content is **NEVER** imported wholesale into CNZ source files.
- For BLOCKED branches: their content **NEVER** appears in CNZ source files in any form (pattern-reference only — clean-room reimplementation).
- For CLEAR branches: file ports allowed under `OSS-Lift-From-Index.md` §4.1 rules (LICENSE preservation + NOTICE attribution required).
- No `package.json`, `tsconfig`, or build config may reference `refs/*` content.
- CI blocks any PR from `refs/*` to `main`. See `.github/workflows/protect-ref-branches.yml`.
- Policy authority: `.github/refs-branch-policy.md`.

---

## How to Reference in Directives

Every directive that consumes a `refs/*` branch must include a `LIFT-FROM` block. The full template and rules live in `OSS-Lift-From-Index.md` §6. Minimum:

```yaml
## LIFT-FROM
Source branch:    refs/oss/<branch-name>
License status:   <CLEAR | BLOCKED>
Lift mode:        <DIRECT_PORT | PATTERN_REFERENCE>
```

For one-off file reads in directive CONTEXT sections, the legacy form is also accepted:

```
REFERENCE: git show refs/oss/{name}:{filepath}
```

---

## Harvest Status

| Branch | Harvest Status | Thread | Notes |
|---|---|---|---|
| `refs/oss/booking-api` | ✅ Harvested | Pre-Thread-14, ratified Thread 15 | |
| `refs/oss/socketio-chat` | ✅ Harvested | Pre-Thread-14, ratified Thread 15 | |
| `refs/oss/react-chat-app` | ✅ Harvested | Pre-Thread-14, ratified Thread 15 | |
| `refs/oss/discussion-platform` | ✅ Harvested | Pre-Thread-14, ratified Thread 15 | Highest-value branch — only MIT-clear code source |
| `refs/oss/live-polling` | ✅ Harvested | Pre-Thread-14, ratified Thread 15 | Tertiary value; reconsider in 90-day sweep |
| `refs/oss/zoom-clone` | ✅ Harvested | Pre-Thread-14, ratified Thread 15 | |
| `refs/oss/loadbalancer-nginx` | ✅ Harvested | Pre-Thread-14, ratified Thread 15 | |
| `refs/oss/social-media-app` | ✅ Harvested | Pre-Thread-14, ratified Thread 15 | Largely redundant with #4 |
| `refs/oqminc/ai-resources` | ✅ Harvested | Pre-Thread-14, ratified Thread 15 | Bibliography only, no code |

---

## Cross-References

- `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OSS-Lift-From-Index.md` — per-branch lift policy and detail cards (read this with the registry)
- `PROGRAM_CONTROL/DIRECTIVES/QUEUE/OSS-Attributions.md` — *to be created by the first directive that performs a `DIRECT_PORT`*
- `PROGRAM_CONTROL/REPORT_BACK/THREAD15-OSS-HARVEST.md` — original harvest report-back
- `.github/workflows/protect-ref-branches.yml` — CI enforcement
- `.github/refs-branch-policy.md` — policy authority document

---

## Migration Provenance

This file replaces the prior `REFERENCE_LIBRARY/05_OSS_REPO_REGISTRY.md` per CEO directive of 2026-04-21:

- **Renamed** from `05_OSS_REPO_REGISTRY.md` → `OSS-Repo-Registry.md` (hyphen convention; numeric prefix dropped).
- **Relocated** from `REFERENCE_LIBRARY/` → `PROGRAM_CONTROL/DIRECTIVES/QUEUE/` (flat structure; no subfolder).
- **Content-augmented** with: a License column (replacing the prior empty Notes column), a license-status callout flagging the SEV-2 finding, and an explicit source-repo correction for branch #9.
- All access rules, branch identities, and harvest statuses preserved verbatim from the Thread 15 version.

The old file at `REFERENCE_LIBRARY/05_OSS_REPO_REGISTRY.md` should be deleted in the same commit that adds this one. No content is lost; everything that was there is here, in the new convention.

---

*OmniQuest Media Inc. · ChatNow.Zone Build Control · `REF-LIB-OSS-REG-01` · Migrated 21 April 2026*
