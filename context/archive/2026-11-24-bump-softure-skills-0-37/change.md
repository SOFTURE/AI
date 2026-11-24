---
change_id: bump-softure-skills-0-37
title: "Bump @softure-ai/skills to 0.37.0 (issue #1456)"
status: archived
roadmap_item: null
issue: 1456
branch: claude/project-thread-o2669r
created: 2026-11-24
updated: 2026-11-24
archived_at: 2026-11-24
---

## Intent
The repository follows `@softure-ai/skills` 0.37.0 (from 0.34.0) through `routines/package-updates.md`, owner
answers settle by the 0.37.0 rules, and `npx softure-skills doctor` reports nothing in `context/`.

## Constraints
- No release, no tag, no deploy.
- One pull request (owner-word issue #1456).

## Notes
- research skipped: a devDependency bump; the versions crossed (0.35.0, 0.36.0, 0.36.1, 0.37.0) change the managed
  block and WORKFLOW §8.6 (an answered owner-queue entry leaves the queue; `later` moves the item to
  `roadmaps/roadmap-later.md`). No code of this repository uses the package.
- frame skipped: no product question.
- `@softure-ai/skills` is the only `@softure-ai/*` dependency resolved from npm; every other one is a workspace of
  this repository. Nothing held (`routines.packageUpdates.hold` absent), no `ownerSteps`.

## Done
- `@softure-ai/skills` ^0.34.0 to ^0.37.0 (manifest and lock; installed 0.37.0 equals the newest on npm); the
  installer refreshed the managed block of `AGENTS.md`.
- Owner answers given `later`: none open. The owner queue holds one entry (the off-site backup owner step, not
  answered); no `(later: #N)` entry exists, and the earlier later roadmap is archived. Nothing to move.
- `context/workflow.json` declares `autonomy.ownerWordWake: "routine"`: the event-driven new-issue routine has no
  cron and fired on this very issue's opening, so its GitHub trigger is verified. The doctor note
  `owner-word-wake-undeclared` is gone.
- `npx softure-skills state` left `context/state.json` unchanged; the doctor prints only `context/ contract OK`.
