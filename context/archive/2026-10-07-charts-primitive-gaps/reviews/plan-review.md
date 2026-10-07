# Plan review: charts-primitive-gaps

Reviewed: `plan.md` (one phase) against `change.md`, issue #221 and the current sources of `@softure-ai/charts`
(`src/svg/flag.tsx`, `value-axis.tsx`, `pin.tsx`, `lines.tsx`, `line-chart.tsx`, `src/index.ts`, `styles.css`,
`tests/architecture.test.ts`). Mode: autonomous (the thread decides).

Verdict: **ready after the fixes below** (applied to `plan.md` or binding for implementation).

## Findings

### F1 (Warning, applied): the token guard does not see a `var()` with a fallback

**Evidence:** `tests/architecture.test.ts` finds the tokens a stylesheet reads with `/var\((--sft-[a-z0-9-]+)\)/`.
D3's `var(--sft-chart-pin-line, var(--sft-chart-cursor))` ends the name with a comma, so the guard reads only the
fallback and a misspelt first name would pass unseen.

**Fix:** widen the pattern to a name followed by `)` or `,`, add `--sft-chart-pin-line` to `LOCAL_PROPERTIES`, and
plant a fallback form in the guard's own test.

### F2 (Suggestion, applied): export the new types

**Evidence:** `src/index.ts` exports every prop type of the primitives (`ChartPinRing`, `ChartPinSize`, …).

**Fix:** export `ValueAxisNarrow` and `ChartPinClassNames` as well.

### F3 (Suggestion, applied): `LineChart` keeps its look

**Evidence:** `LineChart` renders `ValueAxis` without `narrow` and placed flags only (`xPercent` given).

**Fix:** nothing to change; the existing `line-chart.test.tsx` expectations are the regression check (they must stay
untouched).

### F4 (Suggestion, kept as decided): `ValueTick.minor` instead of `narrow`

The issue offers either. `narrow` keeps the choice on the axis, where the horizontal axes keep it too; a per-tick
flag would need every caller of `valueAxisTicks` to set it. D2 stands.

## Not found

No migration, no copy, no change to `@softure-ai/ui`; backward compatibility holds since every option is optional
and the CSS change only affects free flags, which are `position: static` unless an app places them.
