# Implementation review: release-pipeline

Reviewed: commits c7ac70e..9fc93ca against plan.md @ 2026-10-02, by an independent read-only reviewer plus the implementer. Verdict: ready after fixes.
Findings: 0 critical, 4 warning, 8 suggestion. All fixed or documented in `fix(release-pipeline): address impl review`.

## Plan conformance

| Phase | Commit | As planned | Evidence |
| --- | --- | --- | --- |
| 1 Release rules as pure functions | c7ac70e | yes (TDD) | 33 tests red against a stub, then green |
| 2 Pack command and publishable template | 0505922 | yes; the pack test packs a copy of the template, not the checkout | packing writes `LICENSE` and `dist/` while other repository tests read the checkout in parallel |
| 3 Version command for the owner | 60aea98 | yes (TDD for the helpers) | happy path run in a scratch clone: commit + annotated tag, `module.json` in step |
| 4 Release workflow and runbook | 9fc93ca | yes; GitHub Packages now runs after npm | PR #5: `validate and pack` green, publish and release jobs skipped; `actionlint` 1.7.7 clean |

The npm facts were checked against npm 11.21.0 by the reviewer: `npm stage publish` extends `npm publish` (a tarball path works, `--tag`, `--access`, `--provenance` accepted), a failed OIDC exchange falls back to the `.npmrc` token, `npm view` of a missing package or version exits 1 with `E404`.

## Findings

### W1 [WARNING] An explicit `--tag latest` lets an older version take `latest`
**Where:** `scripts/release/pack.mjs` (npm-tag output), `.github/workflows/release.yml` (stage step)
**Problem:** npm only refuses to move `latest` to a lower version when the tag is implicit.
**Decision:** Fix now - a stable version passes no `--tag`; prereleases keep `next`. The runbook covers backports.

### W2 [WARNING] An expired `NPM_TOKEN` would break registry lookups that OIDC releases do not need
**Where:** `release.yml` `lookup()`
**Decision:** Fix now - lookups run with `NODE_AUTH_TOKEN=` (anonymous).

### W3 [WARNING] `release:version` could tag a version its dependents reject
**Where:** `scripts/release/version.mjs`
**Problem:** a bump outside a dependent's `@softure-ai/*` range fails the release gates after the tag exists. Measured in a scratch clone: `npm version -w` itself then fails on a registry 404 and leaves the tree half-bumped.
**Decision:** Fix now - the new version is computed with `semver.inc` and checked against every workspace's ranges before anything changes; a failing `npm version` restores the tree. Verified in a scratch clone: refused with the dependent named, tree clean.

### W4 [WARNING] Compiled test files passed the tarball check
**Where:** `release-rules.mjs` `TEST_FILE_PATTERN`
**Decision:** Fix now - `.test.(d.)?[cm]?[jt]sx?` with three new cases.

### S1 [SUGGESTION] String `exports`, subpath patterns, `main` and `types` were not checked
**Decision:** Fix now - all four handled and tested.

### S2 [SUGGESTION] GitHub Packages and the Release go out before the npm approval
**Decision:** Fix now (documented) - the runbook says how to remove them after rejecting a stage. A required-reviewer environment would add a second approval per release for little gain.

### S3 [SUGGESTION] Publishing the unpacked folder runs its lifecycle scripts
**Decision:** Fix now - `--ignore-scripts`.

### S4 [SUGGESTION] A tag on any branch could release
**Decision:** Fix now - the validate job fails unless the tagged commit is on `master`.

### S5 [SUGGESTION] `grep` pipe for `E404`
**Decision:** Fix now - `[[ "$output" == *E404* ]]`.

### S6 [SUGGESTION] Release notes of a stable version could start at a prerelease tag
**Decision:** Fix now - `git -c versionsort.suffix=- tag … --sort=-v:refname`.

### S7 [SUGGESTION] GitHub ignores pushes of more than three tags
**Decision:** Fix now (documented in the runbook).

### S8 [SUGGESTION] Test gaps: the `--tag` CLI path and its outputs, a missing dry-run package, nested conditions
**Decision:** Fix now - three CLI tests on a publishable copy of the template (exact `GITHUB_OUTPUT` lines), one nested-conditions case.

## Triage summary
Fixed: W1-W4, S1, S3-S6, S8. Documented: S2, S7. Deferred: -. Dismissed: -.

## Decisions (auto)
- No GitHub environment with required reviewers (S2) → the npm stage already waits for the owner's 2FA; GitHub-side cleanup after a rejection is documented instead.
