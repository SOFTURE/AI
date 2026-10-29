# Research: clear device data on sign-out (issue #874)

## Current state

- `@softure-ai/pwa` (master e1852f4): the root entry is environment-neutral (paths, icons, manifest, messages);
  `./react` holds the page side (`watchServiceWorker`, `useServiceWorkerUpdate`, `useIsOnline`) with every browser
  dependency injectable for tests. The worker already answers `{ type: "clear-pages" }` by deleting
  `<app>-pages-<build>`. README §11 (GDPR) names #874 as the follow-up.
- `@softure-ai/auth/next`: `logoutAction(input?: FormData | { next })` is a server action that ends the held sessions,
  clears the cookie and redirects. `LogoutButton` is a server component: a plain `<form action={logoutAction}>` with
  an optional hidden `next`. A server component cannot pass a function to the client, so a client-side hook needs a
  client component that takes the action as a prop, like the forms of `@softure-ai/auth/ui` (`OidcSignIn`,
  `LoginForm`): `./ui` imports nothing from `next/*` (docs/02 §5).
- Logging by kind: `errorLogLabel(error)` of `@softure-ai/core` gives the error's name (and SQL state), never its
  message.

## Browser APIs

- `caches.delete(name)` resolves `false` for a missing cache: nothing to report.
- `indexedDB.deleteDatabase(name)` fires `blocked` while another connection is open and finishes only once it closes;
  waiting could hold the sign-out forever, so `blocked` counts as failed (the deletion still runs later).
- Clearing one store: `indexedDB.open(name)` without a version creates a missing database; aborting the
  `upgradeneeded` transaction cancels that and the request ends in `AbortError`, read as "nothing to clear". A missing
  store (`objectStoreNames`) is skipped as well.
- `localStorage` access throws `SecurityError` where storage is blocked: a failed part, not a skipped one. Its absence
  (`undefined`) is skipped.
- `navigator.serviceWorker.controller` is `null` without a controlling worker; `postMessage` has no answer to await.
- React 19 form actions: an `onSubmit` handler that calls `preventDefault()` stops the action; a later
  `form.requestSubmit()` runs it through the normal path (pending state, redirect from a server action).

## Test tools

happy-dom 20 has no IndexedDB and no Cache Storage; the clear function takes them as injectable dependencies (as
`watchServiceWorker` does) and the tests pass small fakes. `fake-indexeddb` is not a dependency and is not needed.
