---
change_id: release-batch-3
title: "Release every package with Unreleased changes from the third batch of issues"
status: archived
roadmap_item: null
issue: null
branch: claude/release-batch-3-t00xet
created: 2026-10-13
updated: 2026-10-13
archived_at: 2026-10-13
---

## Intent

The third batch of issues (#424 to #455) is merged on `master` (`86dd0c9`). Eighteen public packages carry
`## Unreleased` entries from it, most of them breaking (#446 removed every built-in `pl` dictionary, #438 changed
core's formatters). Release them in one combined release, with the dependency ranges and module manifest ranges the
new code needs.

## Context

- `## Unreleased` entries, read from every package's `CHANGELOG.md` on `master` (`86dd0c9`): core, ui, charts,
  agent-ready, analytics, auth, billing, blog, feature-switches, mailing, mcp-access, ops, privacy, security, seo,
  waitlist, deploy, marketing-kit. Each one opens with a **Breaking (#446)** entry.
- Registry versions match the workspace versions, so each bump starts from the published version.
- db and observability depend on `@softure-ai/core` and have no entries; testing and config depend on nothing
  internal and have no entries.
- Every module repeats its required module versions in `dependsOn` (`module.json` and the inline manifest), and
  `defineSoftureConfig` checks those ranges at runtime against the installed modules' versions.
- The ops README gained two lines since `ops@0.1.10` (`softure-deploy run --local`), with no CHANGELOG entry.

## Constraints

- Owns: the version fields, `CHANGELOG.md` and `module.json` / inline manifest versions and `dependsOn` ranges of the
  released packages, their internal dependency ranges, the root lockfile, the `deploy-cli-version` defaults of the
  deploy workflows, the deploy README pin example and tests that pin those ranges.
- Bumps go through `npm run release:version` (it promotes `## Unreleased`); its local tags are deleted, since
  `auto-release` creates them on `master`.
- No production deploy.

## Notes

- Research and framing skipped: the release path is fixed (`scripts/release/README.md`), the previous combined
  release (PR #433, `context/archive/2026-10-12-release-batch-2/`) is the template and the scope is the changelog scan
  above.

## Decisions (auto)

- Breaking under 0.x is a minor bump: core, charts, agent-ready, analytics, auth, blog, feature-switches, mailing,
  mcp-access, ops, privacy, security, seo, waitlist, deploy and marketing-kit go to **0.2.0**; ui and billing go to
  **0.3.0**.
- The released packages require each other's new versions (`^0.2.0` / `^0.3.0`), in package.json and in `dependsOn`:
  a module that ships English only needs core 0.2.0, which reads a missing locale through `selectMessages`, and an
  older ui or module would pull in a second core. Mixing old and new versions is not supported.
- db and observability get a patch that widens their core range to `|| ^0.2.0`: their code uses only the result
  types, the module type and the config type, which the new core keeps.
- ops gets a CHANGELOG line for the README addition, so it ships with notes.
- All tags go out in one `auto-release` dispatch, since dependents need their dependencies published together.
