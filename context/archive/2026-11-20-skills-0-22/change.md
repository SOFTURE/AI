---
change_id: skills-0-22
title: "@softure-ai/skills 0.22.0 in the repository"
status: archived
roadmap_item: null
branch: claude/project-thread-lwo0m7
created: 2026-11-20
updated: 2026-11-20
archived_at: 2026-11-20
---

## Intent
The repository's own workflow skills and the managed block in `AGENTS.md` follow the newest `@softure-ai/skills`
(0.17.0 to 0.22.0). Only the skills package moves: every other `@softure-ai/*` package is a workspace here.

## Constraints
- The project's own rules above the managed block in `AGENTS.md` stay as they are.
- No release, no tag, no deploy.

## Notes
- research skipped: a devDependency bump whose postinstall rewrites only the managed block and the managed
  `.gitignore` lines; the diff is the whole picture.
- frame skipped: no product question.

## Done
- `@softure-ai/skills` ^0.17.0 to ^0.22.0 (manifest and lock).
- The postinstall refreshed the managed block in `AGENTS.md` (`softure-doctor`, `context/state.json`, owner-word
  issues, the roadmap thread opening each item's change) and the managed `.gitignore` lines (`softure-doctor`,
  `softure-evidence`). Running the doctor in CI is a change of its own.
