---
change_id: mailing-unsubscribe-clean-url-556
---

# Research: mailing-unsubscribe-clean-url-556

Sources: `modules/mailing/src/next/{pages.tsx,actions.ts,route.ts}`, `src/server/unsubscribe-link.ts`,
`tests/next-unsubscribe.test.tsx`, `examples/next-app/e2e/mailing-unsubscribe.spec.ts`, Next 16.3.8
`dist/client/components/router-reducer/reducers/server-action-reducer.js` and `app-router.js`.

- The page already moves the link into hidden fields (`getUnsubscribeLinkParams`) and the action already reads the
  link from `FormData`. Proposals 1 (hidden fields) and 3 (body, not URL) of the issue are half done; the leak is the
  POST target.
- A server action posts to `state.canonicalUrl` (server-action-reducer.js:74), the page URL with its query. Without
  JavaScript React renders the action form with no `action` attribute, so the browser posts to the document URL.
  Either way the token is in the POST request line.
- Next patches `history.replaceState` after hydration; a call whose `data` carries `__NA` (Next's own history state)
  passes straight to the original (app-router.js:268-272), so `replaceState(history.state, "", url)` changes the
  address bar without a router restore or a refetch.
- The one-click route reads the link from `new URL(request.url).searchParams` and never reads the body. A mail
  client's RFC 8058 POST always has the link in the URL; the body is `List-Unsubscribe=One-Click`, which
  `readUnsubscribeLink` reads as `null`.
- The page already sets `<meta name="referrer" content="same-origin">`; the token does not leak to other origins
  through Referer.
- e2e covers the page flow (`?status=done` final URL) and the forged link on route and page; it is the place for the
  acceptance check (Playwright records the POST URL).
