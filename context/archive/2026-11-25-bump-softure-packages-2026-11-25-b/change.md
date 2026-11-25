---
change_id: bump-softure-packages-2026-11-25-b
title: "Bump SOFTURE packages to skills 0.41.1 (2026-11-25)"
status: archived
roadmap_item: null
branch: claude/project-thread-d3i423
created: 2026-11-25
updated: 2026-11-25
archived_at: 2026-11-25
---

## Intent
The repository follows the newest `@softure-ai/skills` (0.39.1 to 0.41.1), and `npx softure-skills doctor` reports
no problem in `context/`.

## Constraints
- No release, no tag, no deploy. No scheduled task is created or changed.

## Notes
- Second on-demand run of `routines/package-updates.md` on 2026-11-25, at the owner's request. Only
  `@softure-ai/skills` comes from npm here; nothing held.
- research skipped: 0.41.0 (in 0.41.1) replaces the GitHub-triggered cockpit wake routine with the API-triggered COCKPIT command
  (`routines/cockpit-command.md`); the project declares nothing about it, so `autonomy.cockpitWake` is dropped.
- frame skipped: no product question.

## Done
- `@softure-ai/skills` ^0.39.1 to ^0.41.1 (manifest and lock); the installer refreshed the managed block of `AGENTS.md`.
- `context/workflow.json`: the obsolete `autonomy.cockpitWake` removed.
- `AGENTS.md` (project part): "Cockpit wake" states that no COCKPIT command task is set up (the owner paused the
  scheduled tasks) and that a cockpit issue arrives only through the start-of-run check until then.
- `npx softure-skills state` left `context/state.json` unchanged; the doctor exits 0.
