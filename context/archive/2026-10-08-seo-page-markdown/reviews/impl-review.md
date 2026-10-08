# Implementation review: seo-page-markdown

Reviewed: the branch diff against `plan.md` (both phases), `change.md` and issue #249; the code read
adversarially for the request path an agent, a browser and an attacker would take.

Verdict: **approved after fixes** (1 critical and 2 warnings fixed in this change, 1 note accepted).

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| F1 | Critical | `new URL(pathname, selfOrigin)` reads a request for `https://site//evil.example/x` (pathname `//evil.example/x`) as the host `evil.example`: with an app predicate that accepts any path (`paths: () => true`) the proxy would fetch an outside host and return its page as the site's Markdown. The default sitemap check happens to refuse it (`buildCanonicalUrl` throws, reported as an error), but only by accident. | Fixed: such a path answers `null` before any check, and the render URL is built by setting `pathname` on `selfOrigin`. Test "never renders a path that reads as another host" seen red without the fix, green with it. |
| F2 | Warning | Plan D7 dropped every `header` and `footer` inside `<main>`, as the adopting app does. In a generic package that deletes an article's own `<header>` (its `<h1>` and byline) and `<footer>` (its sources), which is content. | Fixed (drift from D7, recorded here): only a header or footer that is a direct child of the root is dropped; one inside an article or section stays. Test added; README says so. |
| F3 | Note | `x-markdown-tokens` on HEAD describes a body that is not sent. | Accepted: it is the size the GET would have, which is what a client asks HEAD for. |
| F4 | Warning | `onError` reported the error's class only (`errorLogLabel`): a refused render logged `TypeError`, which does not say that `selfOrigin` is wrong. `errorLogLabel` is meant for paths with personal data; this one has none. | Fixed: the message and its cause's (`fetch failed (connect ECONNREFUSED 127.0.0.1:4100)`), asserted exactly, as the blog's Markdown piece logs. |

Checked and fine:

- Plan coverage: `prefersMarkdown` (root), `htmlToMarkdown` (`/server`), `createPageMarkdown` (`/proxy`), the
  `./proxy` export, `module.json` and the manifest's `middleware` mount line, README (what it provides,
  installation, a "Markdown for agents" section with the chain order, options, limitations), CHANGELOG 0.1.7,
  version 0.1.7 in `package.json`, `module.json` and the factory.
- Every Progress item is real: tests were seen red (missing exports, then the F1 sabotage) before green.
- The internal render sends only `accept` and the marker header (asserted exactly), so no visitor cookie or
  authorization reaches it; the query is dropped; `redirect: "manual"` keeps a redirect for the page to answer.
- No loop: the render asks for HTML and carries the marker, and the piece skips both.
- Concurrency: the sitemap cache holds the pending read (asserted: two concurrent requests, one contributor
  call); `buildSitemap` never rejects, so a cached failure cannot stick past `cacheSeconds`.
- An app predicate that throws is caught and reported, never a 500 from the proxy.
- English-only text; no new environment variable (`PORT` is only read for the default `selfOrigin`).
