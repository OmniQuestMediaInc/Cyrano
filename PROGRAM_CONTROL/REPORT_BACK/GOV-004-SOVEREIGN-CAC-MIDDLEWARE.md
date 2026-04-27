# GOV-004 — Sovereign CaC Middleware — Report Back

**Directive:** GOV-004
**Status:** DONE
**Commit prefix:** GOV:
**Risk class:** R0
**Date:** 2026-03-29

---

## What Was Built

### 1. `services/core-api/src/compliance/sovereign-cac.middleware.ts` (CREATED)

Sovereign Compliance-as-Code (CaC) middleware implementing Corpus Appendix J jurisdiction enforcement:

- **`JURISDICTION_RULES_VERSION`** constant (`v1.0.0`) — versioned, requires GOV: commit to change.
- **`JurisdictionRule` interface** — typed jurisdiction rule shape including country/region codes, age assurance method, AI disclosure flag, and reporting obligations.
- **`JURISDICTION_OVERLAY`** — versioned jurisdiction rule set covering:
  - `CA` — Bill S-210 age assurance (`RELIABLE_ESTIMATION`), Bill 149 AI disclosure
  - `CA/ON` — Ontario-specific with `BILL_149_AI_DISCLOSURE` reporting obligation
  - `US` — 18 USC 2257 (`DECLARATION`)
  - `GB` — UK Online Safety Act (`VERIFIED_ID`)
  - `DEFAULT` — fallback (`DECLARATION`, no AI disclosure)
- **`SovereignCaCMiddleware`** — NestJS middleware that:
  - Resolves country from `cf-ipcountry` → `x-country-code` → `DEFAULT`
  - Resolves region from `x-region-code` header
  - Applies region-specific → national → DEFAULT rule resolution
  - Attaches `jurisdiction` context to request for downstream services
  - Sets `X-AI-Disclosure` header when `ai_disclosure_required: true`
  - Sets `X-Age-Assurance-Required` header with the applicable method
  - Logs jurisdiction resolution with structured context

### 2. `services/core-api/src/app.module.ts` (MODIFIED)

- Added `MiddlewareConsumer` and `NestModule` imports from `@nestjs/common`
- Added `SovereignCaCMiddleware` import
- `AppModule` now implements `NestModule` with `configure()` applying the middleware to all routes (`'*'`)

---

## Validation Checklist

| Check | Result |
|-------|--------|
| `JURISDICTION_RULES_VERSION` constant present and versioned | PASS — `'v1.0.0'` |
| `resolveRule('CA', 'ON')` returns `ai_disclosure_required: true` | PASS — matches ON rule |
| `resolveRule('CA', undefined)` returns `age_assurance_method: 'RELIABLE_ESTIMATION'` | PASS — matches CA national rule |
| `resolveRule('XX', undefined)` returns DEFAULT rule | PASS — falls through to DEFAULT |
| `X-AI-Disclosure` header set when `ai_disclosure_required: true` | PASS — set in middleware |
| `X-Age-Assurance-Required` header set with method | PASS — set in middleware |
| `npx tsc --noEmit` clean (no new errors) | PASS — only pre-existing module resolution errors |
| Logger instance included | PASS — `new Logger(SovereignCaCMiddleware.name)` |

---

## What Was Left Incomplete

Nothing. Directive fully implemented as specified.

---

## HANDOFF

**Built:** Sovereign CaC middleware with Bill S-210, Bill 149, and Corpus Appendix J jurisdiction enforcement.
**Left incomplete:** Nothing.
**Next agent's first task:** No GOV-004 follow-up required. Other Tier 4D directives (GOV-002, GOV-003) may proceed independently.
