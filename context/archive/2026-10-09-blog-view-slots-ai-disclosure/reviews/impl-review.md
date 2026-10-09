---
change_id: blog-view-slots-ai-disclosure
reviewed: 2026-10-09
verdict: approved
---

# Implementation review: blog-view-slots-ai-disclosure

Checked the diff against plan.md (decisions 1 to 9), issue #317 and the repository rules.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Without `classNames`, `unstyled` or `layout` the views write the same markup as 0.1.10: `tests/next/pages.test.tsx` and the other page tests pass unchanged, and the first test of `adoption-gaps-317.test.tsx` pins the frame and the lead card. | No change. |
| 2 | Check | The architecture test still sees every `blog-*` class: it now reads `BLOG_SLOT_CLASSES` as well as the remaining literals, and every default has a rule in `styles.css`. | No change. |
| 3 | Warning | `aria-labelledby` ids such as `blog-sources` stay `blog-*` under `unstyled`; they are ids, not classes, and the app's CSS does not target them. | No change; the test counts classes only. |
| 4 | Check | `/server` gained no Next import: `getPageContext` and the body helpers moved to `src/server/`, `/next` re-exports them, and the test asserts both entries export the same functions. | No change. |
| 5 | Check | The default OG card is unchanged: `muted` falls back to the foreground. A card with a logo renders different bytes. | No change. |
| 6 | Suggestion | The AI disclosure is on the method page only; a per-article note would need its own copy and placement. | Out of scope (plan decision 6); an app adds a note through the node disclaimer. |
| 7 | Check | Polish copy only in `messages/pl.ts`; `npm run lint` (language gate included) is green. Version 0.1.11 in `package.json`, `module.json`, `src/index.ts` and `package-lock.json`; CHANGELOG and README updated. | No change. |

Gates: `npm run typecheck`, `npm run lint` green; the blog's tests pass (624 passed, 8 skipped); `npm run build`
and the full `npm test` run before the push.
