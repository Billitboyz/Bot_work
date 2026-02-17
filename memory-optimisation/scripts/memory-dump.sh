#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/deploy/.openclaw/workspace"
cd "$ROOT"

TS="$(date -u +%Y%m%d-%H%M%S)"
DUMP_DIR="$ROOT/memory-dumps/$TS"
mkdir -p "$DUMP_DIR"

# Core memory docs
cp -f "$ROOT/MEMORY.md" "$DUMP_DIR/MEMORY.md" 2>/dev/null || true
cp -f "$ROOT/HEARTBEAT.md" "$DUMP_DIR/HEARTBEAT.md" 2>/dev/null || true
cp -f "$ROOT/USER.md" "$DUMP_DIR/USER.md" 2>/dev/null || true

# Daily memory notes
if [ -d "$ROOT/memory" ]; then
  mkdir -p "$DUMP_DIR/memory"
  find "$ROOT/memory" -maxdepth 1 -type f -name "*.md" -print0 | xargs -0 -I{} cp -f "{}" "$DUMP_DIR/memory/" 2>/dev/null || true
fi

# Runtime snapshots
openclaw sessions --json > "$DUMP_DIR/sessions.json" 2>/dev/null || echo '{}' > "$DUMP_DIR/sessions.json"
openclaw status > "$DUMP_DIR/status.txt" 2>/dev/null || true

# Keep dump retention bounded (latest 50)
if [ -d "$ROOT/memory-dumps" ]; then
  ls -1dt "$ROOT"/memory-dumps/* 2>/dev/null | tail -n +51 | xargs -r rm -rf
fi

if ! git diff --quiet -- memory-dumps; then
  git add memory-dumps
  git commit -m "memory: automated dump $TS"
  git push
  echo "Pushed memory dump: $TS"
else
  echo "No memory-dump changes to commit."
fi
