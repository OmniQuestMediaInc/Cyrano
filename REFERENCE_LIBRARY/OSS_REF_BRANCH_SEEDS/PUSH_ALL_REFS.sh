#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# PUSH_ALL_REFS.sh
# THREAD15-OSS-HARVEST — Create 9 orphan reference branches
# Authority: Kevin B. Hartley, CEO — OmniQuest Media Inc.
#
# USAGE:
#   chmod +x PUSH_ALL_REFS.sh
#   ./PUSH_ALL_REFS.sh
#
# REQUIREMENTS:
#   - Must be run with GitHub credentials that have `contents: write` access
#   - Run from the root of the ChatNowZone--BUILD repository checkout
#   - Internet access to github.com (to clone source repos if seeding with content)
#
# WHAT THIS SCRIPT DOES:
#   1. For each of the 9 OSS repos listed in 05_OSS_REPO_REGISTRY.md:
#      a. Creates an orphan branch (no parent commits, no connection to main)
#      b. Seeds it with the REFS_MANIFEST.md from this staging directory
#      c. Pushes it to the remote as refs/oss/<name> or refs/oqminc/<name>
#   2. Optionally seeds each branch with the full OSS source content
#      if SOURCE_CONTENT=1 is set.
#
# NOTES:
#   - These branches NEVER merge to main (CI enforced by protect-ref-branches.yml)
#   - These branches are NEVER deleted
#   - This script was prepared during Thread 15 when the sandbox environment
#     had a MITM proxy blocking outbound git push operations
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

REMOTE="${REMOTE:-origin}"
SEED_DIR="$(cd "$(dirname "$0")" && pwd)"
HARVEST_DATE="2026-04-19"
SOURCE_CONTENT="${SOURCE_CONTENT:-0}"

echo "=== THREAD15-OSS-HARVEST: Push All Ref Branches ==="
echo "Remote: $REMOTE"
echo "Seed dir: $SEED_DIR"
echo ""

push_ref() {
  local BRANCH_REF="$1"       # e.g. refs/oss/booking-api
  local SOURCE_REPO="$2"      # e.g. CelaDaniel/Full-Stack-Booking-Management-API
  local SEED_SUBDIR="$3"      # e.g. refs-oss-booking-api
  local COMMIT_MSG="$4"

  echo "─── $BRANCH_REF ──────────────────────────────────"

  # Check if ref already exists on remote
  if git ls-remote --exit-code "$REMOTE" "$BRANCH_REF" >/dev/null 2>&1; then
    echo "  ⚠  Already exists on remote — skipping (use --force-with-lease to overwrite)"
    return 0
  fi

  local WORK_DIR
  WORK_DIR=$(mktemp -d)
  trap "rm -rf '$WORK_DIR'" RETURN

  cd "$WORK_DIR"
  git init -q
  git remote add origin "$(git -C "$OLDPWD" remote get-url "$REMOTE")"

  # If SOURCE_CONTENT=1, try to clone the source repo
  if [ "$SOURCE_CONTENT" = "1" ]; then
    echo "  Cloning https://github.com/$SOURCE_REPO ..."
    if git clone --depth=1 "https://github.com/$SOURCE_REPO.git" src_clone 2>/dev/null; then
      git checkout --orphan main
      # Copy source content (exclude .git)
      cp -r src_clone/. .
      rm -rf src_clone .git/refs/heads/main
      # Copy the manifest from seed dir
      cp "$SEED_DIR/$SEED_SUBDIR/REFS_MANIFEST.md" ./REFS_MANIFEST.md
    else
      echo "  ⚠  Clone failed — creating manifest-stub branch"
      git checkout --orphan main
      cp "$SEED_DIR/$SEED_SUBDIR/REFS_MANIFEST.md" ./REFS_MANIFEST.md
    fi
  else
    git checkout --orphan main
    cp "$SEED_DIR/$SEED_SUBDIR/REFS_MANIFEST.md" ./REFS_MANIFEST.md
  fi

  git config user.email "copilot@omniquestmedia.com"
  git config user.name "Copilot Agent"
  git add REFS_MANIFEST.md
  git commit -q -m "$COMMIT_MSG"

  local COMMIT_HASH
  COMMIT_HASH=$(git rev-parse HEAD)

  echo "  Commit: $COMMIT_HASH"
  git push origin "HEAD:$BRANCH_REF"
  echo "  ✅ Pushed $BRANCH_REF"

  cd "$OLDPWD"
}

push_ref \
  "refs/oss/booking-api" \
  "CelaDaniel/Full-Stack-Booking-Management-API" \
  "refs-oss-booking-api" \
  "CHORE: refs/oss/booking-api — harvest CelaDaniel/Full-Stack-Booking-Management-API"

push_ref \
  "refs/oss/socketio-chat" \
  "CelaDaniel/nodejs-socketio-chat-application" \
  "refs-oss-socketio-chat" \
  "CHORE: refs/oss/socketio-chat — harvest CelaDaniel/nodejs-socketio-chat-application"

push_ref \
  "refs/oss/react-chat-app" \
  "CelaDaniel/React-Chat-App" \
  "refs-oss-react-chat-app" \
  "CHORE: refs/oss/react-chat-app — harvest CelaDaniel/React-Chat-App"

push_ref \
  "refs/oss/discussion-platform" \
  "CelaDaniel/next_discussion_platform" \
  "refs-oss-discussion-platform" \
  "CHORE: refs/oss/discussion-platform — harvest CelaDaniel/next_discussion_platform"

push_ref \
  "refs/oss/live-polling" \
  "CelaDaniel/react-polling" \
  "refs-oss-live-polling" \
  "CHORE: refs/oss/live-polling — harvest CelaDaniel/react-polling"

push_ref \
  "refs/oss/zoom-clone" \
  "CelaDaniel/zoom-clone" \
  "refs-oss-zoom-clone" \
  "CHORE: refs/oss/zoom-clone — harvest CelaDaniel/zoom-clone"

push_ref \
  "refs/oss/loadbalancer-nginx" \
  "CelaDaniel/loadbalancer-nginx-docker-nodejs" \
  "refs-oss-loadbalancer-nginx" \
  "CHORE: refs/oss/loadbalancer-nginx — harvest CelaDaniel/loadbalancer-nginx-docker-nodejs"

push_ref \
  "refs/oss/social-media-app" \
  "CelaDaniel/Social-media-react-app" \
  "refs-oss-social-media-app" \
  "CHORE: refs/oss/social-media-app — harvest CelaDaniel/Social-media-react-app"

push_ref \
  "refs/oqminc/ai-resources" \
  "CelaDaniel/free-ai-resources-x" \
  "refs-oqminc-ai-resources" \
  "CHORE: refs/oqminc/ai-resources — harvest CelaDaniel/free-ai-resources-x"

echo ""
echo "=== COMPLETE ==="
echo "Verify with: git ls-remote origin 'refs/oss/*' 'refs/oqminc/*'"
