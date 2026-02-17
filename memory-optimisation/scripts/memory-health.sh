#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/deploy/.openclaw/workspace"
OUT_DIR="${1:-$ROOT/memory-dumps/$(date -u +%Y%m%d-%H%M%S)}"
mkdir -p "$OUT_DIR"

MEMORY_FILE="$ROOT/MEMORY.md"
MEMORY_DIR="$ROOT/memory"

{
  echo "timestamp_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "host=$(hostname)"
  echo "pwd=$ROOT"
} > "$OUT_DIR/meta.env"

{
  echo "## memory file stats"
  if [ -f "$MEMORY_FILE" ]; then
    wc -lc "$MEMORY_FILE"
  else
    echo "MEMORY.md missing"
  fi
  echo
  echo "## daily memory stats"
  if [ -d "$MEMORY_DIR" ]; then
    find "$MEMORY_DIR" -maxdepth 1 -type f -name "*.md" -print0 | xargs -0 wc -lc 2>/dev/null || true
  else
    echo "memory/ missing"
  fi
  echo
  echo "## disk/mem"
  free -h || true
  df -h || true
  echo
  echo "## openclaw status"
  openclaw status || true
} > "$OUT_DIR/memory-health.txt"

echo "$OUT_DIR"
