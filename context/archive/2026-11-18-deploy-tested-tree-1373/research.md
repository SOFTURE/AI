# Research: deploy-tested-tree (#1373)

## What exists

- `deploy-release-checks.yml`: `prepare` (tag guard, shards), `static`, `unit`; all `contents: read`. `unit: false`
  plus `static: false` is refused ("nothing would run"), so the fail-fast pipeline's `unit` call cannot just pass
  `unit: false`; that job has to be skipped instead.
- `deploy-cancel-run.yml` shows the pattern for a job that only calls the API: runner check, "Set up the GitHub CLI",
  one script. `tests/repo/workflow-runners.test.ts` requires those shared steps and lists every job that calls `gh`.
- `tests/repo/deploy-workflows.test.ts` runs step scripts with `runScript` and stub binaries in `PATH`.

## The GitHub API (checked against SOFTURE/AI)

- `GET repos/{r}/commits/{tag}` resolves a tag (annotated too) to its commit `.sha`.
- `GET repos/{r}/pulls?state=closed&base={branch}&sort=updated&direction=desc` lists merged pull requests with
  `merged_at`, `merge_commit_sha`, `head.sha`. Sorting by `merged_at` picks the last one.
- `GET repos/{r}/compare/{a}...{b}` `.status`: `ahead` or `identical` when `a` is an ancestor of `b`.
- `GET repos/{r}/git/trees/{sha}?recursive=1`: every blob with mode, sha and path, `.truncated` when too large
  (SOFTURE/AI: 9053 entries, not truncated). Comparing two trees this way works for merge, squash and rebase merges
  alike and needs no checkout (and no credentials for a lazy fetch of a deleted head branch).
- `GET repos/{r}/commits/{sha}/check-runs?filter=latest`: the newest run per name, `status` and `conclusion`
  (`skipped` for area-gated jobs); matrix names such as `unit and repository tests (1/4)` make a glob useful.
- Permissions: `contents: read` (commits, compare, trees), `pull-requests: read`, `checks: read`.

## Why the tree of the head is enough

A pull request's checks run on the merge of its head into the base at that time. If the base then held code the head
lacked, that code is also on the release branch, so the tag's tree differs from the head's and the answer is
`"false"`. Equal trees outside the ignored prefixes mean the tag's code is what the checks ran on.
