---
change_id: mailing-unsubscribe-clean-url-556
title: "mailing: the unsubscribe page posts to a URL without the signed token (issue #556)"
status: in_progress
roadmap_item: null
issue: 556
branch: claude/project-thread-b9guky
created: 2026-10-17
updated: 2026-10-17
---

## Intent

Close [issue #556](https://github.com/SOFTURE/AI/issues/556): the unsubscribe page renders its form on the URL that
carries the signed token (`?r=…&t=…`) and its server action posts back to that URL, so the token lands in the POST
request line (access logs, proxies, CDNs) and stays in the address bar and browser history.

## Context

mailing 0.2.1 is the latest on npm and on master. Labels: `security`-adjacent bug in `pkg: mailing`. Releases are
batched by the coordinator: no version bump here, the CHANGELOG gets `## Unreleased`.

## Constraints

- After opening an unsubscribe link and confirming, neither the POST URL nor the final URL contains `t=`.
- The RFC 8058 one-click POST (`List-Unsubscribe-Post`) on the route keeps working unchanged.
- Opening the page still changes nothing; the page still works without client JavaScript.
- Legacy links (`legacyUnsubscribe`) keep working on the page.
- No breaking export removal.

## Notes

- Framing: skipped. The issue names the cause, the place and the acceptance.

## Decisions (auto)

- The page's form posts to the one-click route's bare path (`routes.oneClick`) with the link in hidden fields, instead
  of the server action. A Next server action always posts to the document URL (query included) and without
  JavaScript the browser does the same; a plain form with an explicit `action` is the only way the POST URL is clean
  in every browser.
- The route tells the two callers apart by where the link is: in the URL (a mail client's one-click POST, unchanged)
  or, with no link in the URL, in a form body (the page's submit), which it answers with a 303 to the page's outcome
  (`?status=done|invalid|failed`), exactly what the server action did.
- A small client component strips the link's parameters from the address bar after load (`history.replaceState`
  with the current state, so Next's router is not involved). Without JavaScript the address bar keeps them, as before.
- `unsubscribeAction` stays exported and unchanged (it already reads the link from the form body) for apps with a
  form of their own; the package page no longer uses it.
- A database failure still brings the form back with the link (`?status=failed&r=…&t=…`), so the person can retry;
  the client component strips it again. This is the same exposure as the mail link's own GET.
