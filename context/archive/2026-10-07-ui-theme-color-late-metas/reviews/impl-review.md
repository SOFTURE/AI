# Implementation review: ui-theme-color-late-metas

Diff reviewed against `plan.md` (one phase).

## Plan drift

None. D1–D4 are in `getThemeBootScript`; README and CHANGELOG lines added.

## Correctness

- Old script with the new tests: 3 of 5 red (late meta in head, wrapped meta in body, meta after a switch to dark);
  the System and no-cookie tests are guards and pass on both. With the fix: 403/403 in `foundation/ui`.
- Mutation records from the parser while the document streams also hit the observer, so metas parsed after the script
  are recoloured even before `DOMContentLoaded`; the DCL pass stays as a fallback.
- The callback returns after one recolour per batch: `a()` recolours every meta, so one call covers all added nodes.
- No raw `<`, `>` or `/` was added inside string literals (the `writes no raw angle bracket or slash` test still
  passes); the selector uses only quotes and brackets.

## Tests

`tests/theme-boot-dom.test.ts` uses a fresh happy-dom `Window` per test and closes it; the script runs against that
window's `document` and `MutationObserver`, so observers do not leak between tests.

## Security

The script still embeds only validated values (cookie name, octet values, `isSafeTokenValue` colours) through
`toScriptLiteral`.

## Findings

| # | Finding | Severity | Decision |
|---|---|---|---|
| 1 | A page-lifetime observer on the whole subtree runs its callback on every DOM insertion. | Suggestion | Kept: the callback inspects only element nodes added in that batch and stops at the first match; no layout reads. |
| 2 | A meta whose `content` React rewrites in place is not caught. | Suggestion | Out of scope (plan); Next replaces metas on navigation, and the switch recolours at click time. |

Verdict: approve. Gates: typecheck, lint, test, build.
