---
change_id: bump-softure-packages-2026-11-24
title: "Bump SOFTURE packages (2026-11-24)"
status: archived
roadmap_item: null
branch: claude/bump-softure-2026-11-24
created: 2026-11-24
updated: 2026-11-24
archived_at: 2026-11-24
---

## Intent
The repository follows the newest `@softure-ai/skills` (0.33.0 to 0.34.0), and `npx softure-skills doctor` reports
no problem in `context/`.

## Constraints
- No release, no tag, no deploy.

## Notes
- Nightly run of `routines/package-updates.md`. `@softure-ai/skills` is the only `@softure-ai/*` dependency resolved
  from npm; every other `@softure-ai/*` package is a workspace of this repository, and no SOFTURE pin outside
  `package.json` moves with skills. Nothing held (`routines.packageUpdates.hold` absent).
- research skipped: a devDependency bump; the package diff (0.33.0 to 0.34.0) adds `wt-roadmap.py released <tag>`
  and its documentation (settling the context after a release), and asks nothing of an adopting app.
- frame skipped: no product question.

## Done
- `@softure-ai/skills` ^0.33.0 to ^0.34.0 (manifest and lock); the installer refreshed the managed block of
  `AGENTS.md` (Releases: the session that sees a release through runs `wt-roadmap.py released <tag>`).
- `npx softure-skills state` left `context/state.json` unchanged; the doctor exits 0.
