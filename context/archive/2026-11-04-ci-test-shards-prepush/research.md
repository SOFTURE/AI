# Research: ci-test-shards-prepush

- Vitest 5.0.3 supports `--shard=<index>/<count>` (splits test files) and `--changed <ref>` (test files changed since
  the ref plus those importing a changed file; also files not yet committed). `forceRerunTriggers` makes a changed
  `package.json` or Vitest config run everything.
- `tools/config/src/cli/merge-push-scope-command.ts` exports `FULL_SUITE_PATTERNS`, the list of files whose change
  can break tests that do not import them; the preset's merge-push scope already uses it.
- Per-file times of the master run 41847714418 (job log): total 2612 s; top files `tools/marketing-kit/tests/
  screenshot.test.ts` 168 s, `foundation/db/tests/adopt.test.ts` 109 s, `tools/deploy/tests/server-files.test.ts`
  68 s. With 4 shards of 2 workers each the expected wall time is about 6 to 8 minutes plus `npm ci`.
- The repository tests read files instead of importing them, so `--changed` would miss them: they always run (about
  10 s).
