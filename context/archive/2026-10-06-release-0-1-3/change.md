---
change_id: release-0-1-3
title: "npm stages a package that already exists through its trusted publisher alone, and every package moves to 0.1.3"
status: archived
roadmap_item: null
branch: claude/project-thread-wa8tm8
created: 2026-10-06
updated: 2026-10-06
archived_at: 2026-10-06
---

## Intent

`release.yml` hands `NPM_TOKEN` to npm only for a package that is not on npm yet. Every package that
exists stages through its trusted publisher (OIDC) alone, and the run says which path it took. All 16
public packages go to 0.1.3, so the next `auto-release` proves the trusted publishers without the token.

## Context

The owner added a trusted publisher to every package (2026-10-06) and asked for 0.1.3 that releases
without the token. Before this change the stage step exported the secret as `NODE_AUTH_TOKEN` for the
whole step, so a release would have succeeded with the token even if a trusted publisher were wrong, and
no log line showed which one npm used. Every package exists on npm (as the `0.0.0-stage` placeholder,
checked with `npm view` on 2026-10-06), so 0.1.3 takes the OIDC path for all 16.

## Constraints

- Owns: the "Stage on npm" step of `.github/workflows/release.yml`, `tests/repo/release-workflow.test.ts`,
  the version fields of the 16 packages, both lockfiles, README status lines, the runbook, the owner
  check in `roadmap-later.md`.
- Deleting the `NPM_TOKEN` secret stays the owner's step; with this change it no longer matters for
  existing packages.

## Notes

- Placement: no main roadmap in flight; the owner's release, on the owner's word (2026-10-06).
- Research and framing skipped: the behaviour is in the workflow itself and the npm state was read directly.
