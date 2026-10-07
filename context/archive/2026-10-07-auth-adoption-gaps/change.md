---
change_id: auth-adoption-gaps
title: "Logout returns to a chosen path, the route guard stays on a trusted request origin, and Vitest setup is documented"
status: archived
roadmap_item: null
issue: "#193"
branch: claude/project-thread-1b21pb
created: 2026-10-07
updated: 2026-10-07
archived_at: 2026-10-07
---

## Intent

Close [issue #193](https://github.com/SOFTURE/AI/issues/193): three gaps an adopting app found in
`@softure-ai/auth` 0.1.7, each worked around in the app today.

After this change:

1. `logoutAction` takes a return target (`logoutAction({ next })` or a `next` form field, and
   `<LogoutButton next=…>`), checked by `toSafeNextPath` like login. An OAuth consent screen's
   "sign in as someone else" logs out and lands on `/login?next=/oauth/authorize?…` without catching
   Next's internal redirect error.
2. `createAuthGuard` accepts `trustedOrigins`: when the request's public origin is one of them, the
   login redirect stays on it instead of going to `appOrigin`. An app serving the product on a subdomain
   and pages on the apex from one image redirects each host to its own login page. The README documents
   that `cookie.secure` follows `appOrigin` unless set, and when to set it.
3. The auth README documents why `dist/next/*.js` imports `next/headers` without an extension and the
   Vitest setting an app needs (`server.deps.inline`).

## Context

- `logoutAction()` (`modules/auth/src/next/actions.ts`) always redirects to `routes.afterLogout`.
- The guard (`modules/auth/src/proxy/index.ts`) builds the login URL on `config.appOrigin`, because
  behind a reverse proxy the request URL may carry an internal host.
- `getSessionCookie` (`modules/auth/src/session-cookie.ts`) defaults `secure` to `appOrigin` being https.
- `modules/auth/src/next/next-modules.d.ts` records a measurement: importing `next/navigation.js` made
  `next build` fail (MODULE_UNPARSABLE), because Next's bundler aliases only the bare specifiers. So the
  issue's first suggestion for point 3 (import `next/headers.js`) would break every app's build; its
  second suggestion (document the setting) is the one taken.

## Constraints

- Backwards compatible: `logoutAction()` with no argument and `createAuthGuard` without
  `trustedOrigins` behave exactly as in 0.1.7.
- The guard never redirects to an origin the app did not list (no open redirect through `Host` or
  `X-Forwarded-Host`).
- Touches `modules/auth/` (source, tests, README, CHANGELOG, version) and this change folder only.
- Version bump to 0.1.8; the package is released after the merge (auto-release).

## Notes

- Placement: unlinked (`roadmap_item: null`); work runs from GitHub issues, not a roadmap.
- Research is skipped: the issue names every code path (`actions.ts:239`, `proxy/index.ts:56`,
  `session-cookie.ts`), and the one open question (point 3) is answered by the measurement recorded in
  `next-modules.d.ts`.
- Framing is skipped: the issue states problem, workaround and two candidate fixes per point; the
  choice between them is a plan decision, not a question about whether to build.
- Archived 2026-10-07: `logoutAction` takes a return target, `createAuthGuard({ trustedOrigins })` keeps the login redirect on a listed public origin, and the README documents `cookie.secure` and the Vitest `server.deps.inline` setting; released as `@softure-ai/auth` 0.1.8.
