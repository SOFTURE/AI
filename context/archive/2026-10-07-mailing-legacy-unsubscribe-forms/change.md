---
change_id: mailing-legacy-unsubscribe-forms
title: "Legacy unsubscribe links with optional params, a no-oracle one-click answer, and the verified link in onUnsubscribed"
status: archived
roadmap_item: null
issue: "#211"
branch: claude/project-thread-wr7nc1
created: 2026-10-07
updated: 2026-10-07
archived_at: 2026-10-07
---

## Intent

Close [issue #211](https://github.com/SOFTURE/AI/issues/211). An app that issued two unsubscribe link forms on one
path (a signed `?u=<id>&t=<hmac>` and a bare `?t=<token>`) and records opt-outs on its own consent row can move its
unsubscribe page and one-click route onto `@softure-ai/mailing` without breaking either form.

After this change:

1. `legacyUnsubscribe.params` also takes `{ required, optional }`: a link is legacy when it carries every required
   name; optional names that are present are passed to `verify` too. The array form keeps its meaning (all required).
2. `mailing({ oneClickInvalidLinkStatus: 200 })` makes the one-click route answer 200 for a link that does not
   verify (no oracle on whether a token is live). The default stays 400; 500 stays for failures. The page keeps
   its message.
3. `onUnsubscribed` receives the verified link: `event.link` is `{ scheme: "signed" }` or
   `{ scheme: "legacy", values }`, so the app's hook can find the row the legacy link named.

## Context

Point by point from the issue:

1. `readUnsubscribeLink` (`modules/mailing/src/server/unsubscribe-link.ts`) returns `null` unless every name in
   `legacy.params` is present, so `["u", "t"]` drops the bare-token form and `["t"]` never gives `verify` the `u`.
2. `postUnsubscribeRoute` (`modules/mailing/src/next/route.ts`) answers 400 for `mailing.invalid_link`.
3. `unsubscribe` (`modules/mailing/src/server/suppressions.ts`) calls the hook with `{ recipientKey, source }` only.

## Constraints

- Backwards compatible: existing configs (array `params`, no new option, hooks that ignore `link`) behave as today.
- Touches `modules/mailing/` only (source, tests, README) and this change folder. Issue #212 changes the same
  package in a parallel thread: merge master before merging.
- One release of the package covers this change and #212; it is cut by whichever thread merges second.

## Notes

- Placement: unlinked (`roadmap_item: null`): the project works from GitHub issues, not a roadmap.
- Research and framing are skipped: the issue names the three code paths and proposes the shapes; each is one
  function and one schema field, read in full while writing this file.
- Archived 2026-10-07: optional legacy params, `oneClickInvalidLinkStatus` and `event.link` in `onUnsubscribed`.
