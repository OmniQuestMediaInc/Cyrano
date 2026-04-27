# Phase 3b-4 — TokenType + Ambiguous NATS Topic Research

**Date:** 2026-04-26
**Branch:** `claude/phase-3b-4-ambiguity-research-K2Iu3`
**Authority:** Phase 3b-4 directive
**Mode:** Investigation only — zero source code changes.

This report answers two questions raised by Phase 3a §8.1 and §8.2 with concrete evidence from git history, doctrine, and surrounding code. Each recommendation has a confidence rating; HIGH-confidence items are safe to action in Phase 3b-5/6 without further escalation.

---

## Q1 — `TokenType.REGULAR` and `TokenType.BIJOU` in `tests/integration/ledger-service.spec.ts`

### 1.1 Reference inventory

`TokenType.REGULAR` and `TokenType.BIJOU` are referenced **30 times** in `tests/integration/ledger-service.spec.ts` (29× `REGULAR`, 1× `BIJOU` at line 247–249, plus lines 138, 155, 169, 177, 191, 210, 229, 236–239, 246–249, 290, 299, 316, 325, 344, 353, 375, 385, 397, 406, 431, 452, 463, 477, 486).

### 1.2 Current `TokenType` enum

`services/core-api/src/finance/ledger.service.ts:19–27`:
```ts
/**
 * TokenType — CZT is the only platform currency.
 * ShowZoneTokens (SZT), SHOW_THEATER, and BIJOU token types are retired
 * per Tech Debt Delta 2026-04-16 TOK-001 through TOK-004.
 * All transactions use CZT regardless of venue.
 */
export enum TokenType {
  CZT = 'CZT',
}
```

The enum's own JSDoc explicitly declares `BIJOU` retired.

### 1.3 Git history — when did `REGULAR` / `BIJOU` disappear from the enum?

**Commit `1d513f0`** — PR #241 *"FIZ: TOK-RETIRE-001 — Retire ShowToken types, update payout to Room-Heat rates"* (merged 2026-04-16):

```diff
 export enum TokenType {
-  REGULAR = 'REGULAR',
-  SHOW_THEATER = 'SHOW_THEATER',
-  BIJOU = 'BIJOU',
+  CZT = 'CZT',
 }
```

The retirement was deliberate, governance-authorized, and tied to the **Single-currency CZT architecture** decision per Tech Debt Delta 2026-04-16.

### 1.4 Spec file history

`tests/integration/ledger-service.spec.ts` was last touched in commits `203b512` ("Revise attributions file references and update status") and `0461bc2` ("CHORE: wire seed_data CSVs to integration test suite — LedgerService …"). Neither commit references TOK-RETIRE-001 or the token-type collapse. **The TOK-RETIRE-001 sweep updated the production code but did not update this integration spec.** This is consistent with the directive's listed scope (`Files Modified` enumerated four production files; the spec was not in scope).

### 1.5 Doctrine cross-references

- **`PROGRAM_CONTROL/DIRECTIVES/DONE/TOK-RETIRE-001.md`** explicitly states the objective: *"Retire `TokenType.SHOW_THEATER` and `TokenType.BIJOU`; collapse `TokenType` to CZT-only."* Status: DONE.
- **`services/showzone/RETIRED.md`** ties showzone retirement to single-CZT enforcement.
- **`README.md`** describes ChatNow.Zone as governed by *"single CZT token economy specification"*.
- No remaining doctrine document advocates a multi-token-type model.

### 1.6 Recommendation — `REPLACE_WITH_CZT`

**Confidence: HIGH.**

All 30 references should be changed from `TokenType.REGULAR` / `TokenType.BIJOU` → `TokenType.CZT`. The spec is stale; the production model is correct. No enum values need to be added back.

The retitle should be a mechanical sed-style replace, since neither retired value carries semantics that distinguish them from CZT in test scenarios — they are token-type discriminators only, and post-retirement there is exactly one discriminator.

---

## Q2 — `FFS_SCORE_SAMPLE`, `FFS_SCORE_PEAK`, `FFS_SCORED`

### 2.1 Reference inventory

Three production code sites reference NATS topic constants that don't exist in `services/nats/topics.registry.ts`:

| TSC # | File:line | Constant | Surrounding semantic |
|---|---|---|---|
| #11 | `services/creator-control/src/ffs.engine.ts:92` | `FFS_SCORE_SAMPLE` | Published every time `ingest()` produces a score from a sample (continuous emission) |
| #13 | `services/creator-control/src/ffs.engine.ts:115` | `FFS_SCORE_PEAK` | Published only when `score.tier === 'INFERNO'` (peak detection) |
| #14 | `services/guest-heat/src/fan-fervor-score.service.ts:191` | `FFS_SCORED` | Published after computing per-guest fervor score with HeartSync biometric boost (per-guest event, distinct from room-level) |

### 2.2 Existing canonical FFS keys in registry

`services/nats/topics.registry.ts:247–255`:

