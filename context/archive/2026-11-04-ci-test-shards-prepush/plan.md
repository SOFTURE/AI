# Plan: ci-test-shards-prepush

## Phases

1. `ci.yml` test job as a 4-shard matrix (`fail-fast: false`); `scripts/test-changed.mjs` and `npm run test:changed`;
   `lefthook.yml` pre-push runs it; `AGENTS.md`, `macos.yml` comment; repository test `tests/repo/test-gates.test.ts`
   (shard numbering and command, fail-fast off, the hook command, `findFullSuiteFile`). Gates: typecheck, lint,
   `tests/repo`.

## Decisions (auto)

- Four shards: about 6 to 8 minutes each against 25 today; more shards add an `npm ci` each for less gain.
- `maxWorkers` stays at 50%: the database tests share one Postgres per runner.
- Reuse the preset's `FULL_SUITE_PATTERNS` instead of a second list.

## Progress

- [x] p1 1c4259c: 4-shard test matrix in `ci.yml`, `scripts/test-changed.mjs` as the pre-push gate, `AGENTS.md`, `tests/repo/test-gates.test.ts`; repository tests 850 passed.
