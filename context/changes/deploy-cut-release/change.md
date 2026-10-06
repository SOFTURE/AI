---
change_id: deploy-cut-release
title: "A reusable workflow cuts a release from a dispatch"
status: plan_reviewed
roadmap_item: DF-12
branch: claude/project-thread-t04i0p
created: 2026-10-06
updated: 2026-10-06
archived_at: null
---

## Intent

An app gets a second caller next to `deploy.yml`: `release.yml`, started with *Run workflow* on the default branch by
the owner or by an agent (a cloud session cannot push a tag, but it can start a `workflow_dispatch`). It calls a new
reusable workflow, `SOFTURE/AI/.github/workflows/deploy-cut-release.yml`, which picks the next free date tag
(`vYYYY.MM.DD`, then `-2`, `-3`), creates the GitHub Release on the dispatched commit with an optional description
above GitHub's generated notes, and starts the app's deploy workflow on that tag. The last step is explicit because a
release created with `GITHUB_TOKEN` triggers no other workflow: `release: published` in `deploy.yml` does not fire,
`workflow_dispatch` does.

## Context

From [`roadmap.md`](../../foundation/roadmap.md) (deploy-followups), item **DF-12**:

> - **Outcome:** a reusable workflow (with a caller example) that an owner or an agent starts with *Run workflow* on
>   the default branch: it picks the next free date tag (`vYYYY.MM.DD`, then `-2`, `-3`), creates the GitHub Release
>   with an optional description and starts the app's deploy workflow on that tag (a release made with `GITHUB_TOKEN`
>   triggers no workflow by itself).
> - **Prerequisites:** DF-11 on `master`.
> - **Unknowns:** whether the tag pattern is an input (FIRE's dates, semver).
> - **Source:** DF-1 (`deploy-fire-parity`), research: FIRE's `auto-release.yml` (research §3).

The taken backlog entry is kept as [`backlog-input.md`](backlog-input.md). The deploy workflow and its caller come
from DP-2 ([archive](../../archive/2026-10-05-deploy-reusable-workflows/change.md)).

## Constraints

- Adds files only: `.github/workflows/deploy-cut-release.yml`, `tools/deploy/examples/release.yml`; edits
  `tests/repo/deploy-workflows.test.ts`, the actionlint step of `ci.yml` (one more example path) and the package
  README. It does not touch `deploy-app.yml`, `tools/deploy/examples/deploy.yml` or `tools/deploy/templates/`, which
  DF-9, DF-10 and DF-11 change in parallel.
- Started before DF-11 merged (the owner asked to start it right away, 2026-10-06). DF-11 is a prerequisite only by lane:
  its guard (a tag off the default branch is refused) is met by construction here, since the tag is cut on the
  dispatched default-branch commit. The branch merges `master` before its own merge.
- No real release, tag or deploy: the first real run is the owner's. English-only code, comments and commits.
  FIRE_TRACKER is read only.

## Notes

- Placement: main roadmap deploy-followups, item DF-12 (taken from `context/backlog/roadmap-deploy-followups/`).
- Research: done (`research.md`), short: FIRE's `auto-release.yml`, this repository's own `auto-release.yml`, and what
  a called workflow sees of its caller (ref, SHA, token, event).
- Framing skipped: the roadmap item fixes the problem and the shape (FIRE runs the same workflow in production);
  nothing about whether to build it is in doubt.