```ts
FFS_SCORE_UPDATE:        'ffs.score.update',
FFS_TIER_CHANGED:        'ffs.score.tier.changed',
FFS_PEAK:                'ffs.score.peak',
FFS_LEADERBOARD_UPDATED: 'ffs.score.leaderboard.updated',
FFS_HOT_AND_READY:       'ffs.score.hot_and_ready',
FFS_DUAL_FLAME_PEAK:     'ffs.score.dual_flame.peak',
FFS_SESSION_STARTED:     'ffs.score.session.started',
FFS_SESSION_ENDED:       'ffs.score.session.ended',
FFS_ADAPTIVE_UPDATED:    'ffs.score.adaptive.updated',
```

### 2.3 Smoking gun — the Room-Heat → FFS rename mapping

Pre-rename (Room-Heat era), the registry contained:

```
ROOM_HEAT_SAMPLE              → 'room.heat.sample'
ROOM_HEAT_TIER_CHANGED        → 'room.heat.tier.changed'
ROOM_HEAT_PEAK                → 'room.heat.peak'
ROOM_HEAT_LEADERBOARD_UPDATED → 'room.heat.leaderboard.updated'
ROOM_HEAT_HOT_AND_READY       → 'room.heat.hot_and_ready'
ROOM_HEAT_DUAL_FLAME_PEAK     → 'room.heat.dual_flame.peak'
ROOM_HEAT_SESSION_STARTED     → 'room.heat.session.started'
ROOM_HEAT_SESSION_ENDED       → 'room.heat.session.ended'
ROOM_HEAT_ADAPTIVE_UPDATED    → 'room.heat.adaptive.updated'
```

The global rename in **PR #335** *"CHORE: Global rename Room-Heat Engine → Flicker n'Flame Scoring (FFS), HeartSync → SenSync™"* mapped suffixes 1:1 *except* for `SAMPLE`:

| Pre-rename | Post-rename in registry | Producer code (current) |
|---|---|---|
| `ROOM_HEAT_SAMPLE` | **`FFS_SCORE_UPDATE`** ⚠️ semantic shift | **`FFS_SCORE_SAMPLE`** ⚠️ matches old suffix |
| `ROOM_HEAT_TIER_CHANGED` | `FFS_TIER_CHANGED` ✅ | `FFS_TIER_CHANGED` ✅ (fixed in 3b-3) |
| `ROOM_HEAT_PEAK` | `FFS_PEAK` ✅ | **`FFS_SCORE_PEAK`** ⚠️ extra `_SCORE_` infix |
| `ROOM_HEAT_LEADERBOARD_UPDATED` | `FFS_LEADERBOARD_UPDATED` ✅ | n/a |
| `ROOM_HEAT_HOT_AND_READY` | `FFS_HOT_AND_READY` ✅ | n/a |
| `ROOM_HEAT_DUAL_FLAME_PEAK` | `FFS_DUAL_FLAME_PEAK` ✅ | n/a |

The registry's name shift `SAMPLE → UPDATE` is anomalous against the otherwise-mechanical rename pattern, and the producer side `ffs.engine.ts:92` still uses `SAMPLE` semantics. Two possibilities:

- **A.** The registry maintainer in #335 deliberately re-named `SAMPLE → UPDATE` to better describe the event; the producer was missed.
- **B.** The rename was inconsistent (typo); registry should have kept `SAMPLE`.

Either way, there is a clear inconsistency to resolve.

### 2.4 Per-topic recommendations

#### `FFS_SCORE_SAMPLE` (TSC #11)

**Recommendation: `RENAME_SOURCE_TO_FFS_SCORE_UPDATE`** — change `ffs.engine.ts:92` to publish `NATS_TOPICS.FFS_SCORE_UPDATE`.

**Confidence: HIGH** *for the rename direction* (registry is canonical source-of-truth); **MEDIUM** for the choice between `UPDATE` vs reverting registry to `SAMPLE`. If subscriber code already binds to `FFS_SCORE_UPDATE` / `'ffs.score.update'`, renaming the producer is the lower-blast-radius fix. Recommend grepping for `ffs.score.update` and `FFS_SCORE_UPDATE` consumer-side before committing — if zero subscribers exist, either direction works.

#### `FFS_SCORE_PEAK` (TSC #13)

**Recommendation: `RENAME_SOURCE_TO_FFS_PEAK`** — change `ffs.engine.ts:115` to publish `NATS_TOPICS.FFS_PEAK`.

**Confidence: HIGH.** The registry's `FFS_PEAK` (`'ffs.score.peak'`) is the direct rename of `ROOM_HEAT_PEAK` (`'room.heat.peak'`) and is the only peak-related FFS topic in the canonical set. The producer's `FFS_SCORE_PEAK` is a typo/drift. The semantic intent is identical (peak detection at INFERNO tier). Subscriber risk is low because the registry name predates the producer reference.

#### `FFS_SCORED` (TSC #14)

**Recommendation: `ADD_NEW_TO_REGISTRY` as `FFS_GUEST_SCORED` → `'ffs.score.guest.scored'`**, then update source.

