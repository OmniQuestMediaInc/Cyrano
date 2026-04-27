# Reference Branch Policy
Authority: Kevin B. Hartley, CEO — OmniQuest Media Inc.
Date: 2026-04-18

## What Are Reference Branches?

All branches prefixed with `refs/` are PERMANENT READ-ONLY REFERENCE
LIBRARIES. They contain cloned open-source repositories and OQMInc
reference materials used by Claude Code and Copilot when authoring
directives. They are never deleted and never merged to main.

## Absolute Rules

- refs/* branches NEVER merge to main under any circumstances
- refs/* branches are never deleted
- refs/* content is never imported into CNZ source files
- No package.json, tsconfig, or build config may reference refs/* content

## How Agents Read Reference Branch Files

  git show refs/oss/{branch-name}:{filepath}

Examples:
  git show refs/oss/booking-api:prisma/schema.prisma
  git show refs/oss/socketio-chat:app.js
  git show refs/oss/discussion-platform:hooks/useCommunityData.tsx

## How to Reference These in Directives

Add to directive CONTEXT section:
  REFERENCE: git show refs/oss/{name}:{filepath}

## Protected Reference Branches

| Branch | Source | Purpose |
|--------|--------|---------|
| refs/oss/booking-api | CelaDaniel/Full-Stack-Booking-Management-API | CCZ-004, DISC-001 |
| refs/oss/socketio-chat | CelaDaniel/nodejs-socketio-chat-application | OBS-001, CCZ-001 |
| refs/oss/react-chat-app | CelaDaniel/React-Chat-App | CCZ-001/002 |
| refs/oss/discussion-platform | CelaDaniel/next_discussion_platform | FC-001–006, OPS-004 |
| refs/oss/live-polling | CelaDaniel/react-polling | OBS Flicker n'Flame Scoring (FFS) |
| refs/oss/zoom-clone | CelaDaniel/zoom-clone | OBS Theatre UI |
| refs/oss/loadbalancer-nginx | CelaDaniel/loadbalancer-nginx-docker-nodejs | Bijou SFU infra |
| refs/oss/social-media-app | CelaDaniel/Social-media-react-app | FC-003, CCZ-003 |
| refs/oqminc/ai-resources | CelaDaniel/free-ai-resources-x | OBS-005, HZ, NN |
