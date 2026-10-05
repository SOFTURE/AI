---
change_id: blog-canonical-host-links
title: "A body link to seo's canonical host counts as internal"
status: backlog
roadmap_item: BF-11
branch: null
created: 2026-10-05
updated: 2026-10-05
archived_at: null
---

## Intent

When `@softure-ai/seo` puts the site on a canonical host other than `appOrigin` (`origin`, or `canonical.host`
apex/www), an absolute link in an article body to that host is the site's own: the renderer does not mark it
external and the quality gate counts it as internal, without the app repeating the host in `siteHosts` and
`quality.ownOrigins`.

## Context

From [`roadmap.md`](../../foundation/roadmap.md) (blog-followups), item **BF-11**:

> ### BF-11: A body link to seo's canonical host counts as internal
> - **Change ID:** `blog-canonical-host-links`
> - **Status:** proposed
> - **Outcome:** the renderer's own hosts (`pages/body.ts` `siteHosts`) and the gate's own origins (`quality/settings.ts` `ownOrigins`) include core's `getSiteUrls(config).origin` next to `appOrigin`; a test covers a canonical host that differs from `appOrigin`.
> - **Risk:** low. An app can list the host in `siteHosts` and `quality.ownOrigins` today; the example's canonical host equals `appOrigin`.
> - **Mode:** autonomous.
> - **Source:** BF-7 `blog-seo-canonical` plan review S1.

## Constraints

- English-only code, comments and commits (AGENTS.md).
- Touches lane C (`src/quality/`) and lane D (`src/pages/body.ts`); the quality gate also runs in the CLI, where
  `getSiteUrls` works the same (no Next).

## Notes
