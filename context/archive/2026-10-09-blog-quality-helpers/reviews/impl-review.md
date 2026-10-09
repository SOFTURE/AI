---
change_id: blog-quality-helpers
reviewed: 2026-10-09
verdict: approved with fixes applied
---

# Implementation review: blog-quality-helpers

Checked the diff against plan.md (decisions 1 to 8), issue #318 and the repository rules.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Critical (fixed) | `findPluginBlocks` shifted `line` by the frontmatter but not the new `endLine`, so the paragraph after a block was looked up at the wrong line and `block-numbers` missed it. | Fixed: both lines shift; the "paragraph after" test fails without it. |
| 2 | Check | Without `numbers` or `facts` nothing new fires and the catalog is unchanged (`ids({})` in the settings tests, the whole blog suite green). | No change. |
| 3 | Check | `FoundBlock` gains `endLine` and `content`; the three tests that pin its exact shape now name them. The shipped skill's full-quality fixture gives the directive plugin `numbers`, so `block-numbers` counts as a built-in rule the template names. | No change. |
| 4 | Warning | Fact rules read the body only, not `summary` or `description`, which may quote the same value. | Accepted for now: documented in the README; a summary rule can follow if an app asks. |
| 5 | Check | `refresh` never opens the database (in `COMMANDS_WITHOUT_DATABASE`; the test's `openDatabase` rejects) and exits 0 with a list; a path it cannot read or `quality: false` exit 1. | No change. |
| 6 | Check | The CLI's folder reading goes through `readArticleDir`, so `check`, `publish` and `refresh` read folders exactly as the exported helper. | No change. |
| 7 | Check | `/server` gained no Next import (`static-read.ts` reads `process.env.NEXT_PHASE` only); `/next` wraps it. | No change. |
| 8 | Check | English only (`npm run lint` with the language gate green); folded into the unreleased 0.1.11 CHANGELOG section; README sections on the gate, the proxy and the app's own pages updated; skill rules table names `block-numbers`. | No change. |

Gates: `npm run typecheck`, `npm run lint`, the blog's tests and `npm run build` green; the full `npm test` runs in
the pre-push hook.
