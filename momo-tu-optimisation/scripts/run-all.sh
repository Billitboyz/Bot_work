#!/usr/bin/env bash
set -euo pipefail

BASE="/home/deploy/.openclaw/workspace/momo-tu-optimisation/scripts"

bash "$BASE/collect-health.sh"
bash "$BASE/dump-to-github.sh"

echo "MoMo-TU optimisation run complete."
