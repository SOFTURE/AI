---
change_id: blog-view-slots-ai-disclosure
reviewed: 2026-10-09
verdict: approved with fixes applied
---

# Plan review: blog-view-slots-ai-disclosure

Checked plan.md against change.md, issue #317, `src/ui/*`, `src/next/*`, `src/server/*`, `options.ts`, `styles.css`,
`tests/architecture.test.ts` and `@softure-ai/ui`'s `class-names.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | Moving class literals into a map hides them from the architecture test's "every class has a rule" check, which reads `className="…"` only. | Accepted: Phase 1 extends the test to the slot map. |
| 2 | Warning | `unstyled` dropping `blog-visually-hidden` would show text meant for screen readers only. | Accepted: decision 2 keeps it unless the app maps it. |
| 3 | Warning | `layout` and `renderCard` are functions, and the config is validated data; putting them in `blog({ … })` would mix code into the config. | Accepted: they live on the context and page props (decisions 1, 4, 5), not in the config. |
| 4 | Suggestion | The issue offers moving `createOgFontLoader` to `@softure-ai/seo`. That adds a cross-package dependency for one helper. | No move: exported from `/server`, where it already lives. |
| 5 | Check | A default `muted` equal to today's label colour keeps the default card unchanged. | No change. |

No Critical findings. Research and framing skips are justified in change.md.
