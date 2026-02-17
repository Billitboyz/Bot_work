#!/usr/bin/env bash
set -euo pipefail

ROOT="${ROOT:-/home/deploy/.openclaw/workspace}"
SCRIPT_DIR="$ROOT/memory-optimisation/scripts"
LOCK_DIR="$ROOT/.openclaw/locks"
LOCK_FILE="$LOCK_DIR/memory-maintenance.lock"
LOCK_META="$LOCK_DIR/memory-maintenance.meta"

STEP_TIMEOUT_SECONDS="${STEP_TIMEOUT_SECONDS:-180}"
OVERALL_TIMEOUT_SECONDS="${OVERALL_TIMEOUT_SECONDS:-420}"

mkdir -p "$LOCK_DIR"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "memory-maintenance: skipped (lock held)"
  if [ -f "$LOCK_META" ]; then
    echo "lock-meta: $(cat "$LOCK_META")"
  fi
  exit 0
fi

{
  echo "pid=$$"
  echo "started_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "host=$(hostname)"
} > "$LOCK_META"

cleanup() {
  rm -f "$LOCK_META" 2>/dev/null || true
}
trap cleanup EXIT

started_epoch="$(date +%s)"

check_overall_timeout() {
  local now elapsed
  now="$(date +%s)"
  elapsed=$((now - started_epoch))
  if [ "$elapsed" -gt "$OVERALL_TIMEOUT_SECONDS" ]; then
    echo "memory-maintenance: aborted (overall timeout ${OVERALL_TIMEOUT_SECONDS}s exceeded)"
    exit 124
  fi
}

run_step() {
  local name="$1"; shift
  check_overall_timeout
  echo "[memory-maintenance] $name"
  if timeout -k 10 "$STEP_TIMEOUT_SECONDS" "$@"; then
    return 0
  fi

  local rc=$?
  if [ "$rc" -eq 124 ]; then
    echo "[memory-maintenance] $name timed out after ${STEP_TIMEOUT_SECONDS}s"
  else
    echo "[memory-maintenance] $name failed (exit=$rc)"
  fi
  return "$rc"
}

run_step "health" bash "$SCRIPT_DIR/memory-health.sh"
run_step "dump" bash "$SCRIPT_DIR/memory-dump.sh"
run_step "retention" bash "$SCRIPT_DIR/memory-retention.sh"

echo "memory-maintenance: complete"
