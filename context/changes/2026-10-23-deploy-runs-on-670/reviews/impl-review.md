---
change_id: deploy-runs-on-670
verdict: approved
---

# Implementation review

Reviewed the diff of bb21cbe, 5e0c491 and 17731d2 against plan.md and the issue.

- Every ask is covered: the `runs-on` input (string, default `'"ubuntu-latest"'`) on all nine workflows and
  `${{ fromJSON(inputs.runs-on) }}` on all 16 jobs; existing callers unchanged; the check refuses an object, an empty
  array, an empty label, a number and malformed JSON with an error naming `runs-on`; the README "Runner" section
  with Docker/buildx, `sudo` or Playwright deps, clean state, and the public-repository warning; the guard in
  `tests/repo/workflow-runners.test.ts` over every `workflow_call` workflow.
- Acceptance "a caller runs `deploy-release-checks.yml` with an explicit value": the e2e `checks` job, array form,
  added to the e2e paths. A value that is not JSON fails at GitHub's evaluation of `runs-on`, before any step; the
  README states that limit instead of claiming the check sees it.
- Security: the value reaches the script through `env:` only; the error line does not echo it.
- Portability: bash regex only, no `jq` or Node; the tests run it with `bash -e -c` (and on macOS in CI).
- actionlint 1.7.12 (the CI version) is clean on the workflows and the examples; repository tests 652 passed.

Verdict: approved, no changes.
