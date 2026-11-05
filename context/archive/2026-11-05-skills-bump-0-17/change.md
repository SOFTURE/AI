---
change_id: skills-bump-0-17
title: "rules: @softure-ai/skills 0.17.0; merge policy on-conflict in the config"
status: archived
roadmap_item: null
issue: null
branch: claude/project-thread-04efpv
created: 2026-11-05
updated: 2026-11-05
archived_at: 2026-11-05
---

## Intent

Upgrade `@softure-ai/skills` from `^0.15.0` to `^0.17.0`, the latest published version, so the managed block in
`AGENTS.md` and the installed skills follow the current package. 0.17.0 adds `autonomy.remergeMain: "on-conflict"`,
which is the owner's standing merge order from 2026-11-04; set it in `context/workflow.json` so `wt-merge-check.py`
follows the order on its own, and point the project section "Merging: master only on a conflict" at it.

## Context

Owner request in chat (2026-11-05): bump the skills to the maximum version, 17. `npm view @softure-ai/skills`
reports `latest: 0.17.0`.

Files: `package.json`, `package-lock.json`, `AGENTS.md` (managed block via the installer, plus the project section),
`context/workflow.json`.

## Constraints

- English only; the managed block is written only by the installer, never by hand.
- No interference with the open release pull request.

## Notes

- Framing: skipped. The owner named the outcome.
