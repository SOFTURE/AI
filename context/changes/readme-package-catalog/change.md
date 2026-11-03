---
change_id: readme-package-catalog
title: "Every workspace package is listed in the README layout, and the new packages are cross-linked in the docs"
status: in_progress
roadmap_item: null
issue: []
branch: claude/project-thread-rchzlk
created: 2026-11-03
updated: 2026-11-03
---

## Intent

The owner noticed that `@softure-ai/alerts` is missing from the root `README.md`. The "Repository layout" block is
the only catalogue of packages, and nothing checks it, so a new package can land without its line. After this change:

1. the layout block lists every workspace package under its group (alerts, blog, charts and testing are missing
   today) and its descriptions match the packages (theme-notion has 37 components, not 36);
2. a repository test fails when a workspace package under `foundation/`, `modules/`, `tools/` or `themes/` has no
   line in the block, or when the block lists a folder that does not exist;
3. the packages the new ones plug into point to them: llm's `onUsage` and marketing-kit's `onCharge` to the metering
   recorders, jobs' alert hooks to `alertsFromJobs`, ops' health checks to `alertFromHealthReport`;
4. the alerts README no longer describes a jobs version without the queue breaker, which its `^0.1.7` range excludes.

## Context

Found in chat (owner, 2026-11-03), scope widened to "every place that lists or describes packages". Checked: every
package's `CHANGELOG.md` top section equals its version; `docs/01`, `docs/05` and `docs/06` are extraction history,
not catalogues; the release runbook names no package list. The other two new packages of the 02.11 batch (speech,
metering) already have their layout lines.

## Constraints

- Docs and one repository test; no package code, no version bump. A touched package README ships in the tarball, so
  each touched package gets a docs line under `## Unreleased` in its `CHANGELOG.md` (docs/02 §12).
- Do not touch the first npm publication of speech, alerts and metering in flight elsewhere (tags, workflows).

## Notes

- Research skipped: the gap is a missing list entry, measured directly (workspace folders against the layout block).
