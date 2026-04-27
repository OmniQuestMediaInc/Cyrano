# REFS MANIFEST

**Branch:** `refs/oss/discussion-platform`
**Source Repository:** `CelaDaniel/next_discussion_platform`
**Source URL:** https://github.com/CelaDaniel/next_discussion_platform
**Primary Directive Series:** FC-001–006, OPS-004
**Harvest Date:** 2026-04-19
**Harvest Agent:** Copilot (THREAD15-OSS-HARVEST)
**Harvest Status:** MANIFEST-STUB (OSS source content pending internet access)

---

## PURPOSE

Permanent read-only reference branch for OmniQuest Media Inc. ChatNow.Zone
build. Contains open-source reference material from `CelaDaniel/next_discussion_platform`
for use by agents when authoring directives.

Next.js discussion/community platform. Data hooks, community schemas, and post/reply patterns for the full FC (Forum/Community) directive series (FC-001 through FC-006) and OPS-004.

## HOW TO USE

Read a file from this branch:
```
git show refs/oss/discussion-platform:<filepath>
```

Example:
```
git show refs/oss/discussion-platform:README.md
```

## CONTENT STATUS

> **STUB** — GitHub was inaccessible (MITM proxy at 127.0.0.1 blocked outbound
> git push) during Thread 15 harvest on 2026-04-19.
> This branch contains only this manifest.
>
> To populate with full OSS source content when internet access is restored:
> ```bash
> git clone https://github.com/CelaDaniel/next_discussion_platform.git /tmp/next_discussion_platform
> cd /tmp/next_discussion_platform
> git remote add cnz https://github.com/OmniQuestMediaInc/ChatNowZone--BUILD
> git push cnz HEAD:refs/oss/discussion-platform
> ```
>
> To update if the branch already exists as a manifest stub:
> ```bash
> git fetch https://github.com/CelaDaniel/next_discussion_platform.git HEAD
> git push origin FETCH_HEAD:refs/oss/discussion-platform --force-with-lease
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
