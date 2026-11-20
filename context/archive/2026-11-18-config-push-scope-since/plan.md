# Plan: config-push-scope-since

## Approach

Both range functions take an optional `since`. Without it nothing changes. With it, the base of the range is
`<since>` verified as a commit (unknown: "run everything"), and `merge-push-scope` reads the main branch on `origin`.
Both bins parse `--since <rev>` and `--since=<rev>`; a missing value or an unknown option is a usage error (exit 2,
which also never skips a lefthook job). Release as `@softure-ai/config@0.1.7`.

## Phases

### Phase 1: `--since` in both bins (TDD)

- `context-only-push-command.ts`: `listPushedFiles(cwd, runGit, since?)`, `isContextOnlyPush(cwd, runGit, since?)`,
  new `runContextOnlyPush(argv, { cwd, runGit, log })` returning the exit code; `context-only-push.ts` calls it.
- `merge-push-scope-command.ts`: `getMergePushScope(cwd, runGit, since?)`; under `since` the remote is `origin`
  and the range refs are `<since>` instead of `@{push}`; `runMergePushScope` parses `--since` before `--`.
- Tests (real git repositories, as the existing ones): context-only and not context-only since a commit, an unknown
  and all-zeros `--since`, `--since=` form, usage errors; merge-push-scope `is-merge` since a commit on a detached
  checkout without upstream, new code since the commit is `full`, unknown commit is `full`, `related --since X -- cmd`.
- Done when: `npx vitest run tools/config` green.

### Phase 2: docs, version

- README: a section "In CI" with the options and a workflow recipe (head checkout, fetch-depth, last green head sha).
  CHANGELOG 0.1.7; version 0.1.7 in `package.json` and the lockfile entry only.
- Done when: repo tests and the language gate green.

### Phase 3 (after merge): release

- `auto-release.yml` with `config` publishes 0.1.7; `npm view @softure-ai/config version` prints 0.1.7.

## Progress

- [x] Phase 1: `--since` in both bins (9f8b1b26; `npx vitest run tools/config`: 133 tests green, 17 new)
- [x] Phase 2: docs, version (605ea426; README "The same checks in CI", CHANGELOG 0.1.7, `tests/repo` green)
- [x] Phase 3: release 0.1.7 (after the merge: `auto-release.yml` with `config`) — done: tag `config@0.1.7` on merge f99ab590 (#1377), on npm

## Decisions (auto)

- Remote under `--since` is `origin`, as the issue proposes; no `--remote` option until an app needs one.
- Usage errors exit 2 in both bins.
