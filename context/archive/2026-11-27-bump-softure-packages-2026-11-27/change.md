---
change_id: bump-softure-packages-2026-11-27
title: "Bump @softure-ai/skills to 0.41.2 (issue #1523)"
status: archived
roadmap_item: null
issue: 1523
branch: claude/project-thread-8kujw3
created: 2026-11-27
updated: 2026-11-27
archived_at: 2026-11-27
---

## Intent
The repository follows the newest `@softure-ai/skills` (0.41.1 to 0.41.2), `context/state.json` is regenerated with
it, and `npx softure-skills doctor` reports no problem in `context/`.

## Context
Cockpit issue #1523 (label `cockpit`), sent by the owner from COCKPIT. Since 0.41.2 a queued roadmap is listed only
under `queued` and is no longer an `owner_queue` entry.

## Constraints
- Change nothing else. No release, no tag, no deploy.

## Notes
- frame skipped: no product question; the issue names the exact outcome.

## Done
- `@softure-ai/skills` ^0.41.1 to ^0.41.2 (manifest and lock); the installer left the managed block of `AGENTS.md`
  unchanged.
- `npx softure-skills state` regenerated `context/state.json`; `owner_queue` did not change (empty before and
  after; the project has no queued roadmap). The doctor exits 0.
