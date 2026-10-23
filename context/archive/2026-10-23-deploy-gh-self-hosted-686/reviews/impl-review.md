---
change_id: deploy-gh-self-hosted-686
verdict: approved
---

# Implementation review

Reviewed the diff of 15d477a, 6e41ffd and 1ffb719 against plan.md and the issue.

- The issue's first outcome is delivered: the five jobs that call `gh` (`cut`, `report`, `notes`, `cancel`, `record`)
  run "Set up the GitHub CLI" right after the runner check. A runner with `gh` is untouched (the step exits before
  anything else); one without it gets GitHub CLI 2.103.0 in `$RUNNER_TEMP`, on `$GITHUB_PATH`, with no `sudo`.
- The second outcome covers what cannot be installed: another OS or architecture, missing `curl`/`tar`, a failed
  download and a checksum mismatch each fail with an `::error::` that names the cause; nothing is put on `PATH` then.
- Security: the archive is verified against a SHA-256 pinned in the workflow (taken from the release's
  `checksums.txt`) before it is unpacked; the step reads no input, secret or token and interpolates nothing.
- Guard: `tests/repo/workflow-runners.test.ts` derives the jobs that call `gh` from their scripts and requires the one
  identical step second in exactly those; the script runs against a curated `PATH` (no machine `gh`) for every outcome,
  the success path with the pinned sum swapped for the test archive's. `deploy-workflows.test.ts` skips the step as it
  skips the runner check, so its step-order tests are unchanged.
- Portability: bash 3.2 constructs only; `sha256sum` with a `shasum -a 256` fallback for the macOS test job.
- Docs: README "Runner" names the jobs, the pin, the platforms, the need to reach `github.com`, and that an app's own
  `gh` steps install it themselves; CHANGELOG Unreleased entry.
- Gates: typecheck and lint (pre-commit) green; repository tests 673 passed. actionlint runs in CI (its download is
  not reachable from this session).

Verdict: approved, no changes.
