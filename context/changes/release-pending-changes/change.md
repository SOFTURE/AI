---
change_id: release-pending-changes
title: "Release every package whose master differs from its npm version"
status: planned
roadmap_item: null
branch: claude/project-thread-titzf4
created: 2026-10-07
updated: 2026-10-07
---

## Intent

Seven packages carry changes on `master` that npm does not have yet: deploy (#183, #184), security (#177),
ops (#181), marketing-kit (#175, #176), and the packaging and README fixes in charts, ui and seo
(`CHANGELOG.md` in the tarball). Each gets a patch version so the next `auto-release` publishes it.

## Context

Found by `git diff <package>@<npm version> origin/master -- <package dir>` over every public package; the other
eleven have no change since their tag. Versions on `master` equal the npm versions, so nothing is bumped yet.

## Constraints

- Owns: the version fields, `CHANGELOG.md` and `module.json`/inline manifest versions of the seven packages, the
  root lockfile.
- Bumps go through `npm run release:version` (it promotes `## Unreleased`), local tags are dropped:
  `auto-release` creates them on `master`.

## Notes

- Placement: work is tracked in GitHub issues, not a roadmap; no issue of its own (the release of #175, #176, #177,
  #181, #183, #184).
- Research and framing skipped: the release path is fixed (`scripts/release/README.md`) and the scope is the diff
  above.
