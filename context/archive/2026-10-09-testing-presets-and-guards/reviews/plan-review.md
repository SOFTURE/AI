# Plan review: testing-presets-and-guards

Reviewed: `plan.md` against `change.md`, issue #326, the twelve architecture tests, `foundation/testing/src` and
Playwright 1.63's fixture definitions (`node_modules/playwright/lib/index.js`).

Verdict: **approve**.

## Findings

### F1 (Warning): overriding the `extraHTTPHeaders` option loses the address under `test.use` — accepted as D1
Playwright replaces a fixture with a value given in `use`. `context` and `request` read the resolved option instead.

### F2 (Warning): a recursive file walk could change what a guard checks — checked
The module folders the tests read have no subfolders; blog keeps its per-folder reads with `recursive: false`.

### F3 (Suggestion): the ui test's NON_COPY_ARIA list vs. a narrower attribute pattern — D2
The narrower pattern never matches those attributes, so the list is unnecessary.

### F4 (Suggestion): the Vitest preset must not need `vite` as a dependency — checked
It imports only types from `vitest/config`.
