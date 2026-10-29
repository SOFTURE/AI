---
change_id: config-merge-push-scope-868
status: in_progress
---

# Plan: merge-only pre-push runs the related tests (issue #868)

Input: change.md, research.md. Complexity: small (one bin, its tests, preset, docs).

## Phase 1: `softure-merge-push-scope` (TDD)

Files: `tools/config/src/cli/merge-push-scope-command.ts`, `tools/config/src/cli/merge-push-scope.ts`,
`tools/config/package.json` (bin), `tools/config/tests/merge-push-scope-command.test.ts`.

- `getMergePushScope(cwd, runGit?)` returns `{ scope: "merge", branchFiles }` or `{ scope: "full", reason }`.
- `full` for: no upstream, no main branch on the remote, nothing new, a non-merge commit outside `context/`, a merge
  parent not on the main branch, no merge commit, an incoming file on the full-suite list, any git error.
- Full-suite list: migrations (`migrations/`, `migration/`, `*.sql`, `prisma/`, `drizzle/`), manifests and lockfiles
  (`package.json`, `package-lock.json`, `npm-shrinkwrap.json`, `yarn.lock`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`,
  `bun.lock`, `bun.lockb`, `.npmrc`, `.nvmrc`, `.node-version`), test setup (`vitest.*`, `vite.config.*`,
  `jest.config.*`, `playwright.config.*`, setup files), tool config (`tsconfig*.json`, `eslint.config.*`,
  `.eslintrc*`, `lefthook*.yml`, `next.config.*`, `babel.config.*`, `.babelrc*`, `postcss.config.*`,
  `tailwind.config.*`, `.env*`). App patterns: `package.json` → `"@softure-ai/config": { "fullSuiteOn": [globs] }`.
- CLI: `is-merge` (exit 0 for merge), `is-full` (exit 0 for full), `related [-- <command…>]` (runs
  `npx vitest related --run --passWithNoTests <files>` or the given command with the files appended; nothing to run
  when the branch changes no file or the scope is full).
- Tests: real git repositories with a bare remote, like the context-only tests.

## Phase 2: preset

`tools/config/presets/lefthook.yml`: `test` gets the second `skip` (`npx softure-merge-push-scope is-merge`); new job
`test-related` after it, `skip: - run: npx softure-merge-push-scope is-full`. `presets.test.ts` updated; a test runs
`lefthook run pre-push` in a scratch app to prove the skip semantics of lefthook itself.

## Phase 3: docs

`tools/config/README.md` (pre-push table, the third speed, override list, how to use a different test command),
`tools/config/CHANGELOG.md` `## Unreleased` with the migration for an app.

## Decisions (auto)

- A new job instead of changing `test.run`: an app's override of `test` keeps working.
- The main branch from `context/workflow.json` first: SOFTURE apps already declare it there.
- App patterns in `package.json`, not CLI flags: one place both conditions read.
- No version bump: the coordinator releases.

## Progress

- [ ] Phase 1
- [ ] Phase 2
- [ ] Phase 3
- [ ] Implementation review
