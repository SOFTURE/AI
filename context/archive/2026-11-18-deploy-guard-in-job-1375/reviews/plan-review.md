# Plan review: deploy-guard-in-job (#1375)

Verdict: approve.

- Default off and every new condition is an `||` fallback or guarded by the input, so a caller that does not opt in
  gets the same jobs, the same checkouts and the same outputs.
- The fold keeps "fail before the work": the guard steps precede the app's checkout, install and build in the work
  job; the issue accepts the runner start as the cost.
- Risk: the partial clone of the guard left in the workspace; covered by emptying it again before the checkout.
- Risk: `deploy: true` with the input would skip a job deploy and verify read; refused by input validation, tested.
- Risk: actionlint on the shared conditions (`github.job`, no foreign `needs`); CI runs actionlint.
