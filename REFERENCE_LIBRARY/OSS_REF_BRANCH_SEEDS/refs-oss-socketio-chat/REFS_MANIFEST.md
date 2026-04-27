# REFS MANIFEST

**Branch:** `refs/oss/socketio-chat`
**Source Repository:** `CelaDaniel/nodejs-socketio-chat-application`
**Source URL:** https://github.com/CelaDaniel/nodejs-socketio-chat-application
**Primary Directive Series:** OBS-001/002, CCZ-001, OPS-003
**Harvest Date:** 2026-04-19
**Harvest Agent:** Copilot (THREAD15-OSS-HARVEST)
**Harvest Status:** MANIFEST-STUB (OSS source content pending internet access)

---

## PURPOSE

Permanent read-only reference branch for OmniQuest Media Inc. ChatNow.Zone
build. Contains open-source reference material from `CelaDaniel/nodejs-socketio-chat-application`
for use by agents when authoring directives.

Node.js Socket.IO chat application. Real-time event patterns referenced by OBS broadcast kernel (OBS-001/002), CCZ-001 real-time chat, and OPS-003 infrastructure.

## HOW TO USE

Read a file from this branch:
```
git show refs/oss/socketio-chat:<filepath>
```

Example:
```
git show refs/oss/socketio-chat:README.md
```

## CONTENT STATUS

> **STUB** — GitHub was inaccessible (MITM proxy at 127.0.0.1 blocked outbound
> git push) during Thread 15 harvest on 2026-04-19.
> This branch contains only this manifest.
>
> To populate with full OSS source content when internet access is restored:
> ```bash
> git clone https://github.com/CelaDaniel/nodejs-socketio-chat-application.git /tmp/nodejs-socketio-chat-application
> cd /tmp/nodejs-socketio-chat-application
> git remote add cnz https://github.com/OmniQuestMediaInc/ChatNowZone--BUILD
> git push cnz HEAD:refs/oss/socketio-chat
> ```
>
> To update if the branch already exists as a manifest stub:
> ```bash
> git fetch https://github.com/CelaDaniel/nodejs-socketio-chat-application.git HEAD
> git push origin FETCH_HEAD:refs/oss/socketio-chat --force-with-lease
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
