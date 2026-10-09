# Plan review: charts-cursor-slots

Reviewed: `plan.md` against `change.md`, issue #301 and the current `src/cursor/chart-cursor.tsx`, `styles.css`,
`tests/cursor.test.tsx` and `tests/architecture.test.ts`. Verdict: **approved with fixes applied**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| F1 | Warning | `onActiveChange` called straight from every `setActiveIndex` site would fire on each pointer move over the same stop and on a blur with nothing active. | Fixed in the plan (D2): one `changeActive` that ignores an unchanged index; a test moves the pointer twice on one stop. |
| F2 | Warning | A tone class alone would not colour the dot, which reads `--sft-chart-series`. | Fixed in the plan (D4): `.sft-chart-fill-tone` maps the tone onto `--sft-chart-series`; both properties are already local to the stylesheet, so the architecture test holds. |
| F3 | Suggestion | `readoutClassName` as a function of the active point would let a server-free app pick a side. | Declined: `renderReadout` is a function too, so the app already wraps the cursor in its own client component and holds the index from `onActiveChange`. |
| F4 | Suggestion | With `frame={false}` the layer must not take a grid cell or push the box's height. | Covered by D3: the layer is absolute with `inset: 0`. |
