---
change_id: release-ready-packages
title: "Release the eleven packages whose Unreleased changes no open work touches"
status: archived
roadmap_item: null
issue: null
branch: claude/project-thread-sf2jpg
created: 2026-10-12
updated: 2026-10-12
archived_at: 2026-10-12
---

## Intent

Eleven packages carry `## Unreleased` entries on `master` from closed issues: charts (#378), core (#375),
observability (#381), ui (#372), blog (#379, #380), mailing, mcp-access (#386), ops (#376), privacy (#376) config (#384) and
deploy (#383, merged in PR #396 while this change ran). Release them now instead of waiting for the whole batch. Each gets a patch version so the next
`auto-release` run publishes it.

## Context

- `## Unreleased` entries, read from every package's `CHANGELOG.md` on `master` (`66b2656`): the eleven above; the
  other eleven list nothing.
- Open work: PR #401 and issue #388 (billing), PR #400 (`context/workflow.json`
  only). None touches the eleven packages, so billing waits for its own change.

## Constraints

- Owns: the version fields, `CHANGELOG.md` and `module.json` / inline manifest versions of the eleven packages, the
  root lockfile.
- Bumps go through `npm run release:version` (it promotes `## Unreleased`); its local tags are deleted, since
  `auto-release` creates them on `master`.
- No production deploy.

## Notes

- Research and framing skipped: the release path is fixed (`scripts/release/README.md`) and the scope is the
  changelog scan above.
