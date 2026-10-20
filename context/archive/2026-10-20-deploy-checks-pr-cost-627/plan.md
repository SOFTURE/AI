---
change_id: deploy-checks-pr-cost-627
status: archived
---

# Plan: a pull request's checks without a prepare job, and an opt-in static cache (issue #627)

Input: change.md, research.md. Complexity: small (one workflow, its tests, docs).

## Phase 1: the workflow (TDD)

Files: `tests/repo/deploy-workflows.test.ts`, `.github/workflows/deploy-release-checks.yml`.

1. Tests first:
   - `prepare` runs only with a tag or more than one unit shard (`if:`); `static` and `unit` run after a skipped
     `prepare` but never after a failed one; `unit`'s matrix falls back to `[1]`; the output `sha` falls back to
     `github.sha`;
   - `static` and `unit` start with the same input check as `prepare` (the step object is equal), before checkout;
   - the input step accepts `STATIC_CACHE_PATHS` (empty or paths) and refuses a path with `..` or an absolute one;
   - `static` restores and saves `inputs.static-cache-paths` with `actions/cache`, only when the input is set, keyed
     on the OS, the lockfiles and the commit, restoring by the lockfile prefix, before the install.
2. Workflow: anchor the input step in `prepare` (`&check-inputs`), alias it first in `static` and `unit`; the `if:`s,
   matrix and output fallbacks; the `static-cache-paths` input, its check and the cache step. Header comment.
3. actionlint 1.7.12 over the workflow and the example callers.

## Phase 2: docs

`tools/deploy/README.md` ("Release checks": jobs, the input table, a cache example), `tools/deploy/CHANGELOG.md`
`## Unreleased`.

## Decisions (auto)

- Keep `prepare` for a tag or several shards, skip it otherwise → the issue's second variant; the tag guard and the
  shard list stay where they are, and a pull request (no tag, one shard or none) pays nothing for it.
- One input step reused by YAML alias → the checks cannot drift between three jobs; actionlint and the runner both
  read aliases.
- Cache only for `static`, opt-in by paths → the issue's proposal; the caller owns `--cache`/`--incremental` in its
  own command, the workflow only keeps the files.
- Example caller and `init`'s `checks.yml` unchanged → an app's lint script decides whether `--cache` fits; README
  shows how.

## Progress

- [x] Phase 1: the workflow (8d2e25d)
- [x] Phase 2: docs (443fb70)

The new tests were red against the old workflow (13 failures). actionlint 1.7.12 passes over the workflow (aliases
included) and the example callers. Gates: typecheck, lint (with the language gate), `tests/repo/deploy-workflows.test.ts`
(207 passed).
