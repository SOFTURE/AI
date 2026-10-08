# Implementation review: analytics-channel-tagger-scope

Reviewed: the branch diff against plan.md (Phase 1, D1–D5) and plan-review.md (F1–F6). Verdict: **approve**.

## Against the plan

- D1: `targets` on `ChannelTaggerOptions` takes a list of absolute pathnames (normalised through `URL`, compared
  exactly with the target's `pathname`) or a predicate over copies of `{ target, source }`; only `=== true`
  tags; a throw logs `channelTagger.targets failed: <message>` and tags nothing; a bad list throws at creation.
- D2: the scope check runs after the navigation, own-parameter and channel checks (test: the predicate is not
  called for requests that would not be tagged).
- D3 + F1: `readOwnOrigin` is used only when `Host` equals the request URL's host; the scheme follows the first
  `X-Forwarded-Proto` value when it is http(s). Without `Host` the earlier behaviour holds (the internal-host
  test in `proxy.test.ts` is untouched and green).
- D4: `isNavigation` exported from `/proxy`; README §4 lists its header shapes, §12 the stripped-headers limit.
- D5, F2, F3: README §1 and §4, CHANGELOG added to the unreleased 0.1.9 entry; versions unchanged.

## Findings

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| R1 | Suggestion | The pathname rule first had a redundant alternative (`^\/\\` next to `^[/\\]{2}`). | Fixed before commit: one alternative covers `//host` and `/\host`. |
| R2 | Check | Open redirect through `Host` | None: the new origin is built from the request URL's own host, taken only when `Host` names it. |
| R3 | Check | `carry` unchanged | Yes; documented as unscoped. |

## Tests

`tests/tagger-scope.test.ts` (15 tests) was seen red before the code (10 failing), then green. Gates: typecheck,
lint, build and the full test suite (5034 passed) green on the branch.
