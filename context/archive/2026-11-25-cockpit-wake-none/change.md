---
change_id: cockpit-wake-none
title: "Set cockpitWake back to none after a failed wake test"
status: archived
roadmap_item: null
branch: claude/project-thread-d3i423
created: 2026-11-25
updated: 2026-11-25
archived_at: 2026-11-25
---

## Intent
`autonomy.cockpitWake` declares only what is verified: the test cockpit issue #1465 (opened 10:40:14 UTC) did not
start the issue routine within two minutes, so the value goes back to `"none"`.

## Constraints
- No release, no tag, no deploy. The routine itself is not changed.

## Notes
- research skipped: the measurement is the research (routine last run 2026-11-24 15:25 UTC, none after #1465).
- frame skipped: the owner set the rule (no start within two minutes: back to "none").

## Done
- `context/workflow.json`: `autonomy.cockpitWake` "routine" to "none".
- `AGENTS.md` (project part): "Cockpit wake" says why and when it becomes "routine".
