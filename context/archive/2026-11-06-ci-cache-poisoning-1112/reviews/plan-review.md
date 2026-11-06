# Plan review: ci-cache-poisoning-1112

Verdict: approved.

- The plan acts on the exact cause the local CodeQL run shows (the checkout `ref` named `ref`), and it is measured by
  the same query before and after.
- No behaviour change: the value written is the same, only its name changes; the workflow's public inputs and the
  `sha` output stay, so callers (`tools/deploy/examples`, generated apps pinned to master) are unaffected. The output
  `ref` is internal to the workflow (a job output, not a `workflow_call` output).
- The trust argument is real, not only a rename: without a tag the caller's own commit, with a tag a commit verified
  on the release branch. The plan records it in a comment.
