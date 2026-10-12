---
change_id: og-font-loader-414
reviewed: 2026-10-12
verdict: approved
---

# Plan review: og-font-loader-414

Checked plan.md against change.md, research.md, issue #414 and the blog's loader, CLI and tests.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | A blog wrapper that only passes `label` must not change `createOgFontLoader`'s signature for blog callers: keep the blog's export a function taking the same options, defaulting the label, so an app passing its own `label` still can. | Taken into Phase 1. |
| 2 | Warning | `loadOgFonts` must not create its loader at import time with `process.cwd()` in a side-effect-free package (`seo` has `sideEffects: false`); create it on first call. | Taken into Phase 1. |
| 3 | Warning | The blog's `OgFontSource` is a zod output with `weight` and `style` always set; core's interface must accept it structurally (`weight?`, `style?`) so no cast is needed. | Taken into Phase 1. |
| 4 | Check | `softure-blog check` asserts the exact message; with the blog label the text is unchanged. | No change. |
| 5 | Check | The new core subpath needs `tsconfig.build.json` coverage and a `dist/og` output; `tests/repo/packages.test.ts` checks export shape. | Run repo tests in Phase 1. |

No Critical findings.