**Confidence: MEDIUM.**

Rationale:
- `fan-fervor-score.service.ts` is **per-guest** scoring with HeartSync biometric boost (`heartsync_boost`, `heartsync_opted_in` in payload). Semantically distinct from `ffs.engine.ts` which is **room-level** scoring.
- The closest existing topic, `FFS_SCORE_UPDATE`, is room-level. Folding per-guest events into the same topic would require subscribers to discriminate by payload shape — a brittle pattern.
- Precedent: `GUEST_HEAT_WHALE_SCORED` follows a `<DOMAIN>_<SUBJECT>_<EVENT>` per-guest naming convention. `FFS_GUEST_SCORED` would match that convention.
- This service was added in PR #336 ("CRM: Add Fan Fervor Score (FFS) — per-guest engagement scoring with HeartSync biometric boost"), so `FFS_SCORED` was never in the registry — this is a missed registry update at service-introduction time, not a rename drift.

Alternative if user prefers: rename source to `FFS_SCORE_UPDATE`. Less correct semantically but avoids the registry addition.

### 2.5 Subscriber blast-radius check (recommended for Phase 3b-5/6)

Before fixing #11/#13/#14, grep for any consumer-side subscriptions to the new names. If 3b-5 chooses to update producer (rather than registry), and a subscriber is already bound to the producer's "wrong" name, the subscriber must be updated in the same commit. From a quick scan I do not see subscribers of `FFS_SCORE_SAMPLE`, `FFS_SCORE_PEAK`, or `FFS_SCORED` outside the producer files themselves — but this should be re-verified before action.

---

## Tangential Observations

The following were spotted during this research. Per directive, no fixes applied — flagged for separate scope.

### T1 — Duplicate `TokenOrigin` import in `ledger-service.spec.ts` (J1's other failure)

`tests/integration/ledger-service.spec.ts:11–16`:

```ts
import {
  LedgerService,
  TokenType,
  TokenOrigin,                                                           // ← (1)
  WalletBucket,
} from '../../services/core-api/src/finance/ledger.service';
import { TokenOrigin } from '../../services/core-api/src/finance/types/ledger.types';  // ← (2)
```

`ledger.service.ts:11` re-exports `TokenOrigin` (`export { TokenOrigin };`). Both imports refer to the same enum, so this is a pure duplicate-identifier error (TS2300). Fix: delete line 16 (the type-path import); the bundled import on lines 11–16 already provides `TokenOrigin`.

This is the first of two issues blocking J1 (`ledger-service.spec.ts`). The other is the TokenType.REGULAR/BIJOU references covered in Q1. Both can be fixed together in a Phase 3b-6 spec-only PR.

### T2 — `FFS_RULE_ID` defined in two places

The directive scope did not require this analysis, but I noticed during semantic review: `FFS_RULE_ID = 'FFS_ENGINE_v1'` appears at `services/creator-control/src/ffs.engine.ts:15` and the same constant is presumably referenced in `fan-fervor-score.service.ts`. Worth confirming they're imported from a single source rather than duplicated. Out of scope here; flagging for hygiene.

---

## What Was NOT Done

- **No code changed.** Not one source file. Not the registry. Not the spec.
- **No suppressions added** anywhere.
- **No `yarn prisma:generate`** or any state-modifying command.
- **No subscriber-side audit beyond a quick grep** — recommended as a pre-flight check for Phase 3b-5/6, not done here.
- **No fix attempted on T1 or T2** despite their being trivially fixable. Tangential observations are flagged for separate scope per directive.

---

## Phase 3b-5/6 readiness summary

| Item | Recommendation | Confidence | Action target |
|---|---|---|---|
| Q1 — `TokenType.REGULAR` × 29 | Replace with `TokenType.CZT` | HIGH | Phase 3b-6 (spec-only PR) |
| Q1 — `TokenType.BIJOU` × 1 | Replace with `TokenType.CZT` | HIGH | Phase 3b-6 (spec-only PR) |
| Q2 — `FFS_SCORE_SAMPLE` (TSC #11) | Rename producer → `FFS_SCORE_UPDATE` | HIGH (with subscriber-grep pre-flight) | Phase 3b-5 |
| Q2 — `FFS_SCORE_PEAK` (TSC #13) | Rename producer → `FFS_PEAK` | HIGH | Phase 3b-5 |
| Q2 — `FFS_SCORED` (TSC #14) | Add `FFS_GUEST_SCORED` to registry, rename producer | MEDIUM | Phase 3b-5 |
| T1 — duplicate TokenOrigin import | Remove line 16 of spec | HIGH | Phase 3b-6 |

**Expected delta after 3b-5 + 3b-6:**
- TSC: 12 → 9 (clears #11/#13/#14)
- Jest suites: 4 → 0 (J1 fixed by 3b-6, J2/J3/J4 fixed by 3b-5)
- Lint: 0 → 0

After 3b-5/6, only the 9 PRISMA_CLIENT_MISSING errors remain — gated on the Phase 3b-2 schema dedup decision currently held with the user.
