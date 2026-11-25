---
change_id: release-skip-repeated-gates
title: "A tag release skips the gates its commit already passed on master"
status: planned
roadmap_item: null
branch: claude/project-thread-velbub
created: 2026-11-25
updated: 2026-11-25
archived_at: null
---

## Intent
A package release takes about 5 to 8 minutes instead of 20 to 31, with the same verification: `release.yml` skips
typecheck, lint and the full test suite when the tagged commit already has a successful `ci.yml` run for a push to
master (which runs those gates on the whole tree), and runs them as today otherwise. Owner's word in chat
(2026-11-25), after the CI usage report of the week to 2026-11-23.

## Context
- CI usage report (SOFTURE/AI, 2026-11-16 to 2026-11-23): `release / validate and pack` is the top job, 202 runs,
  p50 20 min, p95 30 min. About 50 tag releases a week; one batch often tags 4 to 6 packages on one commit, each
  repeating the same gates in parallel.
- `ci.yml` on a push to master runs the whole suite (`test-paths` is empty outside pull requests), typecheck and
  lint, in 4 shards, in 6 to 10 minutes.
- `auto-release.yml` tags the head of master, so the tagged commit is the one `ci.yml` tested on its push.

## Constraints
- Never publish a commit that did not pass the gates: no successful master run means the gates run.
- Keep the file name `release.yml` (npm trusted publishers are bound to it).
- Pull request dry runs and branch dispatches stay as they are (they never ran the gates).

## Notes
- frame skipped: the problem and the fix are measured in the report; no product question.
