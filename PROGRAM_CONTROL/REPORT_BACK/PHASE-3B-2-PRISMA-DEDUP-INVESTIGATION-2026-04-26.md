# Phase 3b-2 Prisma Schema Dedup — Investigation Report

**Date:** 2026-04-26
**Branch:** `claude/phase-3b-2-prisma-investigation-K2Iu3`
**Authority:** User-authorized 10-min investigation pass
**Mode:** Investigation only — zero code changes.

This report answers the four blocking questions from earlier context: which version of each duplicate Prisma model is canonical, and what to do about each. Migration files turned out to be the decisive ground truth.

---

## Summary recommendation — HIGH confidence

**Delete the FIRST declarations. Keep the SECOND declarations.** All three duplicates resolve the same way.

| Model | Canonical (keep) | Delete | Confidence |
|---|---|---|---|
| `FfsSnapshot` | line 1847 | line 1397 | HIGH |
| `FfsAdaptiveWeights` | line 1868 | line 1418 | HIGH |
| `SenSyncTierConfig` | line 1895 | line 1438 | HIGH (trivial — only doc-comment style differs) |

Rationale (in 30 seconds):
- The live migration `20260426000000_ffs_sensync_velocityzone/migration.sql` is the ground truth — it built the actual production tables.
- The **second declarations** in `prisma/schema.prisma` exactly mirror the migration's `DEFAULT` clauses.
- The **first declarations** have stale defaults (`FFS_ENGINE_v2`, `ADAPTIVE_INIT`, `FFS_ADAPTIVE_v1`) that **do not appear anywhere in live source code or migrations** — they are orphans.

---

## 1 — Git history of each duplicate

```
First declaration  (line 1397, 1418, 1438): commit 0699211 — PR #335
                                            "CHORE: Global rename Room-Heat Engine → Flicker n'Flame Scoring (FFS), HeartSync → SenSync™"
                                            Date: 2026-04-25 22:57 UTC

Second declaration (line 1847, 1868, 1895): commit a59e519 — PR #343
                                            "FFS + SenSync™ + VelocityZone + Single CZT enforcement — Phase 1"
                                            Date: 2026-04-26 06:51 UTC
```

The second was added later as part of the same SenSync merge that produced the topic-registry duplicates we already cleaned up in Phase 3b-1. Same anti-pattern: PR #343 appended a parallel set of model declarations rather than reconciling against PR #335's earlier rename pass.

---

## 2 — Live migration is the ground truth

`prisma/migrations/20260426000000_ffs_sensync_velocityzone/migration.sql` is the migration that physically created the `ffs_snapshots`, `ffs_adaptive_weights`, and `sensync_tier_configs` tables in production.

### `ffs_snapshots`

```sql
CREATE TABLE IF NOT EXISTS ffs_snapshots (
  ...
  rule_applied_id VARCHAR(100) NOT NULL DEFAULT 'FFS_ENGINE_v1',
  ...
);
COMMENT ON TABLE ffs_snapshots IS
  'Append-only time-series of every FFS score computed. '
  'Replaces room_heat_snapshots for new FFS service. Rule: FFS_ENGINE_v1.';
```

### `ffs_adaptive_weights`

```sql
CREATE TABLE IF NOT EXISTS ffs_adaptive_weights (
  ...
  reason_code     VARCHAR(100) NOT NULL DEFAULT 'FFS_ADAPTIVE_INIT',
  rule_applied_id VARCHAR(100) NOT NULL DEFAULT 'FFS_ENGINE_v1',
  ...
);
```

### `sensync_tier_configs`

Columns identical to both schema declarations; no `DEFAULT` differences.

---

## 3 — Schema declarations vs migration

### `FfsSnapshot`

| Field | First declaration (line 1397) | Second declaration (line 1847) | **Migration** |
|---|---|---|---|
| `rule_applied_id` default | `"FFS_ENGINE_v2"` ❌ | `"FFS_ENGINE_v1"` ✅ | `'FFS_ENGINE_v1'` |
| Components doc | "HeatScoreComponents" (pre-FFS rename) ❌ | "FfsScoreComponents" (matches FFS naming) ✅ | n/a (no comment) |

### `FfsAdaptiveWeights`

| Field | First declaration (line 1418) | Second declaration (line 1868) | **Migration** |
|---|---|---|---|
| `reason_code` default | `"ADAPTIVE_INIT"` ❌ | `"FFS_ADAPTIVE_INIT"` ✅ | `'FFS_ADAPTIVE_INIT'` |
| `rule_applied_id` default | `"FFS_ADAPTIVE_v1"` ❌ | `"FFS_ENGINE_v1"` ✅ | `'FFS_ENGINE_v1'` |
| Components doc | "scoring component" | "FFS component" | n/a |

