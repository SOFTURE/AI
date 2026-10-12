---
change_id: blog-tool-blocks-413
title: "blog: a tool-block contract, directive to client island with static HTML (issue #413)"
status: planned
roadmap_item: null
issue: 413
branch: claude/project-thread-tup8hb
created: 2026-10-12
updated: 2026-10-12
---

## Intent

Close [issue #413](https://github.com/SOFTURE/AI/issues/413) (labels `enhancement`, `adoption`, `pkg: blog`): an app
that embeds interactive tools (calculators) in articles through a `::tool{…}` directive builds the mechanism around
them by hand (~300 lines): parse the attributes, render a static HTML version (for bots and the Markdown answer), and
hydrate a client island in its place on the page.

Outcome: `defineToolBlock({ name, schema, renderStatic, Island })` from `@softure-ai/blog/ui` returns a directive block
plugin. The page's server HTML holds the static version inside a mount point; in the browser the package's client
component swaps in `Island` with the parsed props. The Markdown answer carries the static version, and the quality gate
refuses a tool directive whose attributes do not fit the schema.

A reviewer checks the tool-block tests (server markup, hydration in a DOM, Markdown, gate), the README section and the
CHANGELOG `## Unreleased` entry.

## Context

blog is at 0.1.12 on master. It already has directive block plugins (#318: `syntax: "directive"`, `parseDirectiveLine`,
`block-directive`) and node segments rendered by the views (#317). This change builds on them rather than adding a
second mechanism. Releases are batched by the coordinator: no version bump, a `## Unreleased` entry.

## Constraints

- Extend the existing `BlockPlugin` contract; no breaking change to it or to the views.
- `/ui` imports nothing from Next; the client part is one small `"use client"` file.
- The static HTML is the app's own trusted output (as with every block plugin); attribute values are never put into
  markup by the package.

## Process notes

- Framing: skipped. The issue names the problem and proposes the API.

## Decisions (auto)

- The attributes are validated by a schema object (`schema`, anything with zod's `safeParse`) instead of a `parse`
  function: zod's `parse` throws on bad content, and a throwing plugin is a bug by contract. Typed structurally, so the
  app's own zod copy fits.
- The island is mounted after hydration (`useSyncExternalStore`): server HTML and the first client render are the
  static version, then `Island` replaces it. `Island` is never server-rendered, so it may use browser APIs.
- The Markdown form defaults to the static HTML (HTML is valid Markdown); `markdown(props)` overrides it.
- A new optional `BlockPlugin.validate(block)` lets any directive plugin report bad attributes through `block-directive`;
  the tool block wires its schema into it. Invalid attributes render nothing on the page (the gate refuses them before
  publish); `renderInvalid` overrides that.
- RSS items carry no body (by design, `discovery/rss.ts`), so "static HTML for RSS" needs nothing more.
