---
change_id: release-0-1-5
title: "npm takes each version at once: direct publish through the trusted publisher, every package bumped"
status: archived
roadmap_item: null
branch: claude/project-thread-wa8tm8
created: 2026-10-06
updated: 2026-10-06
archived_at: 2026-10-06
---

## Intent

`release.yml` runs `npm publish` instead of `npm stage publish`, so a version is live on npm as soon as its
release passes, with no approval on npmjs.com, as in SOFTURE/SKILLS. The 16 packages go to 0.1.5 and deploy and
testing to 0.1.1, so the next `auto-release` publishes all 18 that way.

## Context

The owner asked why every version needs his manual approval and decided to publish automatically like SOFTURE/SKILLS
(2026-10-06). The approval step came from FD-2 (`release-pipeline`), which staged every version. The trusted
publishers must allow `npm publish`; the owner set them. 0.1.4 (and deploy and testing 0.1.0) proved the OIDC path.

## Constraints

- Owns: the npm job of `.github/workflows/release.yml`, the comment in `auto-release.yml`,
  `tests/repo/release-workflow.test.ts`, version fields of the 18 packages and the deploy workflow's default CLI
  version, both lockfiles, README status lines, the runbook, the module standard, `roadmap-later.md`.
- A new package still needs `NPM_TOKEN` for its first publish.

## Notes

- Placement: no main roadmap in flight; the owner's release, on the owner's word (2026-10-06).
- Research and framing skipped: the owner chose the approach; SOFTURE/SKILLS is the reference.
