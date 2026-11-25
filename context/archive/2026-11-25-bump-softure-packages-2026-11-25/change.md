---
change_id: bump-softure-packages-2026-11-25
title: "Bump SOFTURE packages and declare the cockpit wake (2026-11-25)"
status: archived
roadmap_item: null
branch: claude/project-thread-d3i423
created: 2026-11-25
updated: 2026-11-25
archived_at: 2026-11-25
---

## Intent
The repository follows the newest `@softure-ai/skills` (0.37.0 to 0.39.1), declares how it wakes on a cockpit issue
(`autonomy.cockpitWake: "routine"`), and `npx softure-skills doctor` reports no problem in `context/`.

## Constraints
- No release, no tag, no deploy.
- No second routine: the existing issue routine serves as the cockpit wake.

## Notes
- On-demand run of `routines/package-updates.md` at the owner's request. `@softure-ai/skills` is the only
  `@softure-ai/*` dependency resolved from npm; every other `@softure-ai/*` package is a workspace of this
  repository, and no SOFTURE pin outside `package.json` moves with skills. Nothing held.
- research skipped: a devDependency bump; 0.37.0 to 0.39.1 renames the owner's written word from `owner-word` to
  `cockpit` (label, marker, `autonomy.cockpitWake`) and adds the main-branch CI and branch-protection checks to the
  managed block; it asks of an adopting app only the `cockpitWake` declaration.
- frame skipped: no product question.

## Done
- `@softure-ai/skills` ^0.37.0 to ^0.39.1 (manifest and lock); the installer refreshed the managed block of `AGENTS.md`.
- `context/workflow.json`: `autonomy.ownerWordWake` replaced by `autonomy.cockpitWake: "routine"`.
- `AGENTS.md` (project part): "Cockpit wake" names the existing issue routine as the cockpit wake routine.
- The label `cockpit` exists in the repository.
- `npx softure-skills state` left `context/state.json` unchanged; the doctor exits 0.
