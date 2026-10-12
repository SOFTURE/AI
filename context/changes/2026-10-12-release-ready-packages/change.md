---
change_id: release-ready-packages
title: "Release the ten packages whose Unreleased changes no open work touches"
status: implementing
roadmap_item: null
issue: null
branch: claude/project-thread-sf2jpg
created: 2026-10-12
updated: 2026-10-12
---

## Intent

Ten packages carry `## Unreleased` entries on `master` from closed issues: charts (#378), core (#375),
observability (#381), ui (#372), blog (#379, #380), mailing, mcp-access (#386), ops (#376), privacy (#376) and
config (#384). Release them now instead of waiting for the whole batch. Each gets a patch version so the next
`auto-release` run publishes it.

## Context

- `## Unreleased` entries, read from every package's `CHANGELOG.md` on `master` (`66b2656`): the ten above; the
  other twelve list nothing.
- Open work: PR #396 and issue #383 (deploy), PR #401 and issue #388 (billing), PR #400 (`context/workflow.json`
  only). None touches the ten packages, so deploy and billing wait for their own changes.

## Constraints

- Owns: the version fields, `CHANGELOG.md` and `module.json` / inline manifest versions of the ten packages, the
  root lockfile.
- Bumps go through `npm run release:version` (it promotes `## Unreleased`); its local tags are deleted, since
  `auto-release` creates them on `master`.
- No production deploy.

## Notes

- Research and framing skipped: the release path is fixed (`scripts/release/README.md`) and the scope is the
  changelog scan above.
