---
change_id: seo-page-markdown
title: "seo: a Markdown version of every public page for agents (issue #249)"
status: plan_reviewed
roadmap_item: null
issue: 249
branch: claude/project-thread-t6ps47
created: 2026-10-08
updated: 2026-10-08
---

## Intent

Let `@softure-ai/seo` answer any public page asked for with `Accept: text/markdown` with the page's main content
as Markdown ([#249](https://github.com/SOFTURE/AI/issues/249)). `@softure-ai/blog` does this for its own texts;
nothing covers the landing page, pricing, legal pages and the other pages listed in the sitemap, and
agent-readiness scanners check exactly that. An adopting app carries its own copy of the negotiation, the HTML to
Markdown conversion, a route and a proxy rewrite.

The issue asks for three pieces: `prefersMarkdown(accept)`, `htmlToMarkdown(html, { root: "main" })` and a
route or proxy helper that renders the page internally and answers `text/markdown` for the paths in the sitemap
configuration.

A reviewer checks the tests in `modules/seo/tests/`, the README section, the CHANGELOG and the version bump
(seo 0.1.7).

## Context

- `modules/seo` has a pure root entry (module factory, builders), `/next` (the mounted files) and `/server`
  (IndexNow). The sitemap is `buildSitemap(settings)`: the app's entries plus contributors, run per request.
- `modules/blog/src/pages/accept.ts` has `prefersMarkdown` (explicit `text/markdown`, RFC 9110 q-values, a tie
  goes to Markdown) and `createBlogMarkdown` in `@softure-ai/blog/proxy` answers from the proxy with a Web
  `Response` (`vary: Accept`, `cache-control: private`, `x-markdown-tokens`). That is the module pattern for a
  proxy piece (docs/02-module-standard.md §8: a factory from a `/proxy` entry returning
  `(request: Request) => Response | null`, chained in the app's `proxy.ts`).
- The adopting app's version renders the page with a request to its own server (`127.0.0.1:$PORT`,
  `Accept: text/html`, no cookies), takes `<main>`, drops navigation, controls, graphics and hidden nodes, makes
  relative links absolute on the public origin and adds a frontmatter of title, description and URL.

No roadmap: issues are the tracker (project rule 2026-10-07).

## Constraints

- English-only code, comments and commits; neutral wording on GitHub and in the repo.
- Backward compatible: nothing changes for an app that does not chain the new proxy piece.
- Only `@softure-ai/seo` changes. Blog keeps its own `prefersMarkdown`: seo is an optional dependency of blog
  (`"seo": "^0.1.0?"`), so blog cannot import it from there.
  Bumps seo 0.1.6 → 0.1.7; the thread releases it after the merge.
- The page is rendered as an anonymous visitor sees it: no cookie or authorization header goes to the internal
  request, and only paths in the sitemap (or the app's own predicate) are answered, so nothing behind a session is
  reachable this way.

## Process notes

- Research: skipped as a separate artefact. The working version exists in an adopting app (three files, 314
  lines read in full) and the module pattern exists in `@softure-ai/blog/proxy`; the reading fits in `plan.md`
  § Findings.
- Framing: skipped. The issue names a concrete, already measured behaviour to move into the package, the
  scanners' check is the requirement, and the only open question (route plus rewrite versus an answer from the
  proxy) is a design decision recorded in the plan (D2).
