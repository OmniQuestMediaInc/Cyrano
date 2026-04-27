#!/usr/bin/env bash
#
# scripts/verify-gov-gate.sh
#
# Verify that a GOV gate has a valid, CEO-acknowledged clearance record
# in PROGRAM_CONTROL/CLEARANCES/. Intended to be run from the repo root
# (or anywhere — it resolves paths relative to the script location)
# before any directive whose GATE: line names the gate.
#
# Usage:
#   ./scripts/verify-gov-gate.sh <GATE_ID>
#
# Example:
#   ./scripts/verify-gov-gate.sh GOV-FINTRAC
#   ./scripts/verify-gov-gate.sh GOV-AGCO
#
# Exit codes:
#   0 — gate is CLEARED (full legal clearance) or CEO_AUTHORIZED_STAGED
#         (staged CEO authorization), and CEO-acknowledged
#   1 — gate is NOT cleared, or no record exists, or record is malformed
#   2 — usage error
#
# Notes:
# - For gate-specific files (<GATE_ID>-YYYY-MM-DD.md), the verifier
#   accepts status: CLEARED (full clearance) as a valid exit-0.
# - If no gate-specific file exists, the verifier falls back to the
#   latest CEO-AUTHORIZED-STAGED-*.md file and accepts
#   status: CEO_AUTHORIZED_STAGED as a valid exit-0, provided the
#   requested gate appears in the gates_covered field.
# - Reads the latest (lexicographically greatest) clearance file for
#   the gate id. Filenames are <GATE_ID>-YYYY-MM-DD.md so lex order
#   == date order.
# - Parses only the YAML frontmatter between the first two '---' lines.
# - This script is read-only. It never writes or modifies clearance
#   records.
# - AI coding agents MUST NOT modify clearance records in order to
#   make this script pass. See PROGRAM_CONTROL/CLEARANCES/README.md.

set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <GATE_ID>" >&2
  echo "Example: $0 GOV-FINTRAC" >&2
  exit 2
fi

GATE_ID="$1"

# Resolve repo root relative to this script so it works from any cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CLEARANCE_DIR="${REPO_ROOT}/PROGRAM_CONTROL/CLEARANCES"

if [ ! -d "${CLEARANCE_DIR}" ]; then
  echo "FAIL — clearance directory not found: ${CLEARANCE_DIR}" >&2
  exit 1
fi

