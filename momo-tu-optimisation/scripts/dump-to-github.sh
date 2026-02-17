#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/deploy/.openclaw/workspace"
cd "$ROOT"

TS="$(date -u +%Y%m%d-%H%M%S)"
DUMP_DIR="$ROOT/ops-dumps/$TS"
mkdir -p "$DUMP_DIR"

# Collect key operational files
cp -f "$ROOT/MEMORY.md" "$DUMP_DIR/MEMORY.md" 2>/dev/null || true
cp -f "$ROOT/HEARTBEAT.md" "$DUMP_DIR/HEARTBEAT.md" 2>/dev/null || true
cp -f "$ROOT/mission-control/live-data.json" "$DUMP_DIR/live-data.json" 2>/dev/null || true

if [ -d "$ROOT/memory" ]; then
  mkdir -p "$DUMP_DIR/memory"
  find "$ROOT/memory" -maxdepth 1 -type f -name "*.md" -print0 | xargs -0 -I{} cp -f "{}" "$DUMP_DIR/memory/" 2>/dev/null || true
fi

# Operational snapshots
openclaw sessions --json > "$DUMP_DIR/sessions.json" 2>/dev/null || echo '{}' > "$DUMP_DIR/sessions.json"
openclaw status > "$DUMP_DIR/status.txt" 2>/dev/null || true

# Keep repo tidy: retain latest 30 dumps
if [ -d "$ROOT/ops-dumps" ]; then
  ls -1dt "$ROOT"/ops-dumps/* 2>/dev/null | tail -n +31 | xargs -r rm -rf
fi

# Commit & push if changed
if ! git diff --quiet -- ops-dumps; then
  git add ops-dumps
  git commit -m "ops: momo-tu dump $TS"
  git push
  echo "Pushed dump: $TS"
else
  echo "No dump changes to commit."
fi
