# Research: config-push-scope-since

## Findings

- `tools/config/src/cli/context-only-push-command.ts`: `listPushedFiles` resolves `@{push}` and diffs it with
  `HEAD` as trees. The bin entry passes no arguments.
- `tools/config/src/cli/merge-push-scope-command.ts`: `classifyRange` takes the remote from `@{push}`'s abbreviated
  name, finds the main ref on it (`findMainRef`), lists the branch's own commits with
  `rev-list --parents HEAD ^@{push} ^<main>`, and diffs `@{push} HEAD` for the incoming full-suite files.
  `runMergePushScope` parses `<mode> [-- <cmd>]`.
- A `pull_request` checkout (`actions/checkout`) checks out `refs/pull/N/merge`, a synthetic merge of the PR into the
  base: its tree is not the pushed head. A CI job that uses `--since` checks out the pull request head
  (`ref: ${{ github.event.pull_request.head.sha }}`) with enough history (`fetch-depth: 0`) and the base branch on
  `origin`.
- `git rev-parse --verify --quiet <rev>^{commit}` fails for an unknown commit and for the all-zeros sha, which covers
  the "force push / new branch" case without a special case.
- The CI side (point 3: which commit to pass) belongs to the adopting app's workflow; the package documents the
  recipe (a job reads the head sha of the latest successful run of its workflow for the PR, e.g. with
  `gh run list --workflow <file> --branch <head> --status success --json headSha`).

## Options

1. Parse `--since` in each bin and thread a `since` value into the range functions (chosen: smallest change, one
   code path for both sources).
2. A new bin for CI: duplicates the classification.
