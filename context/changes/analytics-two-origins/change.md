---
change_id: analytics-two-origins
title: "Analytics works for an app served on two first-party origins behind a proxy"
status: plan_reviewed
roadmap_item: null
issue: "#210"
branch: claude/project-thread-j326cn
created: 2026-10-07
updated: 2026-10-07
---

## Intent

Close [issue #210](https://github.com/SOFTURE/AI/issues/210). An app served on two first-party origins (public
pages on the apex, the product on `appOrigin`) behind a reverse proxy must count its funnel and keep its channel
tag across both. After this change:

1. The funnel endpoint counts beacons and pixels sent from a page on any configured first-party origin, even
   when `request.url` carries the server's internal host (Next builds it from the bound host and port).
2. `createChannelTagger.tag` redirects on the request's public origin (from `Host`, preferring the scheme in
   `X-Forwarded-Proto`) when that origin is configured, and on `appOrigin` otherwise; it never moves a visitor
   to another host. `carry` keeps a relative `Location` relative.
3. A tag crosses from one first-party origin to the other: the server accepts a `Referer` from any configured
   origin, and the browser keeper adds the remembered tag to links that lead to another configured origin
   (the browser's default referrer policy strips the query from a cross-origin `Referer`).
4. The tagger takes `channelFromReferer`, so a navigation from an untagged first-party page can be tagged with
   the channel its path implies (an article page → `blog`).
5. `<FunnelPixel>` takes `className`, decodes asynchronously and, without a class, stays out of the layout.
6. `funnel.isKnownChannel(channel, ctx)` lets the app mark a channel it knows from its own tables as known, so
   the daily cap on new channels never folds it into the overflow key.

## Context

Research done on the module itself (all code paths read for this change, they are five files):
- `modules/analytics/src/server/channel.ts`: `isFirstParty` accepts `appOrigin`, the request URL's origin, or
  the `Host` when there is no request URL. `readChannel` uses it for the `Referer`.
- `modules/analytics/src/server/endpoint.ts`: `readVisit` accepts a `Referer` only from `appOrigin` or
  `new URL(request.url).origin`; behind a proxy the latter is the internal host, so a page on a second origin
  never counts (issue point 1, measured on Next 16).
- `modules/analytics/src/proxy/index.ts`: `tag` builds the target on `appOrigin` (point 2); `carry` resolves a
  relative `Location` against `request.url`, which behind a proxy is internal, and writes it back absolute.
- `modules/analytics/src/client/channel-keeper.ts` and `src/next/channel-keeper-client.tsx`: the keeper only
  restores the tag on the address bar; it knows no other origin.
- `modules/analytics/src/server/funnel.ts`: the cap's "known channel" is a row in `funnel_counts` only.
- `modules/analytics/src/next/funnel.tsx`: the pixel is a bare inline `<img>`.

Browser fact the design depends on: with the default `Referrer-Policy: strict-origin-when-cross-origin`, a
navigation from `https://apex/?z=fb` to `https://app.apex/register` sends `Referer: https://apex/` only, so the
server alone cannot carry a tag across origins (point 3 needs the browser keeper, or a looser policy on the
apex pages).

## Constraints

- Every default keeps today's behaviour: an app without `origins`, `channelFromReferer` for the tagger,
  `isKnownChannel` or a pixel `className` behaves as on 0.1.7 (one exception, a fix: `carry` keeps a relative
  `Location` relative instead of resolving it against the internal request URL).
- The `Host` header is client input: it only selects among configured origins, never creates a new target.
- No migration. Touches `modules/analytics/` and this change folder only.
- Release analytics 0.1.8 through auto-release after the merge (no other open work changes the package).

## Notes

- Placement: unlinked (`roadmap_item: null`), an adoption issue; the project works from issues, not roadmaps.
- Research folded into Context: the change is confined to one module whose relevant files were all read.
- Framing skipped: the issue reports measured failures with proposed shapes; the only open question (how a tag
  crosses origins under the default referrer policy) is settled in Context and the plan.
