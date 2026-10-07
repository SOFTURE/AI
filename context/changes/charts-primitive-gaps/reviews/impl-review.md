# Implementation review: charts-primitive-gaps

Reviewed: the branch diff against `plan.md` (phase 1) and issue #221: `foundation/charts/{styles.css,
src/svg/value-axis.tsx, src/svg/pin.tsx, src/index.ts, tests/*, README.md, CHANGELOG.md, package.json}`. Mode:
autonomous.

Verdict: **approve**. No open blocking finding.

## Against the plan

| Item | Status |
| --- | --- |
| D1 free flag `top: auto` | done; the placed flag's rule and specificity are unchanged |
| D2 `ValueAxis narrow` | done; default `alternate`, `isMinorValueTick` untouched, `LineChart` passes no `narrow` |
| D3 `ChartPin classNames`, dash on the column, `--sft-chart-pin-line` | done |
| D4 `opacity` docs | done (options table) |
| F1 token guard reads a `var()` with a fallback | done, with a planted case |
| F2 new types exported | done (`ValueAxisNarrow`, `ValueAxisProps`, `ChartPinClassNames`) |

## Findings

### R1 (Suggestion, kept): the token shares its name with the line's class

`--sft-chart-pin-line` (a custom property) and `.sft-chart-pin-line` (the class) read alike. They live in different
namespaces and the token names exactly what it colours, as `--sft-chart-cursor` does for the cursor; kept.

### R2 (Suggestion, kept): a dash set on a wrapper above the pin no longer reaches it

The column now declares the dash, so a value on an ancestor is shadowed. Before, the line declared it, which shadowed
an ancestor just the same; no behaviour is lost, and a class on the column (the new, documented place) works.

## Tests

- The five new tests in `tests/primitives.test.tsx` failed before the code (seen red: 5 failed, 144 passed) and pass
  after it.
- Existing markup expectations (pins, flags, value axis, `LineChart`) are unchanged and green: without the new
  options the markup is byte-identical.
- Gates: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
