---
change_id: ci-test-shards-prepush
title: "ci: the unit and repository tests run in four shards; pre-push runs only the tests a branch can break"
status: plan_approved
roadmap_item: null
issue: null
branch: claude/project-thread-y5szj5
created: 2026-11-04
updated: 2026-11-04
---

## Intent

Shorten the two longest waits of a change: the `unit and repository tests` job of `ci.yml` (18 to 26 minutes) and the
pre-push hook (the full `npm test`, about 25 minutes). After this change:

1. `ci.yml` runs the full suite in four parallel shards (`npm test -- --shard=N/4`), each with its own Postgres, none
   cancelling the others on a failure;
2. `pre-push` runs `npm run test:changed` (`scripts/test-changed.mjs`): the tests Vitest relates to the files changed
   since the branch left `origin/master`, then `tests/repo`; the full suite when a changed file is a manifest,
   lockfile, migration, test setup or tool config (the list of the `@softure-ai/config` lefthook preset), or when the
   base cannot be told;
3. `AGENTS.md` and `lefthook.yml` say so.

## Context

Owner request in the project thread (2026-11-04): "focus on optimising CI so it does not take so long"; the
coordinator added the pre-push hook and the test job as the priority.

Measured on the `ci` run of 2026-11-04 14:28 (master, 776 test files): 2612 s of file time, 1562 s wall on a 4-core
runner with `maxWorkers: "50%"`. No file dominates (the slowest takes 168 s, `foundation/db` 448 s in all), so
parallel runners are the lever. A trial of `vitest run --changed` on the area-gating commit ran 1 file in 11 s.

## Constraints

- No test skipped or loosened; CI still runs every test on every pull request and every master push.
- `npm test` stays the full suite.
- English only; no release.

## Notes

- Research: in Context above (measurements). Framing: skipped, the owner named the outcome.
