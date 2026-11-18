# Plan: config-since-1371

One phase, test-after on the existing git-repository fixtures.

## Phase 1: --since

- `src/cli/context-only-push-command.ts`: `listPushedFiles`/`isContextOnlyPush` take `since`; `parseSinceOption`.
- `src/cli/context-only-push.ts`: parse the option, usage error exits 2.
- `src/cli/merge-push-scope-command.ts`: `findRangeStart` (`@{push}` or the `--since` commit with `origin`),
  `getMergePushScope(cwd, runGit, since)`, `parseScopeOptions` before `--`.
- Tests, README, CHANGELOG, version 0.1.7.

Done when: `npx vitest run tools/config` green, typecheck and lint green, CI green.

## Decisions (auto)
- The remote with `--since` is fixed to `origin` (every CI checkout's name); no `--remote` option until an app needs it.

## Progress

### Phase 1: --since

#### Automated
- [x] 1.1 Option on both bins, tests (129 passing in tools/config)
- [x] 1.2 README, CHANGELOG, 0.1.7
