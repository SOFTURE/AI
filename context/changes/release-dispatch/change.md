---
change_id: release-dispatch
title: "Releases start from one Actions dispatch, so the agent can release on the owner's word"
status: implementing
roadmap_item: null
branch: claude/project-thread-wa8tm8
created: 2026-10-05
updated: 2026-10-05
archived_at: null
---

## Intent

A release of one, several or all packages starts from a single `workflow_dispatch` on `master`
(`auto-release.yml`): it creates the missing `<package>@<version>` tags from the versions on `master`
and starts `release.yml` on each tag, which then publishes exactly as a pushed tag does (npm stage,
GitHub Packages, GitHub Release). The agent can trigger it through the GitHub tools, so a release no
longer needs the owner at a terminal; it still happens only on the owner's explicit word, and npm
still waits for the owner's approval of each staged version.

## Context

The owner asked (2026-10-05, in the project thread) the agent to push the 0.1.0 tags itself. The
cloud session's git proxy refuses tag pushes (HTTP 403; it lets only the session branch through) and
the GitHub tools cannot create tags. The owner then asked for the FIRE_TRACKER pattern
(`.github/workflows/auto-release.yml` there, read only): a dispatched workflow creates the tag with
`GITHUB_TOKEN` and starts `release.yml` with `gh workflow run --ref <tag>`, because a tag or release
created by `GITHUB_TOKEN` starts no other workflow, except through `workflow_dispatch`. The owner wants
releases autonomous and steered by the agent.

## Constraints

- Owns: `.github/workflows/auto-release.yml` (new), a tag-planning script under `scripts/release/` and
  its test, `scripts/release/README.md`, `.github/workflows/release.yml` (header comment only).
- `release.yml` publishing steps stay as they are: a dispatch on a tag must take the same path as a
  pushed tag.
- The agent runs `auto-release.yml` only on the owner's explicit word (owner, 2026-10-05).
- English-only code, comments and commits (AGENTS.md).

## Notes

- Placement: no main roadmap in flight; asked for directly by the owner, follows `packages-first-release`.
- Research: short (how `release.yml` behaves on a dispatch with a tag ref). Framing skipped: the owner
  named the solution and the problem (no tag push from the cloud session) is a measured 403.
