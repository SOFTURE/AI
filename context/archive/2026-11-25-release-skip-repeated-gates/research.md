# Research: release-skip-repeated-gates

## Findings
- `release.yml` job `validate`: on a tag ref, step `Gates` runs `npm run typecheck`, `npm run lint`, `npm test` on one
  runner (20 to 31 minutes; the suite alone is about 2600 s of test time). Then build, pack, upload.
- `ci.yml` runs on `push` to `master`: `static` (typecheck + lint + language) and `test` in 4 shards with the whole
  suite (its `TEST_PATHS` is empty for every event but `pull_request`), with the same Postgres and Chrome setup.
  Its run conclusion is `success` only when every job passed (skipped area jobs do not fail it).
- `ci.yml` concurrency `ci-<ref>` with `cancel-in-progress: true`: a quick second merge cancels the first master run,
  so a tagged commit may have only a cancelled run. The fallback (run the gates) covers it.
- The Actions API lists a workflow's runs filtered by `head_sha`, `event` and `branch`
  (`GET /repos/{repo}/actions/workflows/ci.yml/runs`); it needs `actions: read`.
- On a tag ref (pushed tag or `workflow_dispatch` on the tag), `git rev-parse HEAD` after checkout is the tagged
  commit; the job already checks that commit is on master.
- `tests/repo/release-workflow.test.ts` pins the test environment lines in both workflows; they stay.

## Options
1. Skip the gates on a successful master `ci.yml` run of the same commit, wait while one is in progress, else run
   them (chosen: same verification, fallback keeps today's behaviour).
2. Shard the release gates like `ci.yml` (still repeats the work per tag; more jobs per release).
3. Drop the gates from releases (rejected: a tag could point at an untested commit).
