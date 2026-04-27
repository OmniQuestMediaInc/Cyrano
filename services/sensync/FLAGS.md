# SenSync™ Service — Feature Flags

All flags are governance-only at v1 (hardcoded constants in `sensync.types.ts`).
A future runtime-flag service (OQMI Feature Gate) will replace these.

| Flag | Default | Location | Effect |
|------|---------|----------|--------|
| `SENSYNC_HARDWARE_TIERS` | `['VIP_DIAMOND']` | `sensync.types.ts` | Tiers permitted to open hardware bridge sessions |
| `SENSYNC_CONSENT_VERSION` | `'SENSYNC_CONSENT_v1'` | `sensync.types.ts` | Current consent version string — bump when consent copy changes |
| `SENSYNC_BPM_MIN` | `30` | `sensync.types.ts` | Minimum plausible BPM; samples below are rejected |
| `SENSYNC_BPM_MAX` | `220` | `sensync.types.ts` | Maximum plausible BPM; samples above are rejected |
