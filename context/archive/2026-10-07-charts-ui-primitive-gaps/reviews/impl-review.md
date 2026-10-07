# Implementation review: charts-ui-primitive-gaps

Reviewed: the branch diff against `plan.md` (D1–D9, phases 1–2) and `reviews/plan-review.md` (F1–F6), issue #197
point by point, and the gates. Mode: autonomous (the thread decides).

Verdict: **approve** (one finding fixed in the review, none open).

## Plan conformance

| Issue point | Plan | Delivered | Test |
| --- | --- | --- | --- |
| 1. Primitive options | D1–D3 | `tone`, `slot`, `strokeWidth`, `opacity`, `className`, `style`, `data-*` on every line; `ChartFlag` `variant`/`size`, `ChartPin` `variant`/`size`/`ring`; optional `xPercent` | `charts/tests/primitives.test.tsx` "line options", "flag and pin options", "styles.css" |
| 2. Axes | D4–D6 | `numberAxisTicks`, `sublabel`, `narrow`, `TimeAxis` second row; one internal builder | "numeric axis ticks"; the existing `timeAxisTicks` tests unchanged and green |
| 3. Theme cookie domain | D7 + F1, F4 | function or `{ apex }` `cookieDomain`, `getThemeCookieDomain`, domain validation | `ui/tests/adoption-gaps-197.test.tsx` |
| 4. Message errors | D8 | `MessageActionResult`, props as a union on `getErrorMessage` | same file, "ActionForm with message errors" |
| 5. Button | D9 | `className` on `Button`/`ButtonLink`/`ButtonAnchor`, `ButtonAnchor` | same file, "Button className and ButtonAnchor" |

Plan-review bindings: F3 (package class kept, app class appended) is asserted by the exact-markup tests; F5 (one
builder) holds in `axis-ticks.ts`; F6 (sizes from tokens) holds, `tests/architecture.test.ts` green with
`--sft-chart-tone` added as a local property.

## Findings

### R1 (Suggestion, fixed): `ActionFormOptions` was a local interface inside an exported type

An app wrapping `ActionForm` could not name the shared options. Exported.

## Checks

- Default markup of every changed primitive is byte-identical (tests "keep today's markup", the existing pin, flag
  and axis tests).
- New tests seen red: the `ThemeSwitch` domain tests and the message-errors test fail with the resolver and the
  message path sabotaged (3 of 11 red), green restored.
- No Polish outside message dictionaries; the language gate passes on the diff.
- Versions: charts 0.1.3, ui 0.1.9 (package.json, package-lock, CHANGELOG).
