---
change_id: blog-canonical-host-links
title: "A body link to seo's canonical host counts as internal"
status: archived
roadmap_item: BF-11
branch: claude/project-thread-inu4ef
created: 2026-10-05
updated: 2026-10-05
archived_at: 2026-10-05
---

## Intent

When `@softure-ai/seo` puts the site on a canonical host other than `appOrigin` (`origin`, or `canonical.host`
apex/www), an absolute link in an article body to that host is the site's own: the renderer does not mark it
external and the quality gate counts it as internal, without the app repeating the host in `siteHosts` and
`quality.ownOrigins`.

## Context

From [`roadmap.md`](../../foundation/roadmap.md) (blog-followups), item **BF-11**:

> ### BF-11: A body link to seo's canonical host counts as internal
> - **Outcome:** the renderer's own hosts (`pages/body.ts` `siteHosts`) and the gate's own origins (`quality/settings.ts` `ownOrigins`) include core's `getSiteUrls(config).origin` next to `appOrigin`; a test covers a canonical host that differs from `appOrigin`.
> - **Risk:** low. An app can list the host in `siteHosts` and `quality.ownOrigins` today; the example's canonical host equals `appOrigin`.
> - **Source:** BF-7 `blog-seo-canonical` plan review S1.

Current state: `modules/blog/src/pages/body.ts` builds the renderer's own hosts from `input.origin` (the pages
pass `config.appOrigin`) and `options.siteHosts`; `modules/blog/src/quality/settings.ts` builds the gate's own
origins from `config.appOrigin` and `quality.ownOrigins`. Core's `getSiteUrls(config).origin` (BF-7) is seo's
site origin when the app lists `seo()`, `appOrigin` otherwise. The backlog entry is
[`backlog-input.md`](backlog-input.md).

## Constraints

- English-only code, comments and commits (AGENTS.md).
- Touches lane C (`src/quality/`) and lane D (`src/pages/body.ts`, `src/next/pages.tsx`); BF-4 and BF-8 run in
  parallel on those lanes, `master` wins on conflicts.
- The quality gate also runs in the CLI (`softure-blog check`), where `getSiteUrls` works the same (no Next).
- The blog's Next code never imports seo (architecture test); it reaches seo's rule only through core.

## Notes

- Placement: roadmap `blog-followups`, item BF-11 (taken from `context/backlog/roadmap-blog-followups/`).
- Research skipped: the gap was found by BF-7's plan review with the two files and fields named, and BF-7's
  research already covered how the blog reaches seo's rule (core's `getSiteUrls`); nothing is unknown.
- Framing skipped: the problem is not in doubt; the roadmap fixes the outcome.
- Archived 2026-10-05: the blog pages' own hosts and the gate's own origins include core's `getSiteUrls(config).origin` next to `appOrigin`; a page test and a gate test with a canonical host other than `appOrigin`; no gaps.
