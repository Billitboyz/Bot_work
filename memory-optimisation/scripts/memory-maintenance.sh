#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/deploy/.openclaw/workspace"
SCRIPT_DIR="$ROOT/memory-optimisation/scripts"
LOCK_DIR="$ROOT/.openclaw/locks"
LOCK_FILE="$LOCK_DIR/memory-maintenance.lock"
MAX_SECONDS="${MAX_SECONDS:-180}"

mkdir -p "$LOCK_DIR"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "memory-maintenance: skipped (lock held)"
  exit 0
fi

run_step() {
  local name="$1"; shift
  echo "[memory-maintenance] $name"
  timeout "$MAX_SECONDS" "$@"
}

run_step "health" bash "$SCRIPT_DIR/memory-health.sh"
run_step "dump" bash "$SCRIPT_DIR/memory-dump.sh"

echo "memory-maintenance: complete"
