---
change_id: ui-query-nav-active-454
reviewed: 2026-10-13
verdict: approved
---

# Implementation review: ui-query-nav-active-454

Reviewed: the branch diff against plan.md, change.md and issue #454.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Drift from plan: one extra test file renders with the real `next/navigation` and `renderToStaticMarkup` (no mock); it fails on master with the issue's `Cannot read properties of null` and passes now. | Kept: it is the issue's own scenario. |
| 2 | Check | The hook results are widened by type annotation with a comment, no `eslint-disable`; plan review finding 2 resolved. | No change. |
| 3 | Check | Without a pathname the default link is `?`, not an empty `href`; plan review finding 1 resolved and tested. | No change. |
| 4 | Check | With `active` the links still keep the other parameters and drop `param` for `defaultId` (tested); `SegmentedNav` and `getQueryHref` untouched. | No change. |
| 5 | Check | Docs: README paragraph, the component comment and prop doc, CHANGELOG `## Unreleased` (no version bump, batched releases). | No change. |

Gates: see plan.md Progress.
