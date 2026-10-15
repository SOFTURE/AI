---
change_id: skills-bump-0-10
title: "Bump @softure-ai/skills from 0.8.0 to 0.10.0"
status: archived
roadmap_item: null
issue: null
branch: claude/project-thread-pajn7v
created: 2026-10-15
updated: 2026-10-15
archived_at: 2026-10-15
---

## Intent

The repository runs the latest SOFTURE workflow: `@softure-ai/skills` moves from 0.8.0 to 0.10.0 (the latest on
npm), the lockfile and the managed `AGENTS.md` block follow, and anything the new workflow version requires of this
repository is in place.

## Constraints

- Root `package.json`, `package-lock.json`, the managed block of `AGENTS.md` and this change folder only.
- The managed block is written by the installer, never by hand.
- Project-specific rules outside the managed block stay as they are.

## Notes

- Placement: one-off maintenance requested in chat, `roadmap_item: null`, no issue.
- Framing: skipped. A dependency bump with a known target version.
- Archived 2026-10-15: the repository runs @softure-ai/skills 0.10.0; the hosted project's instructions need the
  WORKFLOW §8.5 pointer, which only the owner can add.
