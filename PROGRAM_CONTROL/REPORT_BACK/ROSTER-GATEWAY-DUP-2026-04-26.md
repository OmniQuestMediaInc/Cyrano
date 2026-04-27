# Research Report — Roster Gateway Duplicate

**Task ID:** ROSTER-GATEWAY-DUP-2026-04-26  
**Branch:** `copilot/claudecleanup-legacy-code-k2iu3`  
**Generated:** 2026-04-26  
**Author:** GitHub Copilot Coding Agent (Phase 2b)  
**Status:** RESEARCH ONLY — no files modified

---

## Files Under Analysis

| # | Path | WO tag |
|---|---|---|
| A | `services/core-api/src/creator/roster.gateway.ts` | `WO: WO-INIT-001` |
| B | `services/core-api/src/creator/surfaces/roster.gateway.ts` | `WO: WO-INIT-001` |

Both files share the same WO tag (`WO-INIT-001`), confirming they originate from the same scaffolding pass. Both appeared in the same commit (`21a5c9d` — the earliest reachable commit in this shallow clone, `HZ: SenSync™ Biometric Layer + Cyrano Layer 1 FFS/SenSync hardening`).

---

## 1 — Full Diff

```diff
--- services/core-api/src/creator/surfaces/roster.gateway.ts
+++ services/core-api/src/creator/roster.gateway.ts
@@ -1,2 +1,22 @@
 // WO: WO-INIT-001
-export class RosterGateway {}
+import { Injectable } from '@nestjs/common';
+
+export interface RosterEntry {
+  performerId: string;
+  studioId: string;
+  contractRef: string;
+  status: string;
+}
+
+@Injectable()
+export class RosterGateway {
+  async getRoster(_studioId: string): Promise<RosterEntry[]> {
+    // TODO: Implement roster retrieval from studio_contracts
+    return [];
+  }
+
+  async getPerformerContract(_studioId: string, _performerId: string): Promise<RosterEntry | null> {
+    // TODO: Implement contract lookup from studio_contracts
+    return null;
+  }
+}
```

**Summary of difference:**
- File **A** (`creator/roster.gateway.ts`) — 22 lines. Contains a `RosterEntry` interface, `@Injectable()` decorator, and two stub methods with `TODO` comments.
- File **B** (`creator/surfaces/roster.gateway.ts`) — 2 lines. Empty shell class with no decorator, no members, no exports beyond the class declaration itself.

---

## 2 — Importers

**Searched:** All `*.ts` and `*.tsx` files in `services/`, `ui/`, `finance/`, `safety/`, `scripts/`, `tests/`, `prisma/` (excluding `node_modules/`).

**Grep patterns applied:**
- `from.*creator/roster`
- `from.*surfaces/roster`
- `RosterGateway` (any occurrence outside the two source files)

**Result: Zero importers for either file.**

Neither `creator/roster.gateway.ts` nor `creator/surfaces/roster.gateway.ts` is imported by any other TypeScript file in the repository.

---

## 3 — Module Registrations

**Searched:** All `*.module.ts` files and `app.module.ts` for `RosterGateway`.

**`services/core-api/src/creator/creator.module.ts` — relevant content:**

```typescript
@Module({
  controllers: [StatementsController],
  providers: [StatementsService],
})
export class CreatorModule {}
```

**Result: `RosterGateway` is not registered in any NestJS module** (`providers`, `controllers`, `imports`, `exports`). Neither variant is wired into the DI container.

---

## 4 — `@WebSocketGateway` Namespace Analysis

**Neither file uses a `@WebSocketGateway` decorator.**

- File **A** uses `@Injectable()` — making it a plain NestJS injectable service, not a WebSocket gateway despite the filename suffix `.gateway.ts`. The naming pattern (`.gateway.ts`) is misleading; the class acts as a data-access gateway (repository pattern), not a WebSocket endpoint.
- File **B** has no decorator at all — it is a bare empty class.

**Conclusion:** The `.gateway.ts` suffix here means "data-access gateway" (a common NestJS pattern for abstracting data retrieval), not a WebSocket gateway. No namespace conflict exists at the WebSocket layer.

---

## 5 — Assessment

| Dimension | File A (`creator/roster.gateway.ts`) | File B (`creator/surfaces/roster.gateway.ts`) |
|---|---|---|
| Lines | 22 | 2 |
| `@Injectable()` | ✅ | ❌ |
| `RosterEntry` interface | ✅ | ❌ |
| Stub methods | ✅ (`getRoster`, `getPerformerContract`) | ❌ |
| Registered in any module | ❌ | ❌ |
| Importers | 0 | 0 |
| `@WebSocketGateway` | ❌ | ❌ |
| Maturity | Further along (stub impl) | Placeholder only |
| Location | `creator/` (matches `CreatorModule` root) | `creator/surfaces/` (sub-package) |

Both files are unregistered dead code. File B (`surfaces/`) is strictly a subset of File A — it has no content that File A does not also have. File A has more content and is in the more semantically correct location (the creator module's root, where `StatementsService`, `StatementsController`, and `CreatorModule` live).

---

## 6 — Recommendation

**Delete `services/core-api/src/creator/surfaces/roster.gateway.ts` (File B) in a future Phase 3 NestJS DI dead-code pass.**

Rationale:
1. File B is an empty shell with zero unique content — it is entirely superseded by File A.
2. File A is in the module-root-aligned location (`creator/`) rather than the sub-package (`creator/surfaces/`), consistent with `StatementsService` and `CreatorModule` living at `creator/`.
3. Neither file is currently wired into any module. Deletion of File B carries zero functional risk.
4. File A (`creator/roster.gateway.ts`) should be retained until the NestJS DI dead-code pass determines whether it should be wired into `CreatorModule` (as the TODO comments suggest it is intended to be) or also deleted.

**Action in this PR: None.** Per Phase 2b directive, this is research-only. Deletion of File B is deferred to the Phase 3 NestJS DI dead-code pass alongside the broader unregistered-module sweep.
