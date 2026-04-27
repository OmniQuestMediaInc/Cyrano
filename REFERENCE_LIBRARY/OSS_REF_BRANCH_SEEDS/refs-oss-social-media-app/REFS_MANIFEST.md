# REFS MANIFEST

**Branch:** `refs/oss/social-media-app`
**Source Repository:** `CelaDaniel/Social-media-react-app`
**Source URL:** https://github.com/CelaDaniel/Social-media-react-app
**Primary Directive Series:** FC-003, CCZ-003, OPS-006 notifications
**Harvest Date:** 2026-04-19
**Harvest Agent:** Copilot (THREAD15-OSS-HARVEST)
**Harvest Status:** MANIFEST-STUB (OSS source content pending internet access)

---

## PURPOSE

Permanent read-only reference branch for OmniQuest Media Inc. ChatNow.Zone
build. Contains open-source reference material from `CelaDaniel/Social-media-react-app`
for use by agents when authoring directives.

React social media application. Feed, notifications, follower graph, and content discovery patterns for FC-003 (social feeds), CCZ-003 (creator social layer), and OPS-006 (notification infrastructure).

## HOW TO USE

Read a file from this branch:
```
git show refs/oss/social-media-app:<filepath>
```

Example:
```
git show refs/oss/social-media-app:README.md
```

## CONTENT STATUS

> **STUB** — GitHub was inaccessible (MITM proxy at 127.0.0.1 blocked outbound
> git push) during Thread 15 harvest on 2026-04-19.
> This branch contains only this manifest.
>
> To populate with full OSS source content when internet access is restored:
> ```bash
> git clone https://github.com/CelaDaniel/Social-media-react-app.git /tmp/Social-media-react-app
> cd /tmp/Social-media-react-app
> git remote add cnz https://github.com/OmniQuestMediaInc/ChatNowZone--BUILD
> git push cnz HEAD:refs/oss/social-media-app
> ```
>
> To update if the branch already exists as a manifest stub:
> ```bash
> git fetch https://github.com/CelaDaniel/Social-media-react-app.git HEAD
> git push origin FETCH_HEAD:refs/oss/social-media-app --force-with-lease
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
