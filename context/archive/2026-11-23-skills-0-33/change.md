---
change_id: skills-0-33
title: "Bump @softure-ai/skills to 0.33.0"
status: archived
roadmap_item: null
branch: claude/project-thread-rj91m5
created: 2026-11-23
updated: 2026-11-23
archived_at: 2026-11-23
---

## Intent
The repository follows `@softure-ai/skills` 0.33.0, so the cockpit reads this project's roadmap and state with the
newest contract, and `npx softure-skills doctor` reports no problem in `context/`.

## Constraints
- No release, no tag, no deploy.
- Project rules above the managed block stay as they are.

## Notes
- Owner's request in the project chat (2026-11-23). `@softure-ai/skills` is the only `@softure-ai/*` dependency
  resolved from npm.
- research skipped: a devDependency bump; the doctor names what to fix.
- frame skipped: no product question.

## Done
- `@softure-ai/skills` ^0.30.0 to ^0.33.0 (manifest and lock); the installer refreshed the managed block of
  `AGENTS.md` (the `context-doctor` job runs on pull requests and pushes to the main branch, check
  `ci-doctor-trigger`; infrastructure and deploy work, WORKFLOW §14).
- Doctor after the bump: no problem (no `roadmap-item-shape` finding; `context/foundation/roadmap.md` is idle and has
  no item blocks). `npx softure-skills state` regenerated `context/state.json`; the doctor exits 0.
