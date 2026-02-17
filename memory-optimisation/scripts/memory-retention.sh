#!/usr/bin/env bash
set -euo pipefail

ROOT="${ROOT:-/home/deploy/.openclaw/workspace}"
DUMPS_DIR="$ROOT/memory-dumps"

# Keep newest N dumps and optionally enforce max age.
KEEP_LATEST="${KEEP_LATEST:-50}"
MAX_AGE_DAYS="${MAX_AGE_DAYS:-30}"
DRY_RUN="${DRY_RUN:-0}"

[ -d "$DUMPS_DIR" ] || exit 0

# Safety: only operate inside expected dumps directory
DUMPS_REAL="$(realpath "$DUMPS_DIR")"
ROOT_REAL="$(realpath "$ROOT")"
case "$DUMPS_REAL" in
  "$ROOT_REAL"/memory-dumps) ;;
  *)
    echo "retention: refusing to operate on unexpected path: $DUMPS_REAL"
    exit 1
    ;;
esac

remove_path() {
  local p="$1"
  if [ "$DRY_RUN" = "1" ]; then
    echo "retention: would remove $p"
  else
    rm -rf -- "$p"
    echo "retention: removed $p"
  fi
}

# 1) Count-based retention: remove everything older than newest KEEP_LATEST dirs
mapfile -t dirs < <(find "$DUMPS_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -nr | awk '{print $2}')
idx=0
for d in "${dirs[@]}"; do
  idx=$((idx + 1))
  if [ "$idx" -le "$KEEP_LATEST" ]; then
    continue
  fi
  remove_path "$d"
done

# 2) Age-based retention
if [ "$MAX_AGE_DAYS" -gt 0 ]; then
  while IFS= read -r olddir; do
    [ -z "$olddir" ] && continue
    remove_path "$olddir"
  done < <(find "$DUMPS_DIR" -mindepth 1 -maxdepth 1 -type d -mtime +"$MAX_AGE_DAYS")
fi
