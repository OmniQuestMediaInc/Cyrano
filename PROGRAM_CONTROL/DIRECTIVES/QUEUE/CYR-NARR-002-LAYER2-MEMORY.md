# DIRECTIVE: CYR-NARR-002-LAYER2-MEMORY

**Status:** `QUEUED`
**Commit prefix:** `CYR:`
**Target paths:**

- `prisma/schema.prisma` (UPDATE — add `MemoryEntry`, `StoryBeat`,
  `BranchDecision` models)
- `services/narrative-engine/src/memory-bank.service.ts` (CREATE)
- `services/narrative-engine/src/context-builder.service.ts` (CREATE)
- `services/narrative-engine/src/branching.service.ts` (CREATE)
- `services/narrative-engine/src/narrative.service.ts` (UPDATE — wire the
  three above into the existing public API)

**Risk class:** R2 (data + LLM prompt integrity)

## Context

Cyrano Layer 1 (whisper engine + persona scaffold) is DONE. Layer 2 — the
narrative memory + context-builder + branching layer — is currently a
stub. Without it, conversations have no continuity across sessions and the
LLM has no grounded context beyond the active turn.

## Tasks

1. **Schema** — add the three Prisma models:
   - `MemoryEntry`: `id`, `user_id`, `persona_id`, `content` (text),
     `embedding` (vector OR JSON for pgvector deferral),
     `importance_score` (0..1), `created_at`, `last_accessed_at`,
     `access_count`, plus canonical audit columns (`correlation_id`,
     `reason_code`, `rule_applied_id`). Append-only — no UPDATE/DELETE
     except `last_accessed_at` + `access_count`.
   - `StoryBeat`: `id`, `user_id`, `persona_id`, `beat_type`
     (`OPEN | RISING | TURN | RESOLUTION`), `summary`, `created_at`, plus
     audit columns. Append-only.
   - `BranchDecision`: `id`, `user_id`, `persona_id`, `beat_id`,
     `decision_text`, `consequences` (JSON), `created_at`, audit columns.
     Append-only — branching history is immutable. **No rollback**.

2. **MemoryBankService**:
   - `recordMemory(input)` — persists with importance score (heuristic:
     length × emotional-keyword density × novelty).
   - `recallMemories(query, options)` — relevance score = importance ×
     time-decay (`exp(-age_days / TAU_DAYS)`) × similarity, where
     similarity is cosine over embedding when present, lexical otherwise.
     Default top-K = 5.
   - `incrementAccess(memory_id)` — bumps `access_count` and
     `last_accessed_at` (ONLY mutable columns; enforce via migration
     trigger).

3. **ContextBuilderService**:
   - `buildContext({ user_id, persona_id, turn_text })` returns a token-
     budgeted prompt block:
     - System block: persona description + tone + safety rails (from
       GateGuard policy).
     - Memory block: top 5 `recallMemories()` results, formatted.
     - Beat block: latest `StoryBeat` per type.
   - Caps total prompt tokens at `LLM_MAX_PROMPT_TOKENS` (env, default
     8000). Trims memory block first, never the safety rails.
   - Strips PII before injection (email, phone, last name).

4. **BranchingService**:
   - `recordDecision(input)` writes a `BranchDecision` with
     `consequences` JSON. Throws if a decision already exists for the
     same `(user_id, persona_id, beat_id)` triple — branches are immutable
     once recorded.
   - `replayHistory(user_id, persona_id)` returns the ordered timeline
     for the context-builder.

## Validation

- New unit specs for each service: 90%+ branch coverage.
- New integration spec: round-trip `recordMemory → recallMemories →
buildContext` produces a deterministic prompt under fixed seed.
- Append-only triggers prove `UPDATE memory_entry SET content=...` and
  `DELETE FROM branch_decisions` both raise (per FIZ invariant).
- `yarn typecheck && yarn lint && yarn test` clean.

## Report-back file

`PROGRAM_CONTROL/REPORT_BACK/CYR-NARR-002-LAYER2-MEMORY.md`
