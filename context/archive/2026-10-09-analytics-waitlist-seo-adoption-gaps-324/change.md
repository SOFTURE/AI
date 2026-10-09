---
change_id: analytics-waitlist-seo-adoption-gaps-324
title: "analytics, waitlist, seo: funnel route context, suppressed split, Markdown redirects and 404 (issue #324)"
status: archived
roadmap_item: null
issue: 324
branch: claude/project-thread-o6lgal
created: 2026-10-09
updated: 2026-10-09
archived_at: 2026-10-09
---

## Intent

Three small gaps an adopting app worked around ([#324](https://github.com/SOFTURE/AI/issues/324)):

1. `createFunnelRoute()` takes no context, so the app keeps a 1:1 copy of the route to inject a test database.
   After: `createFunnelRoute({ getContext })`.
2. `countSignupsByChannel` has no active/suppressed split, so the app reads `mailing.suppressions` and hashes
   addresses in JS. After: `countSignupsByChannel(ctx, { splitSuppressed: true })`.
3. `createPageMarkdown` returns `null` for a redirect or a 404, so the HTML page answers a Markdown request.
   After: a redirect answers as a redirect with a public-origin `Location`, a 404/410 page as Markdown with its
   status; `htmlToMarkdown` also drops a page header or footer inside a layout wrapper.

A reviewer checks the three modules' sources, `tests/adoption-gaps-324.test.ts` (analytics, waitlist), the seo and
mailing suppression tests, READMEs, CHANGELOGs and versions (analytics 0.1.11, waitlist 0.1.10, seo 0.1.8; mailing
stays on the unreleased 0.1.12).

## Context

- analytics 0.1.10 and waitlist 0.1.9 are published; mailing 0.1.12 (#322) is merged and unreleased.
- mailing 0.1.12 adds the SQL surface (`mailing.recipient_key`, `mailing.suppressed_recipients`).

## Constraints

- No breaking change: `createFunnelRoute()` and `countSignupsByChannel(ctx)` keep their behaviour and types.
- The waitlist never reads mailing's tables directly; it goes through mailing's server API.

## Notes

- `research` skipped: the issue names the files and lines; the code read is recorded in the plan.
- `frame` skipped: three concrete, confirmed gaps, nothing in doubt.
