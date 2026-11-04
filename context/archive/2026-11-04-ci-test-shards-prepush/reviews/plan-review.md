# Plan review: ci-test-shards-prepush

Verdict: approved.

- CI coverage is unchanged: every test still runs on every pull request, only split.
- The pre-push narrowing errs towards the full suite (shared files, no base, git errors); the full suite still gates
  the merge in CI.
- Risk: a test that depends on a file it neither imports nor lists (outside `tests/repo`) is caught in CI instead of
  before the push; accepted.
