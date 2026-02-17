#!/usr/bin/env bash
set -euo pipefail

TS="$(date -u +%Y%m%d-%H%M%S)"
OUT_DIR="/home/deploy/.openclaw/workspace/ops-dumps/${TS}"
mkdir -p "$OUT_DIR"

{
  echo "timestamp_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "host=$(hostname)"
  echo "uptime=$(uptime -p || true)"
} > "$OUT_DIR/meta.env"

{
  echo "# free -h"
  free -h || true
  echo
  echo "# df -h"
  df -h || true
  echo
  echo "# top snapshot"
  top -b -n 1 | head -n 30 || true
} > "$OUT_DIR/system-health.txt"

{
  echo "# openclaw status"
  openclaw status || true
  echo
  echo "# openclaw sessions --json"
  openclaw sessions --json || true
} > "$OUT_DIR/openclaw-health.txt"

echo "$OUT_DIR"
