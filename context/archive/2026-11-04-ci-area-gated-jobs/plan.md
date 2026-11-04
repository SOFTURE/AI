# Plan: ci-area-gated-jobs

## Phases

1. `scripts/ci/affected.mjs` (pure `getAffectedAreas`, `getAreas`, `findRuntimeWorkspaces`, CLI writing
   `$GITHUB_OUTPUT`); `changes` job in `ci.yml` and `e2e.yml` with `pull-requests: read`; `needs` and `if` on the
   area jobs; repository test `tests/repo/ci-affected.test.ts` (areas per changed file, shared files, unknown files,
   workflow wiring, gates that always run); `AGENTS.md` sentence. Gates: typecheck, lint, `tests/repo`.

## Decisions (auto)

- The GitHub API instead of a deep `git` fetch: no history to fetch, and the PR file list is exact.
- Shipped dependencies only for the closure; a development dependency is covered by the `test` job.
- The `changes` job fails loudly (a red run) on a malformed manifest instead of skipping areas; an API failure runs
  every area.
- The test, static, build and actionlint jobs stay ungated: they are the gates of `lefthook.yml`.

## Progress

- [x] p1 e7662a2: `scripts/ci/affected.mjs`, `changes` job in `ci.yml` and `e2e.yml`, area conditions, `tests/repo/ci-affected.test.ts`, `AGENTS.md`; repository tests 839 passed.
