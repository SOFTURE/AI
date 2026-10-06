# Implementation review: charts-palette-guard

Date: 2026-10-06 · Verdict: approved, two plan drifts recorded, no open finding

Checked the diff against plan.md (both phases), change.md, research.md §4 (every token value), the plan review's
fixes, `@softure-ai/ui/testing` (the helpers it builds on) and the lessons on unseen-green tests.

## Plan drift

| # | Drift | Why | Decision |
| --- | --- | --- | --- |
| D1 | Both phases landed in one commit. | `SERIES_SLOTS` now comes from the token list (six), so phase 1 alone left `styles.css` (three slot classes) and `primitives.test.tsx` red; a commit with a red gate is not allowed. The red-then-green evidence of both phases was still taken: phase 1's tests failed on the missing modules, the default-palette guard failed on CH-2's palette (missing slots 4-6, and the green/amber collision is pinned by its own test) before the tokens changed. | Accepted. |
| D2 | `examples/next-app/package-lock.json` is unchanged (plan review #1 asked to refresh it). | npm keeps a `file:` entry's metadata as recorded, and the lock is not stale in a way `npm ci` rejects: `npm ci` in the example (after `npm run build`) installs the packed charts and ui 0.1.6 at the top, which satisfies charts' new `^0.1.6`, and `node_modules/@softure-ai/charts/dist/testing/` is there. | Accepted: verified, nothing to commit. |

## Findings

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Suggestion | With `grounds: []` the contrast pass has no pairs, so a missing series token is not reported (the distance pass skips it silently). | Accepted as is: an empty ground list is a caller's explicit choice to skip contrast; the default and every documented use pass grounds. |
| 2 | Suggestion | The expected distances in "checks an app's own token names" were read from a run of the helper, not from an independent tool. | Accepted as is: the distances are ui's `findColorCollisions`, oracle-tested in CH-3 against reference values; this test pins the wiring (token names, grounds, threshold, both schemes), and the CH-2 case pins research §1's independent measurement. |

## Verified

- Every value in `DEFAULT_THEME` matches research §4; slot 1 is unchanged, so the `/chart` e2e (it reads slot 1 from
  `DEFAULT_THEME`) is unaffected.
- `checkSeriesPalette()` is green on the defaults, red on CH-2's palette with exactly the three collisions of
  research §1, and reports low contrast, missing and unreadable tokens per ground.
- `@softure-ai/charts/testing` builds to `dist/testing/index.{js,d.ts}`; the root entry does not import it (test).
- `SERIES_SLOTS`, the token list, ui's `SCHEME_TOKENS` and the `styles.css` slot classes agree (test).
- Gates: typecheck, lint (with the language gate), build and the full test suite green.
- No gap found for the charts follow-up roadmap.
