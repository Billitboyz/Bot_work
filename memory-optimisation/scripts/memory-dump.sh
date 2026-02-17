#!/usr/bin/env bash
set -euo pipefail

ROOT="${ROOT:-/home/deploy/.openclaw/workspace}"
DUMPS_DIR="$ROOT/memory-dumps"
TS="$(date -u +%Y%m%d-%H%M%S)"
DUMP_DIR="$DUMPS_DIR/$TS"
TMP_DIR="$DUMPS_DIR/.tmp-$TS-$$"

# Tuning knobs (override via env)
MAX_DAILY_FILES="${MAX_DAILY_FILES:-30}"
MAX_DAILY_FILE_BYTES="${MAX_DAILY_FILE_BYTES:-524288}"   # 512 KiB per note
CMD_TIMEOUT_SECONDS="${CMD_TIMEOUT_SECONDS:-20}"
AUTO_COMMIT="${AUTO_COMMIT:-0}"
AUTO_PUSH="${AUTO_PUSH:-0}"

mkdir -p "$TMP_DIR"
mkdir -p "$DUMPS_DIR"

cleanup_tmp() {
  rm -rf "$TMP_DIR" 2>/dev/null || true
}
trap cleanup_tmp EXIT

copy_if_exists() {
  local src="$1"
  local dst="$2"
  if [ -f "$src" ]; then
    cp -f "$src" "$dst"
  fi
}

run_with_timeout() {
  local out_file="$1"
  shift
  if timeout -k 5 "$CMD_TIMEOUT_SECONDS" "$@" >"$out_file" 2>/dev/null; then
    return 0
  fi

  local rc=$?
  if [ "$rc" -eq 124 ]; then
    echo "command timed out after ${CMD_TIMEOUT_SECONDS}s: $*" >"$out_file"
  else
    echo "command failed (exit=$rc): $*" >"$out_file"
  fi
  return 0
}

# Core memory docs
copy_if_exists "$ROOT/MEMORY.md" "$TMP_DIR/MEMORY.md"
copy_if_exists "$ROOT/HEARTBEAT.md" "$TMP_DIR/HEARTBEAT.md"
copy_if_exists "$ROOT/USER.md" "$TMP_DIR/USER.md"
copy_if_exists "$ROOT/AGENTS.md" "$TMP_DIR/AGENTS.md"

# Daily memory notes (safely filtered)
if [ -d "$ROOT/memory" ]; then
  mkdir -p "$TMP_DIR/memory"
  mapfile -d '' memory_files < <(find "$ROOT/memory" -maxdepth 1 -type f -name "*.md" -size -"${MAX_DAILY_FILE_BYTES}"c -print0 | sort -z)
  copied=0
  for file in "${memory_files[@]}"; do
    cp -f "$file" "$TMP_DIR/memory/"
    copied=$((copied + 1))
    if [ "$copied" -ge "$MAX_DAILY_FILES" ]; then
      break
    fi
  done
fi

# Runtime snapshots with bounded execution
run_with_timeout "$TMP_DIR/sessions.json" openclaw sessions --json
run_with_timeout "$TMP_DIR/status.txt" openclaw status

# Metadata for runbook/debug
{
  echo "timestamp_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "host=$(hostname)"
  echo "dump_id=$TS"
  echo "max_daily_files=$MAX_DAILY_FILES"
  echo "max_daily_file_bytes=$MAX_DAILY_FILE_BYTES"
  echo "cmd_timeout_seconds=$CMD_TIMEOUT_SECONDS"
} >"$TMP_DIR/meta.env"

# Atomic publish
mv "$TMP_DIR" "$DUMP_DIR"
trap - EXIT

if [ "$AUTO_COMMIT" = "1" ]; then
  if ! git -C "$ROOT" diff --quiet -- "$DUMPS_DIR"; then
    git -C "$ROOT" add memory-dumps
    git -C "$ROOT" commit -m "memory: automated dump $TS"
    if [ "$AUTO_PUSH" = "1" ]; then
      git -C "$ROOT" push
      echo "Committed + pushed memory dump: $TS"
    else
      echo "Committed memory dump (push disabled): $TS"
    fi
  else
    echo "No memory-dump changes to commit."
  fi
else
  echo "Created memory dump: $DUMP_DIR"
fi
