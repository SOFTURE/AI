---
change_id: prepush-manifest-scope
title: "Pre-push runs the CI test scope, not the full suite, when a manifest or lockfile changes"
status: archived
roadmap_item: null
issue: null
branch: claude/project-thread-eoqb7d
created: 2026-11-25
updated: 2026-11-25
archived_at: 2026-11-25
---

## Intent
A push that changes a package manifest or the lockfile (every release version bump) no longer waits about 23 minutes
for the full suite in the pre-push hook. It runs the tests of the packages the change reaches, the same scope the
pull request's CI test job runs, so the local gate keeps the quality of the CI gate. Owner request in chat
(2026-11-25, CI usage analysis of #1450).

## Context
`scripts/test-changed.mjs` runs the full suite whenever a file matches `FULL_SUITE_PATTERNS` (manifests, lockfile,
migrations, test setup, tool config). CI already narrows the same change to the reached packages
(`scripts/ci/affected.mjs` → `getTestScope`, lockfile reach from `scripts/ci/lockfile-changes.mjs`).

## Scope
- `scripts/test-changed.mjs`: when a full-suite file changed, compute the CI test scope from the local diff (the
  lockfile at the merge base read with `git show`); the whole suite only when that scope is "all" (a shared root file,
  a repository tool in the lockfile, a git or parse failure).
- Tests in `tests/repo/test-gates.test.ts`; comments in `lefthook.yml`, AGENTS.md hook line.
- Out of scope: the `@softure-ai/config` lefthook preset and `FULL_SUITE_PATTERNS` (apps' hooks, merge-push logic).

## Decisions (auto)
- Only the repository's own hook changes, not the published preset: the preset's pre-push runs the full `npm test` on
  every code push of an app (not only on manifest changes), apps have no CI test scoping to fall back on, and
  `FULL_SUITE_PATTERNS` also guards `softure-merge-push-scope`. So no CHANGELOG entry and no release.
- Reuse `getTestScope` from `scripts/ci/affected.mjs` instead of a second rule set: the local gate and CI agree by
  construction.
- No `vitest --changed` in the narrowed run: Vitest's default `forceRerunTriggers` (`**/package.json/**`) would turn
  it into the full suite again; the reached package folders already hold the related tests.

## Notes
- frame skipped: the problem and its measured cost are known (memory of the CI analysis, 2026-11-25).

## Done
`npm run test:changed` (pre-push) runs the CI test scope when a manifest, lockfile, migration, test setup or tool
config changed: the reached package folders, their dependents and `tests/`; the whole suite only for a shared root
file, a repository tool in the lockfile or a failure. A release bump of a leaf package (host@0.2.0) now runs
`tests/ tools/host/` instead of the full suite. Tests in `tests/repo/test-gates.test.ts`; `lefthook.yml` and AGENTS.md
describe it. The `@softure-ai/config` preset is unchanged, so no release.
