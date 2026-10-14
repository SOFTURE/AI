---
change_id: deploy-notes-roadmap-auto
title: "deploy: release-notes --roadmap=auto finds the main or the archived roadmap (issue #465)"
status: archived
roadmap_item: null
issue: 465
branch: claude/project-thread-ufgxw0
created: 2026-10-14
updated: 2026-10-14
archived_at: 2026-10-14
---

## Intent

Close [issue #465](https://github.com/SOFTURE/AI/issues/465) (labels `enhancement`, `pkg: deploy`, `adoption`):
`softure-deploy release-notes --roadmap=<file>` takes one fixed path, so a release made after the roadmap was closed
(moved to `context/foundation/archive/<YYYY-MM-DD>[-N]-roadmap.md`) fails with ENOENT. `--roadmap=auto` uses
`context/foundation/roadmap.md` when it exists, otherwise the archived roadmaps added since the previous tag; with
neither there is no table and the command exits 0.

## Context

Follow-up to the roadmap table of `release-notes`. Releases are batched by the coordinator: the deploy CHANGELOG gets
`## Unreleased`, the version bump comes with the release. An adopting app keeps a shell fallback in its release
workflow until this ships.

## Constraints

- An explicit path keeps today's behaviour: a missing file fails.
- Git runs through `execFile` with checked refs only (the existing `git.ts` rule).
- Archived roadmaps are read at `--to`, not from the working tree, so a redeploy of an older tag finds the same table.

## Notes

- Framing: skipped. The issue names the flag value, the lookup order, the range and the acceptance cases.

## Decisions (auto)

- Only the value `auto`; a directory value is not added (one way to ask for the lookup is enough).
- Several archived roadmaps added in the range: their `done_code` rows are listed together, oldest roadmap first
  (date, then collision counter, no counter before `-2`).
- First release (no previous tag): every archived roadmap in the tree at `--to` counts.
- The "skip tags of failed releases" option is left out: the caller can already pass `--from`.
- The main roadmap is checked in the working tree, like an explicit path (the release job checks out `--to`).
