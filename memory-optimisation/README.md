# Memory Optimisation Project

Priority project to reduce crash/timeout risk from memory growth and keep memory/log state healthy over time.

## Objectives

1. Keep memory context lean (size checks + retention)
2. Create timestamped dumps for audit/recovery
3. Add safe maintenance runner with lock + timeout guards
4. Avoid heavy operations overlapping

## Included scripts

- `scripts/memory-health.sh`
  - Reports file sizes/counts for `MEMORY.md`, `memory/*.md`, dump inventory, disk/memory pressure.
  - Writes `meta.env` and `memory-health.txt` to a timestamped output dir.
- `scripts/memory-dump.sh`
  - Creates timestamped snapshot in `memory-dumps/<timestamp>/`.
  - Captures core context files + filtered daily memory notes.
  - Runtime snapshot commands are time-bounded to avoid hanging runs.
  - Optional commit/push via env flags (`AUTO_COMMIT=1`, `AUTO_PUSH=1`).
- `scripts/memory-retention.sh`
  - Retention policy with safety checks:
    - keep newest `KEEP_LATEST` dumps (default 50)
    - remove dumps older than `MAX_AGE_DAYS` (default 30)
  - Supports `DRY_RUN=1` to preview deletions.
- `scripts/memory-maintenance.sh`
  - Single entrypoint with:
    - lockfile via `flock` (prevents concurrent runs)
    - lock metadata for troubleshooting
    - per-step timeout + overall time budget guards
    - health + dump + retention sequence

## Run

```bash
cd /home/deploy/.openclaw/workspace/memory-optimisation
bash scripts/memory-maintenance.sh
```

## Suggested cadence

- Every 30-60 minutes during active periods
- Daily when idle

## Runtime tuning examples

```bash
# Tighten budgets and retention
STEP_TIMEOUT_SECONDS=120 OVERALL_TIMEOUT_SECONDS=300 KEEP_LATEST=30 MAX_AGE_DAYS=14 \
  bash scripts/memory-maintenance.sh

# Retention dry run
DRY_RUN=1 KEEP_LATEST=20 MAX_AGE_DAYS=7 bash scripts/memory-retention.sh

# Create dump and auto-commit (without push)
AUTO_COMMIT=1 bash scripts/memory-dump.sh
```

## Practical runbook notes

- If maintenance says `lock held`, check lock owner in `.openclaw/locks/memory-maintenance.meta`.
- If any `openclaw ...` command hangs, dump/health now fail fast with timeout markers instead of blocking indefinitely.
- If dump volume grows too fast, lower `KEEP_LATEST` and/or `MAX_AGE_DAYS`.
- If memory notes are huge, dump filtering skips oversized markdown files (`MAX_DAILY_FILE_BYTES`).

## Notes

- Dumps are operational snapshots, not full backups.
- Prefer dry-run retention checks before major policy changes.
