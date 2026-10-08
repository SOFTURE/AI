# Plan: seo-page-markdown

Input: change.md (research and framing skipped, reasons there). Complexity: medium (one package, two phases).

## Goal

`@softure-ai/seo` exports `prefersMarkdown(accept)` (root), `htmlToMarkdown(html, options)` (`/server`) and
`createPageMarkdown(config, options)` (new `/proxy` entry): a proxy piece that answers a GET or HEAD of a sitemap
page asked for with `Accept: text/markdown` by rendering the page internally and returning its `<main>` as
Markdown. Tests, README, CHANGELOG, seo 0.1.7.

**Out of scope:** a `<link rel="alternate" type="text/markdown">` in page metadata (not asked for; agents send
`Accept`); moving the blog's own Markdown onto this piece (the blog answers from its stored text, which is better
than a render).

## Findings (the reading behind the plan)

- The adopting app's negotiation is identical to `modules/blog/src/pages/accept.ts` (`prefersMarkdown`). Same
  rule here, so a client gets the same answer from both pieces.
- The adopting app's converter uses `node-html-parser` (DOM subset, `querySelectorAll`, `remove`) and
  `node-html-markdown` 2.0.0 (which itself depends on `node-html-parser` ^6.1.13). Same pair here, same major of
  the parser, so the tree has one copy.
- The adopting app rewrites in its proxy to an internal `/api/markdown` route because a Next rewrite needs
  `NextResponse`. A Next 16 proxy can return a plain `Response`, which `createBlogMarkdown` already does, so the
  module answers from the proxy itself: no route to mount, no rewrite, no `next` import.
- Measured in the adopting app: the internal render must go to the server's loopback address
  (`http://127.0.0.1:$PORT`); the request's own URL behind a reverse proxy is the public host. A first render of a
  redirect can carry two `location` headers that `fetch` joins as `"/a, /a"`.
- `buildSitemap(settings)` runs contributors per call (they may read a database) and returns canonical URLs.

## Key decisions

- **D1** `prefersMarkdown` in the root entry (pure); `htmlToMarkdown` in `/server` (it pulls the HTML parser, which
  the config-time root entry should not). The proxy piece in a new `/proxy` entry, the module standard's place.
- **D2** Answer from the proxy (`(request: Request) => Promise<Response | null>`), not a route plus rewrite: no
  mount, no `next` dependency, the address stays the page's own. A `middleware` mount line in `module.json`
  like the blog's.
- **D3** Which paths: by default exactly the sitemap (the app's entries plus contributors), compared by canonical
  URL, so the trailing slash and host rules apply as in the sitemap. The sitemap is cached for
  `cacheSeconds` (default 60, `0` turns the cache off) because contributors may read a database and the proxy
  runs on every request. An app can pass `paths: (pathname) => boolean | Promise<boolean>` instead. The cache holds the pending
  build, so concurrent requests share one sitemap read (plan review F2); a contributor that failed is missing
  only until the cache expires (`buildSitemap` logs and skips it).
- **D4** The internal render: `GET <selfOrigin><pathname>` with `accept: text/html` and only that (no cookie,
  no authorization: the anonymous page, never one behind a session), `redirect: "manual"`, `cache: "no-store"`,
  and a marker header `x-softure-seo-markdown: 1` that the piece itself skips, so even an odd `Accept` cannot loop.
  `selfOrigin` defaults to `http://127.0.0.1:${PORT ?? 3000}`. The query string is dropped: one Markdown per
  address.
- **D5** Anything but a 200 HTML page with a `<main>` answers `null`, so the page itself answers the client (a
  redirect, a 404, an error) exactly as it would a browser; a failed fetch or a page without the root element is
  reported through `onError` (default `console.error`) with the path. No hand-built 404 or redirect: fewer ways
  to differ from the page.
- **D6** The answer: 200 `text/markdown; charset=utf-8`, `vary: Accept`, `cache-control: private, max-age=0,
  must-revalidate` (a shared cache must not hand Markdown to a browser), `x-markdown-tokens` (length / 4, as the
  blog). HEAD gets the headers without a body.
- **D7** `htmlToMarkdown(html, { root = "main", origin, url, remove = [], frontmatter = true })` returns
  `string | null` (`null` when the root element is missing). It removes header, nav, footer, script, style, svg,
  noscript, template, button, form, dialog, `[hidden]`, `[aria-hidden="true"]` plus the app's `remove` selectors;
  makes root-relative links (and image sources) absolute on `origin` when given; the frontmatter has `title`,
  `description` and `url` (the page's canonical link, else `url`), JSON-quoted. `root: null` converts the whole
  input (a fragment), and `frontmatter: false` leaves the frontmatter out. The proxy passes the site origin and
  the canonical URL of the path.

## Phase 1: negotiation and conversion (TDD)

- Tests: `tests/accept.test.ts` (explicit `text/markdown`, `*/*` and browser headers refused, q-values, tie,
  `q=0`, `null`, malformed parts); `tests/html-to-markdown.test.ts` (main only, removed elements, `remove`
  option, links and images absolute, frontmatter from title/description/canonical, quotes in the title, no
  `<main>` → `null`, `root: null` fragment, `frontmatter: false`).
- Code: `src/accept.ts`, `src/server/html-to-markdown.ts`, exports, `package.json` dependencies and the
  lockfile.

Done when: the new tests were seen red, then green; typecheck and lint green.

## Phase 2: the proxy piece (TDD)

- Tests (`tests/page-markdown.test.ts`, `fetch` injected): a sitemap page with `Accept: text/markdown` → 200
  Markdown with the headers; HEAD → no body; a browser `Accept` → `null` and no fetch; a path outside the sitemap
  → `null`; a contributor's path → answered; the internal request carries no cookie and the marker header and
  goes to `selfOrigin`; a page 3xx/404/500 → `null`; a fetch that throws → `null` and one `onError` line; a page
  without `<main>` → `null` and `onError`; the marker header → `null`; POST → `null`; `paths` predicate replaces
  the sitemap; the sitemap cache (a contributor is called once within `cacheSeconds`, again after; two concurrent
  requests call it once).
- Code: `src/proxy/index.ts`, `package.json` export `./proxy`, `module.json` and the factory's manifest mount
  line, README (what it provides, mounting with the chain order after the blog's Markdown piece and before a
  route guard, plan review F1; limitations), CHANGELOG 0.1.7, versions 0.1.7, lockfile.

Done when: the new tests were seen red, then green; gates green (typecheck, lint, test, build).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: negotiation and conversion

#### Automated
- [ ] 1.1 Accept and conversion tests seen red, then green
- [ ] 1.2 Typecheck and lint green

### Phase 2: the proxy piece

#### Automated
- [ ] 2.1 Proxy piece tests seen red, then green
- [ ] 2.2 Gates green (typecheck, lint, test, build)
- [ ] 2.3 README, CHANGELOG and version 0.1.7
