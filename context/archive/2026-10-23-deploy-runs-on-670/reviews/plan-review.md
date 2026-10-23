---
change_id: deploy-runs-on-670
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and the issue.

- Scope matches the issue's five asks: the input with the JSON default on all nine workflows, no change for existing
  callers, a check that names `runs-on`, the README section with the runner requirements, a repository guard. Per-job
  runners stay out.
- Acceptance: "bad input fails in the input check" holds for every JSON value; a value that is not JSON cannot reach
  any step (GitHub evaluates `runs-on` first). The README says so plainly instead of claiming more. The real-run
  acceptance is the e2e `checks` job with the array form.
- Security: the value reaches the script through `env:` only, and the error line does not echo it.
- Portability: the check is bash 3.2 regex only, no `jq`, no Node, so it runs on a bare self-hosted runner and in the
  macOS test job.
- Tests: the guard covers every `workflow_call` workflow, so a new reusable workflow is held to the same rule.

Verdict: approved, no changes.
