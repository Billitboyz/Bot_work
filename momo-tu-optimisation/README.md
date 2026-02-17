# MoMo-TU Optimisation Project

Goal: reduce crashes/timeouts and keep runtime state tidy with lightweight GitHub dumps.

## Scope (Phase 1)

1. Stability checks (CPU/RAM/disk/session pressure)
2. Snapshot dump pipeline for key operational files
3. Git-backed retention for clean history
4. Repeatable runner scripts

## What this ships now

- `scripts/collect-health.sh` — quick health snapshot
- `scripts/dump-to-github.sh` — creates timestamped dump bundle, commits, and pushes
- `scripts/run-all.sh` — health + dump in one command

## Usage

```bash
cd /home/deploy/.openclaw/workspace/momo-tu-optimisation
bash scripts/run-all.sh
```

Dump output goes to:

- `/home/deploy/.openclaw/workspace/ops-dumps/<timestamp>/`

## Notes

- Dumps are text-first and avoid binary bulk.
- Intended for operational tracking, not full backups.
- Review dump contents before sharing outside your private repo.
