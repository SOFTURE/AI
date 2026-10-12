---
change_id: ui-testing-guards-403
reviewed: 2026-10-12
verdict: approved
---

# Plan review: ui-testing-guards-403

Checked plan.md against change.md, research.md, issue #403 and the files it touches.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | The static `@theme` block lives in `scripts/build-css.mjs`, not in TypeScript; the dogfood test cannot import it from src. Read the `.mjs` export or pass `allow` for the static namespaces. | Taken into Phase 3: import `STATIC_THEME` if exported, else read the script's text. |
| 2 | Warning | `index.ts` of `ui/testing` must not pull `typescript` into the package's runtime entry: only `testing/` imports it. | Taken into Phase 2; check `src/index.ts` stays untouched. |
| 3 | Warning | A class with a variable opacity (`bg-brand/(--alpha)`) or an arbitrary one (`/[0.3]`) must strip the modifier before the lookup. | Taken into Phase 1 tests. |
| 4 | Check | `findLines` already returns `file:line: text`; the new guards keep that string shape. | No change. |
| 5 | Check | No component changes, so the existing 500+ ui tests stay untouched. | No change. |

No Critical findings.
