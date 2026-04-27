# WO Report-Back: Fix invalid PL/pgSQL function definition in init-ledger.sql

## Branch + HEAD Commit
- **Branch:** `copilot/fix-invalid-plpgsql-function-definition`
- **HEAD:** `c8de9b49ec92ef0d898190582326e290777f0142`

## Files Changed (`git diff --stat`)

No source changes required on this branch — the `$${` → `$$` fix was already
delivered by prior PRs (first fixed in PR #40, confirmed again in PRs #41–#47)
and is present in `main`. This report confirms the current state is correct.

```
PROGRAM_CONTROL/REPORT_BACK/WO-FIX-PLPGSQL-FUNC-DEF.md | (this file — audit record)
```

## Root Cause (Historical)

`infra/postgres/init-ledger.sql` previously contained `RETURNS TRIGGER AS $${`
in three PL/pgSQL function definitions. PostgreSQL interprets `$${` as the opening
of a custom dollar-quote tag named `{`, requiring a matching `$${` closing delimiter,
rather than the anonymous `$$` dollar-quote. This produced:

```
psql:infra/postgres/init-ledger.sql:180: ERROR:  syntax error at or near "{"
LINE 2: RETURNS TRIGGER AS $${
```

The original fix was delivered in PR #40 and has been stable across all subsequent merges.

## Audit of ALL CREATE OR REPLACE FUNCTION Statements

| Line | Function | Opening delimiter | Closing delimiter | Status |
|------|----------|-------------------|-------------------|--------|
| 172  | `ledger_entries_block_mutation()` | `RETURNS TRIGGER AS $$` (line 173) | `$$ LANGUAGE plpgsql;` (line 181) | ✅ Correct |
| 299  | `transactions_block_mutation()` | `RETURNS TRIGGER AS $$` (line 300) | `$$ LANGUAGE plpgsql;` (line 328) | ✅ Correct |
| 337  | `set_transactions_updated_at()` | `RETURNS TRIGGER AS $$` (line 338) | `$$ LANGUAGE plpgsql;` (line 345) | ✅ Correct |

No `$${` patterns remain anywhere in the file.

## Commands Run + Verbatim Outputs

### 1. Verify no `$${` pattern remains
```
$ grep -n '\$\${' infra/postgres/init-ledger.sql
(no output — exit code 1, meaning no matches found)
```

### 2. Confirm all CREATE OR REPLACE FUNCTION delimiters
```
$ grep -n '\$\$' infra/postgres/init-ledger.sql
173:RETURNS TRIGGER AS $$
181:$$ LANGUAGE plpgsql;
300:RETURNS TRIGGER AS $$
328:$$ LANGUAGE plpgsql;
338:RETURNS TRIGGER AS $$
345:$$ LANGUAGE plpgsql;
```

All three function bodies open and close with `$$` — conforming to PostgreSQL
dollar-quoting norms. Function bodies are untouched; only delimiters were corrected
in the prior fix.

### 3. CI validate-schema reference
- The `validate-schema` job applies `infra/postgres/init-ledger.sql` against a
  live `postgres:16` instance using `psql -v ON_ERROR_STOP=1`.
- CI passes on `main` after the prior fix was merged.

## Result
✅ SUCCESS — All PL/pgSQL dollar-quote delimiters in `infra/postgres/init-ledger.sql`
conform to PostgreSQL norms. The three affected functions (`ledger_entries_block_mutation`,
`transactions_block_mutation`, `set_transactions_updated_at`) all use correct `$$ ... $$`
dollar-quoting. The `validate-schema` CI step passes. No further source changes required.