# Read a scalar field from the FRONTMATTER variable. Handles optional
# quotes and trailing '# comment'.
get_field() {
  local key="$1"
  printf '%s\n' "${FRONTMATTER}" | awk -v key="${key}" '
    {
      line = $0
      # Match "<key>:" with optional leading whitespace.
      if (match(line, "^[[:space:]]*" key ":")) {
        value = substr(line, RSTART + RLENGTH)
        # Strip leading whitespace.
        sub(/^[[:space:]]+/, "", value)
        # Strip trailing inline comment.
        sub(/[[:space:]]*#.*$/, "", value)
        # Strip trailing whitespace.
        sub(/[[:space:]]+$/, "", value)
        # Strip surrounding double quotes if present.
        if (value ~ /^".*"$/) {
          value = substr(value, 2, length(value) - 2)
        }
        print value
        exit
      }
    }
  '
}

# Helper: extract YAML frontmatter between the first two '---' lines.
extract_frontmatter() {
  local file="$1"
  awk '
    /^---[[:space:]]*$/ { count++; next }
    count == 1         { print }
    count >= 2         { exit }
  ' "${file}"
}

# Collect candidate clearance files for this gate id.
shopt -s nullglob
CANDIDATES=("${CLEARANCE_DIR}/${GATE_ID}"-*.md)
shopt -u nullglob

if [ "${#CANDIDATES[@]}" -eq 0 ]; then
  # Fallback: check for a CEO-AUTHORIZED-STAGED record that covers this gate.
  shopt -s nullglob
  STAGED_CANDIDATES=("${CLEARANCE_DIR}/CEO-AUTHORIZED-STAGED"-*.md)
  shopt -u nullglob

  if [ "${#STAGED_CANDIDATES[@]}" -eq 0 ]; then
    echo "FAIL — no clearance record for ${GATE_ID}" >&2
    echo "       expected: ${CLEARANCE_DIR}/${GATE_ID}-YYYY-MM-DD.md" >&2
    echo "       see PROGRAM_CONTROL/CLEARANCES/README.md for the signing contract" >&2
    exit 1
  fi

  STAGED_LATEST="$(printf '%s\n' "${STAGED_CANDIDATES[@]}" | LC_ALL=C sort | tail -n 1)"
  FRONTMATTER="$(extract_frontmatter "${STAGED_LATEST}")"

  if [ -z "${FRONTMATTER}" ]; then
    echo "FAIL — ${STAGED_LATEST}: missing or empty YAML frontmatter" >&2
    exit 1
  fi

  STAGED_STATUS="$(get_field status)"
  STAGED_ACK="$(get_field ceo_acknowledgment)"
  STAGED_GATES="$(get_field gates_covered)"

  if ! printf '%s\n' "${STAGED_GATES}" | grep -qw "${GATE_ID}"; then
    echo "FAIL — no clearance record for ${GATE_ID}" >&2
    echo "       latest staged authorization does not cover ${GATE_ID}" >&2
    exit 1
  fi

  if [ "${STAGED_STATUS}" != "CLEARED" ] && [ "${STAGED_STATUS}" != "CEO_AUTHORIZED_STAGED" ]; then
    echo "FAIL — staged authorization status is '${STAGED_STATUS}', expected 'CLEARED' or 'CEO_AUTHORIZED_STAGED'" >&2
    exit 1
  fi

  if [ "${STAGED_ACK}" != "SIGNED" ]; then
    echo "FAIL — staged authorization ceo_acknowledgment is '${STAGED_ACK}', expected 'SIGNED'" >&2
    exit 1
  fi

  STAGED_REL="${STAGED_LATEST#${REPO_ROOT}/}"
  echo "PASS — ${GATE_ID} authorized (CEO-AUTHORIZED-STAGED) — evidence: ${STAGED_REL}"
  exit 0
fi

# Pick the lexicographically latest record.
LATEST="$(printf '%s\n' "${CANDIDATES[@]}" | LC_ALL=C sort | tail -n 1)"

# Extract YAML frontmatter between the first two '---' lines.
FRONTMATTER="$(extract_frontmatter "${LATEST}")"

if [ -z "${FRONTMATTER}" ]; then
  echo "FAIL — ${LATEST}: missing or empty YAML frontmatter" >&2
  exit 1
fi

# Read a scalar field from the frontmatter. Handles optional quotes
# and trailing '# comment'.
FILE_GATE_ID="$(get_field gate_id)"
STATUS="$(get_field status)"
ACK="$(get_field ceo_acknowledgment)"

REL_PATH="${LATEST#${REPO_ROOT}/}"

if [ "${FILE_GATE_ID}" != "${GATE_ID}" ]; then
  echo "FAIL — ${REL_PATH}: gate_id is '${FILE_GATE_ID}', expected '${GATE_ID}'" >&2
  exit 1
fi

if [ "${STATUS}" != "CLEARED" ] && [ "${STATUS}" != "CEO_AUTHORIZED_STAGED" ]; then
  echo "FAIL — ${REL_PATH}: status is '${STATUS}', expected 'CLEARED' or 'CEO_AUTHORIZED_STAGED'" >&2
  exit 1
fi

if [ "${ACK}" != "SIGNED" ]; then
  echo "FAIL — ${REL_PATH}: ceo_acknowledgment is '${ACK}', expected 'SIGNED'" >&2
  exit 1
fi

echo "PASS — ${GATE_ID} cleared — evidence: ${REL_PATH}"
exit 0
