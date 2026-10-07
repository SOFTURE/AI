# Plan review: ui-theme-color-late-metas

Reviewed `plan.md` against `change.md`, issue #201 and `foundation/ui/src/theme/theme-cookie.ts`.

| # | Finding | Severity | Decision |
|---|---|---|---|
| 1 | The issue proposes disconnecting the observer on `load`; client scripts that hoist metas can run after `load` (async scripts, dev mode), so a bounded observer would leave the bug in place on slow pages. | Warning | Accepted as D1: the observer lives with the page; its callback only inspects added elements. |
| 2 | Using the boot-time choice `t` in the observer would undo a later switch for metas inserted after it (client navigation). | Warning | Accepted as D2: read `data-theme` at mutation time. |
| 3 | The existing fake document has no `getAttribute` on `<html>`; the old DCL test would break silently or throw inside `try`. | Suggestion | Accepted: extend the fake; the DCL test asserts the colour, so a swallowed throw would fail it. |
| 4 | A test that only checks the meta's final colour passes on the old script if the inserted meta already carries that colour. | Warning | Accepted: each late meta is inserted with the opposite colour of the expected one where the test is about recolouring. |
| 5 | Observer callback setting attributes could re-trigger itself. | Suggestion | Not an issue: only `childList` is observed (D3), plus the equality check. |

Verdict: ready to implement.
