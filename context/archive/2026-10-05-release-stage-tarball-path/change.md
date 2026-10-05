---
change_id: release-stage-tarball-path
title: "npm stages the release tarball from a local path, and every package moves to 0.1.2"
status: archived
roadmap_item: null
branch: claude/project-thread-wa8tm8
created: 2026-10-05
updated: 2026-10-05
archived_at: 2026-10-05
---

## Intent

`release.yml` stages `./release-out/<tarball>` instead of `release-out/<tarball>`, and all 16 public
packages go to 0.1.2 so `auto-release` can release them from a `master` that carries the fix. A
repository test requires the explicit relative path.

## Context

The 0.1.1 release (2026-10-05, after `release-0-1-1`) passed its gates in every run and failed at
"Stage on npm": npm read `release-out/softure-ai-marketing-kit-0.1.1.tgz` as the GitHub shorthand
`owner/repo` and ran `git ls-remote ssh://git@github.com/release-out/...` (Permission denied). Reproduced
locally with `npm publish release-out/x.tgz --dry-run`; `./release-out/x.tgz` publishes. Nothing was
published: GitHub Packages and the GitHub Release wait on the npm job. SOFTURE/SKILLS (read only, as the
owner suggested) never met it: it runs `npm publish` in the package directory, without a tarball path.

## Constraints

- Owns: the stage command in `.github/workflows/release.yml`, `tests/repo/release-workflow.test.ts`, the
  version fields of the 16 packages, both lockfiles, README status lines, the runbook's first batch
  section, the owner check in `roadmap-later.md`.
- Tags are never moved (0.1.0 and 0.1.1 stay without a release).

## Notes

- Placement: no main roadmap in flight; the owner's first release, run on the owner's word (2026-10-05).
- Research and framing skipped: the cause is in the run log and reproduced locally.
