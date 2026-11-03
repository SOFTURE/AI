---
change_id: release-version-dev-ranges-982
title: "release:version checks devDependencies ranges and refuses registry copies of workspaces (issue #982)"
status: archived
roadmap_item: null
issue: [982]
branch: claude/project-thread-rtwib0
created: 2026-11-03
updated: 2026-11-03
archived_at: 2026-11-03
---

## Intent

Close [issue #982](https://github.com/SOFTURE/AI/issues/982): a bump that a dependent's `devDependencies` range no
longer accepts passes `release:version`, and `npm version -w` then fetches the old version from the registry into
`<dependent>/node_modules/@softure-ai/<pkg>`, writes it into `package-lock.json` and unlinks unrelated workspace
symlinks. After this change:

1. `release:version` refuses such a bump before anything changes, with the same "widen their ranges" message;
2. it refuses, and restores the tree, when `npm version` still leaves a lockfile entry of a workspace package that
   is not a link (a copy resolved from the registry);
3. a repository test fails when the committed lockfile holds such an entry.

## Context

Labels: `bug`. Files: `scripts/release/release-rules.mjs`, `scripts/release/version.mjs`,
`scripts/release/README.md`, `tests/repo/release-rules.test.ts`, `tests/repo/release-version.test.ts` (or a new
repo test). Found by the batch-release thread that is running now; this change merges after that release.
Checked first: no branch or pull request for #982; master (1f92ca9) has no devDependencies range that rejects its
workspace version, and its lockfile has no nested `@softure-ai/*` copy, so the stricter rules are green on master.

## Constraints

- No package code and no version bump: repository tooling only (so no package `CHANGELOG.md` entry).
- `release:pack` shares `checkInternalRanges`; it learns `devDependencies` too (a tag whose workspace would fetch a
  dev copy from the registry runs its gates against the published copy).
- bash/macOS rules do not apply (Node only). English-only code.

## Notes

- Framing: skipped. The issue names the cause (`DEPENDENCY_FIELDS` lacks `devDependencies`) and both remedies.
