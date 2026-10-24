---
change_id: analytics-tagger-invalid-referer-702
verdict: approved
---

# Implementation review

Reviewed the diff of 9f02250 against plan.md and issue #702.

- Correctness: `tag()` returns `null` before building `source` when no channel was read, and `source` is built
  behind one `URL.canParse` guard, so no header value can throw. For a parsable Referer `source` is the same URL as
  before in both branches (rename and not); the predicate is still not asked about an untagged request (tested).
- Tests: the issue's case (a port that is not a number) on a listed and an unlisted path, with no targets, a list
  and a predicate; the legacy-name rename with the same Referer still redirects to `?ref=`. The new test failed on
  master with `TypeError: Invalid URL` and passes now.
- Compatibility: bug fix only; CHANGELOG `Unreleased` entry, nothing for the app to change.
- Gates: typecheck, ESLint, the language gate and the analytics tests (178) pass locally.

Verdict: approved.
