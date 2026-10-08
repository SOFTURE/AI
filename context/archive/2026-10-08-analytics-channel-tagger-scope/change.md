---
change_id: analytics-channel-tagger-scope
title: "analytics: the channel tagger takes a target scope, stays on the request's host and exports its navigation check (issue #242)"
status: archived
roadmap_item: null
issue: 242
branch: claude/project-thread-of5x8u
created: 2026-10-08
updated: 2026-10-08
archived_at: 2026-10-08
---

## Intent

Make `createChannelTagger(config).tag` usable as an app's whole proxy tagger
([#242](https://github.com/SOFTURE/AI/issues/242)):

1. **Scope.** An app names the targets `tag` may redirect (a list of pathnames or a predicate over the target
   and the page it came from). Any other navigation passes untouched: no extra 307, no prefetch redirect.
2. **Redirect host without a proxy.** When `Host` is not a configured origin but is the host of `request.url`
   (dev server, a test stack on `localhost:<port>`), the 307 stays on the request's own origin instead of
   jumping to `appOrigin`.
3. **Navigation check.** Export the predicate `tag` uses (`isNavigation`) and document the headers it needs, so
   an app's tests can build a passing request and a proxy that strips `Sec-Fetch-*` is a known limit.

A reviewer checks the tests in `modules/analytics/tests/`, the README (§ Mounting, limits), and the CHANGELOG
entry 0.1.9.

## Context

- `src/proxy/index.ts`: `tag` = `isNavigation` → no parameter → `readRequestChannel` → 307 on
  `readPublicOrigin(config, request) ?? config.appOrigin`.
- `src/server/channel.ts`: `readPublicOrigin` reads `Host` (or the request URL's host without one) and accepts
  only configured origins.
- analytics 0.1.9 is on master and not released yet (#235); this change adds to that entry instead of bumping.

No roadmap: issues are the tracker (project rule 2026-10-07).

## Constraints

- English-only code, comments and commits; neutral wording on GitHub and in the repo.
- Backward compatible: without `targets` every path is tagged as before; a request without a `Host` header still
  redirects to a configured origin or `appOrigin` (the "internal host" test stays).
- The redirect never leaves for a host the request was not sent to (no open redirect).
- Only `@softure-ai/analytics` changes; version stays 0.1.9, released by this thread after the merge.

## Process notes

- Research: skipped as a separate artefact. The issue names the lines involved, the proxy piece is one 120-line
  file plus `readPublicOrigin`, and the reading fits in `plan.md` § Findings.
- Framing: skipped. The three asks are independent, each a small, additive option or export the issue specifies;
  there is no competing explanation to test. The alternatives (per-call scope, an option that always uses the
  request URL) are weighed in the plan's decisions.
