# REFS MANIFEST

**Branch:** `refs/oss/live-polling`
**Source Repository:** `CelaDaniel/react-polling`
**Source URL:** https://github.com/CelaDaniel/react-polling
**Primary Directive Series:** OBS Flicker n'Flame Scoring (FFS) broadcast
**Harvest Date:** 2026-04-19
**Harvest Agent:** Copilot (THREAD15-OSS-HARVEST)
**Harvest Status:** MANIFEST-STUB (OSS source content pending internet access)

---

## PURPOSE

Permanent read-only reference branch for OmniQuest Media Inc. ChatNow.Zone
build. Contains open-source reference material from `CelaDaniel/react-polling`
for use by agents when authoring directives.

React real-time polling library. Live vote/reaction broadcast patterns for the OBS Flicker n'Flame Scoring (FFS) that drives audience engagement metrics.

## HOW TO USE

Read a file from this branch:
```
git show refs/oss/live-polling:<filepath>
```

Example:
```
git show refs/oss/live-polling:README.md
```

## CONTENT STATUS

> **STUB** — GitHub was inaccessible (MITM proxy at 127.0.0.1 blocked outbound
> git push) during Thread 15 harvest on 2026-04-19.
> This branch contains only this manifest.
>
> To populate with full OSS source content when internet access is restored:
> ```bash
> git clone https://github.com/CelaDaniel/react-polling.git /tmp/react-polling
> cd /tmp/react-polling
> git remote add cnz https://github.com/OmniQuestMediaInc/ChatNowZone--BUILD
> git push cnz HEAD:refs/oss/live-polling
> ```
>
> To update if the branch already exists as a manifest stub:
> ```bash
> git fetch https://github.com/CelaDaniel/react-polling.git HEAD
> git push origin FETCH_HEAD:refs/oss/live-polling --force-with-lease
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
