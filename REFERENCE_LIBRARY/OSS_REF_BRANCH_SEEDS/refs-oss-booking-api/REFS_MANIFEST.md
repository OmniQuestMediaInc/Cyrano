# REFS MANIFEST

**Branch:** `refs/oss/booking-api`
**Source Repository:** `CelaDaniel/Full-Stack-Booking-Management-API`
**Source URL:** https://github.com/CelaDaniel/Full-Stack-Booking-Management-API
**Primary Directive Series:** CCZ-004, DISC-001/004, OPS-006
**Harvest Date:** 2026-04-19
**Harvest Agent:** Copilot (THREAD15-OSS-HARVEST)
**Harvest Status:** MANIFEST-STUB (OSS source content pending internet access)

---

## PURPOSE

Permanent read-only reference branch for OmniQuest Media Inc. ChatNow.Zone
build. Contains open-source reference material from `CelaDaniel/Full-Stack-Booking-Management-API`
for use by agents when authoring directives.

Full-stack booking management API with Prisma schema and NestJS controllers. Referenced by CCZ-004 (booking/reservation flows), DISC-001/004 (discussion schemas), and OPS-006.

## HOW TO USE

Read a file from this branch:
```
git show refs/oss/booking-api:<filepath>
```

Example:
```
git show refs/oss/booking-api:README.md
```

## CONTENT STATUS

> **STUB** — GitHub was inaccessible (MITM proxy at 127.0.0.1 blocked outbound
> git push) during Thread 15 harvest on 2026-04-19.
> This branch contains only this manifest.
>
> To populate with full OSS source content when internet access is restored:
> ```bash
> git clone https://github.com/CelaDaniel/Full-Stack-Booking-Management-API.git /tmp/Full-Stack-Booking-Management-API
> cd /tmp/Full-Stack-Booking-Management-API
> git remote add cnz https://github.com/OmniQuestMediaInc/ChatNowZone--BUILD
> git push cnz HEAD:refs/oss/booking-api
> ```
>
> To update if the branch already exists as a manifest stub:
> ```bash
> git fetch https://github.com/CelaDaniel/Full-Stack-Booking-Management-API.git HEAD
> git push origin FETCH_HEAD:refs/oss/booking-api --force-with-lease
> ```

---

## ACCESS RULES (INVARIANT)

- This branch NEVER merges to main under any circumstances.
- This branch is NEVER deleted.
- Content from this branch is NEVER imported into CNZ source files.
- No package.json, tsconfig, or build config may reference this content.
- Policy authority: .github/refs-branch-policy.md
- CI block: .github/workflows/protect-ref-branches.yml

---

*END REFS MANIFEST*
