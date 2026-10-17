---
change_id: mailing-unsubscribe-clean-url-556
status: in_progress
---

# Plan: unsubscribe page posts to a clean URL (issue #556)

Input: change.md, research.md. Complexity: small (route branch, page form target, one client component, tests, docs).

## Phase 1: the route takes the page's submit (TDD)

Files: `modules/mailing/src/next/route.ts`, `tests/next-unsubscribe.test.tsx`.

1. Tests first: a POST to the bare route with `r`/`t` in a form body records a `page` opt-out and answers 303 to
   `/unsubscribe?status=done`; a forged body link answers 303 to `?status=invalid`; a database failure answers 303
   to `?status=failed&<link>` and logs no link; a POST with no link anywhere still answers 400; the one-click POST
   with the link in the URL is unchanged (200, `one-click`), also with a body that carries another link.
2. `postUnsubscribeRoute`: link from the URL → one-click as today; otherwise read `request.formData()` (a body that
   is not a form counts as none), and a link there → the page flow with a 303.

## Phase 2: the page posts there and strips the address bar

Files: `src/next/pages.tsx`, new `src/next/strip-link-query.tsx` (`"use client"`), tests.

1. Tests first: the form's `action` is `/api/mailing/unsubscribe` (the configured `routes.oneClick`) with
   `method="post"` and no query; the hidden fields stay; the page renders the strip component with the link's
   parameter names.
2. The client component removes those parameters from `location` with `history.replaceState(history.state, …)`.

## Phase 3: e2e and docs

Files: `examples/next-app/e2e/mailing-unsubscribe.spec.ts`, `modules/mailing/README.md`, `CHANGELOG.md`.

1. e2e: after opening the link the address bar has no `t=`; the confirm POST URL has no `t=`; the final URL is
   `?status=done`.
2. README (page and route sections), CHANGELOG `## Unreleased` with what an app changes (nothing for the package
   page; an app with its own page can drop its `replaceState` workaround and mount the package page).

## Progress

- [ ] Phase 1: route
- [ ] Phase 2: page
- [ ] Phase 3: e2e and docs
