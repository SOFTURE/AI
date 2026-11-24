---
change_id: skills-bump-0-37
title: "Bump @softure-ai/skills to 0.37.0"
status: archived
roadmap_item: null
branch: claude/sweet-fermi-w8l5g1
created: 2026-11-24
updated: 2026-11-24
archived_at: 2026-11-24
---

## Intent
The repository follows `@softure-ai/skills` 0.37.0 (from 0.34.0), every owner-queue entry answered "later" is settled
the 0.37.0 way, and `npx softure-skills doctor` reports no problem in `context/`. Owner word: SOFTURE/AI#1456.

## Constraints
- No release, no tag, no deploy.

## Notes
- Steps from `routines/package-updates.md`. `@softure-ai/skills` is the only `@softure-ai/*` dependency resolved from
  npm; no SOFTURE pin outside `package.json` moves with it. Nothing held.
- research skipped: a devDependency bump; the package diff (0.34.0 to 0.37.0) changes how an owner answer settles an
  owner-queue entry (it always leaves the queue; "later" moves the item to `roadmaps/roadmap-later.md`) and adds the
  owner-word wake routine. It asks nothing else of an adopting app.
- frame skipped: no product question.

## Done
- `@softure-ai/skills` ^0.34.0 to ^0.37.0 (manifest and lock); the installer refreshed the managed block of `AGENTS.md`.
- `autonomy.ownerWordWake: "routine"` in `context/workflow.json`: the GitHub-triggered owner-word routine is set up
  and verified (it fired on issues.opened for #1456).
- Owner queue: one entry (`oq-de9e6e7104`), unanswered; no entry answered "later", so nothing to move.
- `npx softure-skills state` leaves `context/state.json` unchanged; the doctor exits 0 with no note.