### `SenSyncTierConfig`

| Field | First (line 1438) | Second (line 1895) | Migration |
|---|---|---|---|
| Columns | identical | identical | identical |
| Doc-comment style | `//` | `///` (Prisma rich-doc) | n/a |

Either declaration would produce the same DB schema. The second uses Prisma's `///` rich-doc convention (consistent with the rest of the FFS section), so it's the more idiomatic choice.

---

## 4 — Live code matches the second declarations

### Live `FFS_RULE_ID`

```
services/creator-control/src/ffs.engine.ts:15:export const FFS_RULE_ID = 'FFS_ENGINE_v1';
services/ffs/src/types/ffs.types.ts:3:// Rule authority: FFS_ENGINE_v1 — see DOMAIN_GLOSSARY.md
services/ffs/src/ffs.service.ts:39:export const FFS_RULE_ID = 'FFS_ENGINE_v1';
```

All `'FFS_ENGINE_v1'`. Zero references to `'FFS_ENGINE_v2'` anywhere in `services/`, `ui/`, or `tests/`.

### Live `reason_code: 'FFS_ADAPTIVE_INIT'`

```
services/ffs/src/ffs.service.ts:609:            reason_code:     'FFS_ADAPTIVE_INIT',
```

Exactly the second declaration's default. Zero references to `'ADAPTIVE_INIT'` (without the `FFS_` prefix) anywhere in the source tree.

### Conclusion

**The first declaration's defaults are orphaned — they exist in the schema but no migration uses them and no service code references them.** They are pure dead code carried forward from the FFS rename pass that didn't clean up the prior schema state.

---

## 5 — Recommended Phase 3b-2 fix shape

**Single PR, three near-identical edits:**

1. Delete `model FfsSnapshot { ... }` block at lines 1397–1414.
2. Delete `model FfsAdaptiveWeights { ... }` block at lines 1418–1432.
3. Delete `model SenSyncTierConfig { ... }` block at lines 1438–1455.
4. Run `yarn prisma generate` — should now succeed (the duplicate-model errors will be gone since only one declaration of each model remains).
5. Verify the generated client exports the expected types (`BijouAdmissionStatus`, `BijouSessionStatus`, `BillingInterval`, `MembershipTier`, `SubscriptionStatus`, `ShiftTemplate` — clearing 9 TSC errors).
6. Add `"postinstall": "prisma generate"` to `package.json` so future `yarn install` calls regenerate the client automatically (the original Phase 3b-2 build-pipeline goal).

**Expected end state:**
- TSC: 9 → 0 (all `PRISMA_CLIENT_MISSING` cleared)
- Lint: 0 → 0
- Jest: 31/31 suites passing, 395/395 tests passing
- Ship-gate: GREEN 19/19
- **Cleanup arc fully complete.**

---

## 6 — Migration safety check

The migration `20260426000000_ffs_sensync_velocityzone` already ran (the tables exist with `'FFS_ENGINE_v1'` and `'FFS_ADAPTIVE_INIT'` defaults). Deleting the first declarations from `schema.prisma` and keeping the second:
- Does **not** trigger any migration drift (the `prisma generate` output reflects the schema; the actual DB defaults come from the migration that already ran).
- Does **not** require a new migration (no column or default change is being requested).
- Is purely a Prisma client regeneration — a build-pipeline concern, not a schema-evolution concern.

If you ever wanted to switch the runtime default to something else, that *would* require a new migration with `ALTER TABLE ... ALTER COLUMN ... SET DEFAULT ...`. This PR does not do that.

---

## 7 — What was NOT done

- No `prisma/schema.prisma` edits.
- No `prisma generate` run.
- No `package.json` edit to add `postinstall`.
- No source code touched.
- No migrations modified.

Investigation only. Awaiting authorization to execute the actual fix.

---

## 8 — Risk assessment for the fix PR

| Risk | Likelihood | Mitigation |
|---|---|---|
| Schema-vs-migration drift after dedup | NONE | The kept declarations *exactly* match the migration |
| Unexpected TSC errors after Prisma client regen | LOW | If Prisma exports differ from current `any` typings, surface in the same PR's verification step; new errors surface masked drift, not introduce it |
| Existing data inconsistency | NONE | Neither default change is being made; existing rows retain their stored values |
| Production code broken by client regen | LOW | The 9 currently-failing TSC sites all import enum/model types by name; once Prisma exports them, the imports resolve |
| Broken jest after regen | LOW | All currently-failing TSC sites are in production code paths exercised by tests already passing in TSC_CASCADE-cleared state — they were already importing these enums and the imports just need the regenerated client |

Single-concern PR. ~50 lines of `schema.prisma` deletion + `package.json` postinstall + verification output. Lowest-risk way to clear the remaining 9 TSC errors.
