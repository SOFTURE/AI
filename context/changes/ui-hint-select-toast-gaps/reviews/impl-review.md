# Implementation review: ui-hint-select-toast-gaps

Reviewed: commit `d83ed3c` (code and tests) and the docs commit, against `plan.md`, `change.md` and issue #163.
Verdict: **approved**, no open findings.

## Plan conformance

| Point | Decision | Where | Evidence |
|---|---|---|---|
| 1 text-transform / letter-spacing | D1 | `hint.tsx` bubble classes; `--tracking-normal` in `build-css.mjs` | `hint.test.tsx` "resets text transform…"; `styles.test.ts` guard (was red on `sft:tracking-normal` until the theme value existed) |
| 2 no path without JavaScript | D2 | `hint.tsx` `useIsHydrated`, `BUBBLE_BEFORE_HYDRATION` | server markup tests (styled and unstyled), client test; Chromium with JavaScript off and the compiled `styles.css`: hidden at rest, visible on hover and on focus |
| 3 trigger gap | D3 | `resolveBubblePlacement({ gap })`, `Hint triggerGap` | placement test (244 → 242 px with `gap: 8`), component test with measured rects |
| 4 Escape | D4 | JSDoc and README | — |
| 5 Select re-measure | D5 | `select.tsx` capture listeners for `animationend` / `transitionend`, own subtree ignored | test seen red on the old `select.tsx` (`144px` instead of `244px`), chevron `transitionend` does not re-measure |
| 6 ToastHost attributes | D6 | `ToastRegionProps`, `pickRegionAttributes` | markup tests: `id` and `data-testid` forwarded, `role` cannot be replaced (typed and at runtime) |
| 7 text line height | D7 | `--text-*--line-height` in `build-css.mjs` | `styles.test.ts`: each used size compiles to `line-height: var(--tw-leading, …)`; `.sft\:text-sm` = `calc(1.25 / .875)` |

Every new test was seen red before the code (Hint and Select also re-checked against the old sources).

## Findings

| # | Severity | Finding | Decision |
|---|---|---|---|
| R1 | Suggestion | Plan F3 asked to list what D7 changes. Fixed-height elements keep their size: buttons (`h-8/10/12`), inputs (`h-10`), select options (`min-h-10`). Text whose height follows the new line height (about 1 px less than an inherited 1.5 at `text-sm`): card subtitle, title, stat values and labels, empty-state description, `FormError`, field labels and group titles, modal title and subtitle, segmented control segments and legend, switch label, toast. This matches Tailwind's own `text-*`, which is what the issue asked for. | Accepted; recorded here for the release notes. |
| R2 | Suggestion | The pre-hydration bubble uses its absolute fallback (`bottom-full`, `mb-2`), not the measured fixed placement, so near a viewport edge it can be clipped until React runs. | Accepted: it is the no-JavaScript fallback the issue asked for; after hydration placement is measured as before. |
| R3 | Suggestion | `pickRegionAttributes` filters at runtime as well as by type. | Kept: an untyped (JavaScript) caller must not replace the live region's role. |

## Gates

`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`: green (see the Progress SHAs).
