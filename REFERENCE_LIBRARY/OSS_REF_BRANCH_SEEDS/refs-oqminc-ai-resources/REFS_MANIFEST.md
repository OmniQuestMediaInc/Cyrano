# REFS MANIFEST

**Branch:** `refs/oqminc/ai-resources`
**Source Repository:** `CelaDaniel/free-ai-resources-x`
**Source URL:** https://github.com/CelaDaniel/free-ai-resources-x
**Primary Directive Series:** OBS-005, HZ, NN-001/002, DFSP
**Harvest Date:** 2026-04-19
**Harvest Agent:** Copilot (THREAD15-OSS-HARVEST)
**Harvest Status:** MANIFEST-STUB (OSS source content pending internet access)

---

## PURPOSE

Permanent read-only reference branch for OmniQuest Media Inc. ChatNow.Zone
build. Contains open-source reference material from `CelaDaniel/free-ai-resources-x`
for use by agents when authoring directives.

Curated free AI/ML resources reference collection. Used by OBS-005 (AI broadcast features), HeartZone (HZ) biometric AI, neural-net directives (NN-001/002), and DFSP (AI-assisted financial guidance). See also: REFERENCE_LIBRARY/04_AI_REFERENCE_INDEX.md

## HOW TO USE

Read a file from this branch:
```
git show refs/oqminc/ai-resources:<filepath>
```

Example:
```
git show refs/oqminc/ai-resources:README.md
```

## CONTENT STATUS

> **STUB** — GitHub was inaccessible (MITM proxy at 127.0.0.1 blocked outbound
> git push) during Thread 15 harvest on 2026-04-19.
> This branch contains only this manifest.
>
> To populate with full OSS source content when internet access is restored:
> ```bash
> git clone https://github.com/CelaDaniel/free-ai-resources-x.git /tmp/free-ai-resources-x
> cd /tmp/free-ai-resources-x
> git remote add cnz https://github.com/OmniQuestMediaInc/ChatNowZone--BUILD
> git push cnz HEAD:refs/oqminc/ai-resources
> ```
>
> To update if the branch already exists as a manifest stub:
> ```bash
> git fetch https://github.com/CelaDaniel/free-ai-resources-x.git HEAD
> git push origin FETCH_HEAD:refs/oqminc/ai-resources --force-with-lease
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
