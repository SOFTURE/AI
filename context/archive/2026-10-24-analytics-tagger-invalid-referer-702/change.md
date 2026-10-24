---
change_id: analytics-tagger-invalid-referer-702
title: "analytics: the channel tagger passes a navigation with an unparsable Referer (issue #702)"
status: archived
roadmap_item: null
issue: 702
branch: claude/project-thread-o6ufmr
created: 2026-10-24
updated: 2026-10-24
archived_at: 2026-10-24
---

## Intent

Close [issue #702](https://github.com/SOFTURE/AI/issues/702): since 0.3.0 `createChannelTagger(config).tag(request)`
throws `TypeError: Invalid URL` on a navigation whose `Referer` does not parse (e.g. a port that is not a number),
so an app's `proxy.ts` answers 500 instead of passing the request on. `tag` must return `null` again, as in 0.2.1.

## Context

Labels: `bug`, `pkg: analytics`. Regression from #689 (`legacyParams`). No release in this change: the coordinator
releases analytics 0.3.1.

## Constraints

- Behaviour for a parsable Referer is unchanged; the `targets` predicate is still not asked about a request that
  would not be tagged.
- A bug fix starts with a test that fails without it.

## Notes

- Framing: skipped. The issue names the cause (line and condition) and the fix.
