# Memory Optimisation Project

Priority project to reduce crash/timeout risk from memory growth and keep memory/log state healthy over time.

## Objectives

1. Keep memory context lean (size checks + retention)
2. Create timestamped GitHub dumps for audit/recovery
3. Add safe maintenance runner with lock + timeout guards
4. Avoid heavy operations overlapping

## Included scripts

- `scripts/memory-health.sh`
  - Reports file sizes/counts for `MEMORY.md`, `memory/*.md`, and session artifacts.
- `scripts/memory-dump.sh`
  - Creates timestamped snapshot in `memory-dumps/<timestamp>/`.
  - Captures memory files + OpenClaw status/sessions summary.
  - Commits + pushes dump updates.
- `scripts/memory-maintenance.sh`
  - Single entrypoint with:
    - lockfile (prevents concurrent runs)
    - timeout guard
    - retention policy for dump folders

## Run

```bash
cd /home/deploy/.openclaw/workspace/memory-optimisation
bash scripts/memory-maintenance.sh
```

## Suggested cadence

- Every 30-60 minutes during active periods
- Daily when idle

## Notes

- Dumps are operational snapshots, not full backups.
- Memory search API quota issues are handled by preserving local markdown memory snapshots for continuity.
