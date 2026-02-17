#!/usr/bin/env bash
set -euo pipefail

INTERVAL="${1:-20}"
cd /home/deploy/.openclaw/workspace/mission-control

while true; do
  node ./sync-live-data.mjs || true
  sleep "$INTERVAL"
done
