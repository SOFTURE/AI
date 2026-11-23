---
change_id: skills-0-29
title: "@softure-ai/skills 0.29.0 and the doctor on context/state.json"
status: archived
roadmap_item: null
branch: claude/project-thread-a2ujbv
created: 2026-11-23
updated: 2026-11-23
archived_at: 2026-11-23
---

## Intent
The repository follows the newest `@softure-ai/skills` (0.24.0 to 0.29.0), and `npx softure-skills doctor` reports
no problem in `context/`. The project's own merge rule in `AGENTS.md` goes, since the package carries it as
`autonomy.remergeMain: "on-conflict"` (SOFTURE/SKILLS#19).

## Constraints
- No release, no tag, no deploy.
- Project rules above the managed block change only where the package now carries them.

## Notes
- research skipped: a devDependency bump; the doctor names what to fix.
- frame skipped: no product question.

## Done
- `@softure-ai/skills` ^0.24.0 to ^0.29.0 (manifest and lock); the postinstall refreshed the managed block of
  `AGENTS.md` (one item = one change = one thread, for the coordinator and the threads).
- `AGENTS.md`: the project section "Merging: master only on a conflict" removed; `context/workflow.json` already sets
  `autonomy.remergeMain: "on-conflict"`, which the managed block describes. The Dependabot section points there.
- Doctor at 0.29.0: one problem, `state-stale` (`owner_queue`). `context/state.json` regenerated: the off-site backup
  owner step under `## Owner decisions and checks` of the idle `roadmap.md` is in `owner_queue` again (the gap of
  SOFTURE/SKILLS#63 is fixed upstream). The doctor then exits 0.
