---
change_id: deploy-gh-self-hosted-686
status: done
---

# Research: gh on a self-hosted runner (issue #686)

## Where `gh` runs

| Workflow | Job | Calls |
| --- | --- | --- |
| `deploy-cut-release.yml` | `cut` | `gh api --paginate`, `gh release create`, `gh workflow run` |
| `deploy-report.yml` | `report` | `gh release view`, `gh release edit` |
| `deploy-release-notes.yml` | `notes` | `gh release view`, `gh release edit` |
| `deploy-cancel-run.yml` | `cancel` | `gh api --method POST …/cancel` |
| `deploy-integration.yml` | `record` | `gh api --method DELETE` (a ref) |

`deploy-app.yml`, `deploy-release-checks.yml`, `deploy-release-image.yml`, `blog-links.yml` and the composite action
`.github/actions/deploy` do not call `gh`.

## Options

1. **Install a pinned `gh` when missing** (the issue's first choice). A step right after the runner check: when
   `command -v gh` finds nothing, download `gh_<v>_linux_<arch>.tar.gz` from the cli/cli release, verify its SHA-256
   against a value pinned in the step, unpack it under `$RUNNER_TEMP` and add its `bin` to `$GITHUB_PATH`. Needs `curl`
   and `tar`, which the README already lists as runner prerequisites. No `sudo`. On hosted runners it is a no-op.
2. **Preflight only** (the issue's second choice): fail early with the list of missing tools. Readable, but the release
   still does not work on a bare runner.
3. **Replace `gh` with `curl` against the REST API.** Removes the dependency, but `--paginate`, `--generate-notes`
   (notes then generated notes) and `--jq` would need re-implementing without `jq`; a larger, riskier rewrite of five
   jobs that work today.

Chosen: option 1, with the clear failure of option 2 for what it cannot install (an unsupported OS or architecture,
missing `curl`/`tar`, a failed download, a checksum mismatch).

## Pin

GitHub CLI 2.103.0 (2026-10-21), from `gh_2.103.0_checksums.txt` of that release:

- `linux_amd64.tar.gz`: `fdd768eb70f6409f80fcfa9f3a1c0adf0fc98d827ab3ce0bed2ac22762c5d786`
- `linux_arm64.tar.gz`: `7f322df34e624d14f5ec0c4acb121fd6dfa14392fdbbd1066aa8e0a05ac3721e`

The archive unpacks to `gh_<v>_linux_<arch>/bin/gh`. macOS assets are `.zip` and need `unzip`; self-hosted macOS
runners are out of the issue's case, so the step refuses them with a message that says to install `gh`.

## Guarding it

`tests/repo/workflow-runners.test.ts` already holds every reusable job to the one shared runner check. The same file
can hold every job whose scripts call `gh` to the one shared setup step (second step, identical everywhere), and run
the step's script with a curated `PATH` (no real `gh`) and a fake `curl`: present `gh` → nothing; unsupported platform,
missing tool, failed download, wrong checksum → `::error::` naming the cause; a matching archive (the test swaps the
pinned sum for its own archive's) → `bin` added to `$GITHUB_PATH`.
