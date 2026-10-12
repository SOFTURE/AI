---
change_id: deploy-release-checks
reviewed: 2026-10-12
verdict: approved
---

# Implementation review: deploy-release-checks

Checked the diff (`81d01cc..HEAD`) against change.md, plan.md and issue #406.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Critical | The optional `build` job inside `deploy-release-checks.yml` asked for `packages: write`. GitHub refuses to start a called workflow whose job asks for more than the caller grants, skipped or not, so `examples/checks.yml` (`contents: read`) could never run. | Fixed in `2a42c92`: the build is `deploy-release-image.yml`, called by the deploy caller with `ref: needs.checks.outputs.sha`; the checks read only. |
| 2 | Warning | The tag guard and the jobs must check the same commit. | Holds: `prepare` resolves the SHA once and every checkout uses `needs.prepare.outputs.ref`; a test runs the guard in a real repository. |
| 3 | Check | No input reaches a script by interpolation; commands run as `bash -e -o pipefail -c "$VAR"`. | Guarded by the shared test and a dedicated one. |
| 4 | Check | `timeout-minutes` numeric on every reusable job (`ci-workflows.test.ts`). | Holds. |
| 5 | Check | actionlint 1.7.12 over every workflow, the five example callers and the README snippet. | Clean. |

Verdict: approved after the fix.
