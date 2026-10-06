# Implementation review: ui-color-guards

Date: 2026-10-06 · Scope: phases 1 (`10ef086`) and 2 (`b577af1`) · Verdict: approved

Checked against plan.md, the diff of `foundation/ui/src/testing/`, `foundation/ui/tests/testing-*.test.ts`,
`foundation/ui/tests/theme-contrast.test.ts`, `package.json`, the README section, and the AGENTS.md conventions.

## Plan conformance

- `./testing` is exported source → types → built file; `npm run build` emits `dist/testing/`; the root entry does not
  re-export it (test).
- Every planned helper exists with the planned defaults: CIEDE2000 metric, `minDistance` 10, visions `normal` plus
  protan, deutan and tritan; `checkThemeContrast` takes a token or a `{ tint, alpha, over }` background, `use` and
  `level`, defaults to `DEFAULT_THEME`, and returns `low-contrast`, `missing-token` and `unreadable-color` failures.
- Oracles of another kind: six Sharma et al. pairs confirmed with `colour-science`, five tritan values from
  `colorspacious`, FIRE's measured amber/red ΔE76 6.1 under deuteranopia, WCAG's #777777/#767676 boundary.
- Seen red: both helper test files failed on the missing module before the code existed; the token guard failed
  with the three `color-muted` pairs when the light token was set to `#8a8f98` in place (restored from a copy).
- One expectation was wrong, not the code: research assumed amber and red stay apart under tritan vision. Measured,
  they are 8.2 ΔE00 apart (normal vision 16.2), because tritan vision moves amber towards red. The test now uses
  red/green (collapses for deutan only) and sky blue/green (collapses for tritan only), the textbook confusion axes.

## Findings

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Suggestion | `level: "AAA"` on a `non-text` pair falls back to AA, because WCAG has no non-text AAA; a caller could read a pass as AAA. | Accepted as is: the type's doc comment says so and `getContrastLevel` never returns AAA for non-text. |
| 2 | Suggestion | `labHue` of a grey is noise (white reads about 25°), so `hueDistance` between near-greys means nothing. | Accepted as is: the same as FIRE's helper; hue checks are for chromatic palette colours. |
| 3 | Suggestion | `DEFAULT_CONTRAST_PAIRS` leaves out two faint states: the ghost button hover (`foreground/5`) and the modal backdrop (`background/80`). | Accepted as is: both sit within a few per cent of a guarded ground; adding them would guard nothing a listed pair does not. |

No Critical or Warning findings. No raw colours in `src/ui`, no runtime import of the helpers, English only. Version
0.1.6 stays within every dependent's `^0.1.0`.

## Gates

typecheck, lint, `npm test` (4003 passed, 70 skipped), `npm run build`: all green on `b577af1`.
