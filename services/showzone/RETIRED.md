# RETIRED — `services/showzone/`

**Status:** RETIRED (2026-04-26)
**Retired by:** feature/ffs-sensync-cyrano-upgrade-v2
**Authority:** CNZ Technical Specification §1 (Global Renames & Cleanup)

---

## Why Retired

The ShowZone service and all ShowToken logic has been fully deprecated as part
of the Single CZT Token Economy specification (§2). All token events now use
only `token_type = 'CZT'`. ShowToken creation, conversion endpoints, and
allotments have been removed.

## What Replaced It

- **Token handling:** Single CZT economy enforced via `token_type` constraint in `TokenBalance`
- **Session management:** Session state now managed in the core session layer

## NATS Topics (Tombstoned)

The following NATS topics are tombstoned in `services/nats/topics.registry.ts`:
- `showzone.dwell.tick`
- `showzone.seat.opened`
- `showzone.phase2.trigger`
- `showzone.show.ended`

These topics must not receive new messages. Any consumer still subscribed to
these subjects should be migrated to the session management layer.

## Action Required for Existing Files

The files in `services/showzone/src/` are retained for reference only.
Do not add new code here. The service is not wired into any module.
