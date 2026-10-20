---
change_id: deploy-checks-pr-cost-627
---

# Research: the cost of a pull request's checks (issue #627)

## Where it happens

- `.github/workflows/deploy-release-checks.yml`: `prepare` (input checks, optional tag checkout, commit guard;
  outputs `sha`, `ref`, `shards`) → `static` and `unit` (`needs: prepare`). Without a tag `prepare` only validates
  the inputs and echoes `github.sha`; the shard list is `[1..shards]`.
- `tests/repo/deploy-workflows.test.ts`, `describe("deploy-release-checks.yml (issue #406)")`: runs the input step's
  script with every input, the commit guard against a scratch repository, and pins the jobs' shape.
- Callers: `tools/deploy/examples/checks.yml` (pull requests, no tag), the `checks` job of a deploy caller (README,
  "Release checks", always a tag), `init`'s generated `checks.yml` (same as the example).

## Facts that shape the fix

- A job skipped by its `if` is not billed. A job whose `needs` was skipped is skipped too, unless its `if` uses a
  status function (`!cancelled()`), so `static`/`unit` need `!cancelled() && needs.prepare.result != 'failure'`.
- `on.workflow_call.outputs.<id>.value` may read `github`, so `sha` can fall back to `github.sha`.
- GitHub Actions accepts YAML anchors and aliases (2025), and actionlint 1.7.12 (the CI pin) checks them: the input
  step can be written once and reused in `static` and `unit` instead of copied.
- The matrix needs a list; `needs.prepare.outputs.shards || '[1]'` covers a skipped `prepare` when `shards` is 1.
  More shards keep `prepare` (it builds the list); a pull request's caller runs one shard or none.
- `actions/cache@v6` is the current major; its post step saves only when the job succeeded and the key is new.
  A pull request reads caches of its own ref and of the base branch.
- `tsc --incremental` writes `tsconfig.tsbuildinfo` (or `tsBuildInfoFile`), `eslint --cache` writes `.eslintcache`;
  both are invalidated by content, so a stale restore costs nothing but a cold run.
