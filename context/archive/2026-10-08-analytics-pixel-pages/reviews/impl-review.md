# Implementation review: analytics-pixel-pages

Reviewed: the branch diff against plan.md (Phase 1, D1–D5) and plan-review.md (F1–F6). Verdict: **approve**.

## Against the plan

- D1: `pages` takes 1 to 32 pathnames or a predicate (`src/options.ts`); the endpoint compares a list with the
  `Referer`'s `pathname` and calls a predicate with a copy of the URL (`isStepPage` in `src/server/endpoint.ts`).
- D2: `pages` on a `beacon` or `server` step is a startup error on `steps[i].pages`.
- D3: no `Sec-Purpose` filter, as decided.
- D4: a throwing predicate logs `funnel.steps["<id>"].pages failed: <message>` and counts nothing; the answer is
  the GIF.
- D5, F2, F3: README (step description, option row, example, prefetch warning) and CHANGELOG 0.1.9.
- F1: `package.json`, `module.json` and the manifest in `src/index.ts` are 0.1.9 (the manifest test caught the
  third copy, which the plan did not name).

## Findings

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| R1 | Warning | A listed pathname with non-ASCII characters (`/café`) never matched: `URL.pathname` is percent-encoded. | Fixed: each listed path is normalised through `URL` when the options are parsed; test "compares a listed pathname with the page's encoded pathname". |
| R2 | Suggestion | `//host/` passed the "starts with /" rule but is a protocol-relative URL, not a pathname. | Fixed: refused with the same message; covered in the options test. |
| R3 | Suggestion | A predicate returning a truthy non-boolean (a JavaScript app without types) would count. | Fixed: only `=== true` counts. |
| R4 | Check | Existing behaviour without `pages` | Unchanged: the endpoint and wire tests pass untouched, plus an explicit test. |

## Tests

`tests/pixel-pages.test.ts` (6 tests) was seen red before the code (4 failing), then green. Gates: typecheck, lint,
test, build green on the branch.
