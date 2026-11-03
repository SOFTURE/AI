---
change_id: release-version-dev-ranges-982
status: in_progress
---

# Plan: devDependencies ranges and registry copies in release:version (issue #982)

Input: change.md, research.md (options 1–3). Complexity: small (one script pair, tests, docs).

## Phase 1: rules and tests (TDD)

Files: `scripts/release/release-rules.mjs`, `tests/repo/release-rules.test.ts`.

- `DEPENDENCY_FIELDS` gains `devDependencies`; the doc comment says why (npm links a dev dependency only when its
  range accepts the workspace version).
- New export `findRegistryWorkspaceCopies(lock: unknown, workspaceNames: Set<string>): string[]`: the sorted keys
  of `lock.packages` that end in `node_modules/<workspace name>` and are not `link: true`. A lockfile without a
  `packages` object gives `[]`.
- Tests: a devDependencies range that rejects the workspace version is reported with the field name; links pass,
  a nested registry copy and a top-level non-link are reported, non-workspace packages are ignored; the committed
  `package-lock.json` has no registry copy of a workspace package (repo guard).

## Phase 2: version.mjs and docs

Files: `scripts/release/version.mjs`, `scripts/release/README.md`.

- Read the lockfile before `npm version`; after it, compute copies before and after; any new one → `git checkout
  -- .`, fail naming each entry, the cause (a dependent's range) and `npm ci` to restore `node_modules`.
- README: the refusal lists devDependencies and the lockfile guard.

## Decisions (auto)

- Refuse rather than warn for devDependencies: a warning still leaves the broken tree the issue describes.
- The guard counts only entries the bump adds, so `release:version` blames the bump; the repo test covers entries
  already committed.
- No package CHANGELOG: only repository scripts change; the issue's closing comment says so.

## Progress

- [ ] Phase 1: rules and tests
- [ ] Phase 2: version.mjs and docs
