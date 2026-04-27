# OSS Reference Branch Seeds

**Directive:** THREAD15-OSS-HARVEST
**Authority:** Kevin B. Hartley, CEO — OmniQuest Media Inc.
**Date:** 2026-04-19

---

## What Is This?

This directory contains the seed content for 9 permanent orphan reference
branches (`refs/oss/*` and `refs/oqminc/*`) defined in
`REFERENCE_LIBRARY/05_OSS_REPO_REGISTRY.md`.

Each subdirectory contains the `REFS_MANIFEST.md` that will be placed at
the root of its corresponding orphan branch.

---

## Branches

| Subdirectory | Target Ref |
|---|---|
| `refs-oss-booking-api/` | `refs/oss/booking-api` |
| `refs-oss-socketio-chat/` | `refs/oss/socketio-chat` |
| `refs-oss-react-chat-app/` | `refs/oss/react-chat-app` |
| `refs-oss-discussion-platform/` | `refs/oss/discussion-platform` |
| `refs-oss-live-polling/` | `refs/oss/live-polling` |
| `refs-oss-zoom-clone/` | `refs/oss/zoom-clone` |
| `refs-oss-loadbalancer-nginx/` | `refs/oss/loadbalancer-nginx` |
| `refs-oss-social-media-app/` | `refs/oss/social-media-app` |
| `refs-oqminc-ai-resources/` | `refs/oqminc/ai-resources` |

---

## To Create the Branches

Run:
```bash
chmod +x PUSH_ALL_REFS.sh
./PUSH_ALL_REFS.sh
```

Or trigger the GitHub Actions workflow:
`.github/workflows/harvest-oss-refs.yml`

---

## Why These Are Stubs

During Thread 15 (2026-04-19), the sandbox runner had a MITM GoProxy at
`127.0.0.1` that blocked all outbound `git push` operations to github.com.
The `report_progress` tool (which uses the Copilot callback API server-side)
is the only push channel available. It is scoped to the PR branch only.

The orphan branch commits were prepared and exist as objects in the local
repo. They could not be pushed to `refs/oss/*` in this session.

---

*END README*
