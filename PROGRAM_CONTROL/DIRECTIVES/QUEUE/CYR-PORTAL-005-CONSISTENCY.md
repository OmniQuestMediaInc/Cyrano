# DIRECTIVE: CYR-PORTAL-005-CONSISTENCY

**Status:** `QUEUED`
**Commit prefix:** `CYR:`
**Target paths:**

- `apps/shared-ui/src/components/{CharacterChat,VoiceCall,AITwinCreator}/*` (CREATE)
- `apps/portals/*/package.json` (UPDATE — depend on shared-ui)
- `apps/portals/*/src/app/*` (UPDATE — replace inline duplicates with
  shared-ui imports)
- `apps/portals/*/.env.example` (NORMALIZE)

**Risk class:** R1 (UX consistency; no FIZ touch)

## Context

Six branded adult-themed portals exist (ink-and-steel, dark-desires,
etc.) plus the main `cyrano-standalone` portal. They each carry inline
copies of the CharacterChat / VoiceCall / AITwinCreator components, which
have already drifted in obvious ways (button labels, NATS topics, theme
tokens). `apps/shared-ui/` is the canonical home and is currently
underused.

## Tasks

1. Lift the three components into `apps/shared-ui/`:
   - `CharacterChat` (text-only chat, plug-points for whisper + memory
     overlays).
   - `VoiceCall` (consent + waveform + degrade-to-text).
   - `AITwinCreator` (multi-step wizard from CYR-AI-TWIN-003).

2. Theming:
   - Each portal supplies a `BrandTheme` provider (existing pattern in
     `apps/portals/<brand>/src/theme.ts`).
   - Components consume tokens via the theme; no hard-coded colors.

3. Replace each portal's inline implementation with the shared component
   import. Reduce the per-portal repo to: theme, copy, route shell,
   nothing else.

4. Stand up a working `yarn dev` for every brand portal — currently
   several do not boot. Add a single root-level `yarn dev:portals`
   composer script.

5. Normalize `.env.example` across portals so all share the canonical
   ChatNow.Zone + Cyrano variable set.

## Validation

- `yarn workspace @cyrano/shared-ui test` — new component specs.
- Each portal's `yarn dev` boots cleanly.
- `tests/e2e/portal-*.spec.ts` — smoke for every portal landing page.
- Visual regression via Storybook snapshot (deferred if Storybook is not
  yet installed — opt-out clearance from CEO required to skip).
- `yarn typecheck && yarn lint && yarn test` clean.

## Report-back file

`PROGRAM_CONTROL/REPORT_BACK/CYR-PORTAL-005-CONSISTENCY.md`
