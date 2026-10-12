---
change_id: release-batch-2
title: "Release every package with Unreleased changes from the second batch of issues"
status: planned
roadmap_item: null
issue: null
branch: claude/release-batch-2-cylmzu
created: 2026-10-12
updated: 2026-10-12
---

## Intent

The second batch of issues (#402 to #407, #409 to #415) is merged on `master` (`0ac8963`). Eleven packages carry
`## Unreleased` entries from it: charts, core, db, testing, ui, agent-ready, auth, blog, mcp-access, seo and deploy.
Release them in one combined release, with the dependency ranges the new code needs.

## Context

- `## Unreleased` entries, read from every package's `CHANGELOG.md` on `master` (`0ac8963`): the eleven above.
- Registry versions match the workspace versions, so each bump starts from the published version.
- mcp-access calls `resolveOnlyAccount` from `@softure-ai/auth/server` (#411): its `@softure-ai/auth` range must
  require the auth release that exports it.
- seo re-exports core's `@softure-ai/core/og` loader and the blog imports it (#414): their `@softure-ai/core` ranges
  must require the core release that has it.
- ui's `ConfirmActionButtonProps` became a type alias over a union (#407): an app interface that `extends` it no
  longer compiles. That is a breaking change.

## Constraints

- Owns: the version fields, `CHANGELOG.md` and `module.json` / inline manifest versions of the released packages,
  their internal dependency ranges, the root lockfile, the `deploy-cli-version` defaults of the deploy workflows and
  the README pin example.
- Bumps go through `npm run release:version` (it promotes `## Unreleased`); its local tags are deleted, since
  `auto-release` creates them on `master`.
- No production deploy.

## Notes

- Research and framing skipped: the release path is fixed (`scripts/release/README.md`), the previous combined
  release (PR #408) is the template and the scope is the changelog scan above.

## Decisions (auto)

- ui goes to **0.2.0** (minor): breaking under 0.x, as billing 0.2.0 in PR #408. A caret range on 0.1.x never
  accepts 0.2.0, so every package with a ui peer range widens it to `|| ^0.2.0` (the code is tested against the
  workspace ui) and its dev range moves to `^0.2.0`. The five dependents with nothing else to release (billing,
  feature-switches, mailing, privacy, waitlist) get a patch with that one CHANGELOG line, so an app can install
  ui 0.2.0 next to them.
- Every other package gets a patch: the entries add exports and options without breaking existing calls.
- mcp-access requires `@softure-ai/auth` `^0.1.13`; seo and blog require `@softure-ai/core` `^0.1.11`.
- All tags go out in one `auto-release` dispatch: publishing does not install dependencies, so auth and core
  publish together with the packages that need them.
