---
change_id: skills-0-24
title: "@softure-ai/skills 0.24.0 and the context-doctor CI job"
status: archived
roadmap_item: null
branch: claude/project-thread-l57psh
created: 2026-11-20
updated: 2026-11-20
archived_at: 2026-11-20
---

## Intent
The repository follows the newest `@softure-ai/skills` (0.22.0 to 0.24.0), its `context/state.json` is written in the
new schema, and CI runs the doctor in a job named `context-doctor`, the name readers look for (WORKFLOW §12.2).

## Constraints
- The project's own rules above the managed block in `AGENTS.md` stay as they are.
- The doctor job has no paths filter and no condition: it runs on every pull request, documentation-only ones too.
- No release, no tag, no deploy.

## Notes
- research skipped: a devDependency bump plus a job rename; the installer prints the job it expects.
- frame skipped: no product question.

## Done
- `@softure-ai/skills` ^0.22.0 to ^0.24.0 (manifest and lock); the postinstall refreshed the managed block of
  `AGENTS.md` (the `context-doctor` job name, owner-word issues that answer an `owner_queue` entry).
- `context/state.json` regenerated (`npx softure-skills state`): schema version 2, `project` "SOFTURE AI".
- The CI job `context` ("context contract") became `context-doctor` (id and name); it stays the only doctor run.
- `npx softure-skills doctor` exits 0.
