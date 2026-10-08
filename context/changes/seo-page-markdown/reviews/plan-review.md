# Plan review: seo-page-markdown

Reviewed: `plan.md` against `change.md`, issue #249, the adopting app's three files, `@softure-ai/blog/proxy`
(`createBlogMarkdown`), `modules/seo/src/sitemap.ts` and docs/02-module-standard.md §8.

Verdict: **approved with fixes applied** (2 warnings, 2 notes; no blocker).

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| F1 | Warning | The plan did not say where the piece goes in the app's proxy chain. Before the blog's Markdown piece it would render an article page that the blog answers better from the stored text; after a route guard it never runs for a guarded path (fine, but a guard that redirects unknown paths would swallow it). | Fixed: README mounting shows the chain `blogMarkdown → pageMarkdown → guard`. |
| F2 | Warning | A plain TTL cache rebuilt on expiry lets every request that arrives during the rebuild run the contributors again (a database read per request under load). | Fixed: the cache holds the pending promise; a test asserts two concurrent requests call a contributor once. |
| F3 | Note | Every request with `Accept: text/markdown` costs a full render of the page. A scanner hits each page a few times; this is the same cost the adopting app runs today. | Accepted as is; the README's limitations section says the answer is not cached (`private`). |
| F4 | Note | The internal request goes back through the app's proxy. Pieces that act on every request (channel tagging, rate limits) see a loopback request with no query and no cookie; a `?tag=` is dropped by D4, so nothing is counted twice. | Accepted; covered by D4 (query dropped, marker header). |

Checked and fine: the phase order (pure pieces first, then the piece that uses them), each phase's done-when is
a command, no migration, no new environment variable (`PORT` is read only for the default `selfOrigin`), the
English-only rule, backward compatibility (nothing runs unless the app chains the piece), and one copy of
`node-html-parser` in the tree (6.x, the major `node-html-markdown` 2.0.0 asks for).
