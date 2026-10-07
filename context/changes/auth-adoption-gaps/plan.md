# Plan: auth-adoption-gaps

Input: change.md (research and framing skipped, see its Notes). Complexity: small.

## Goal

An adopting app can (1) log a user out and send them to a path it chooses, (2) keep the guard's login
redirect on the host the visitor used when that host is one it trusts, and (3) find in the README why
`cookie.secure` must sometimes be set and which Vitest setting the `/next` entry needs. Without the new
arguments nothing changes.

**Out of scope:** changing the `next/*` import specifiers (they must stay bare, see Approach), the
other modules' READMEs (the same Vitest note applies to them; this issue is auth's), a session check in
the guard.

## Approach

**Starting point:** `logoutAction()` ends the held sessions, clears the cookies and redirects to
`resolveRedirectTarget(config, routes.afterLogout)` (`modules/auth/src/next/actions.ts:231-241`). The
guard redirects to `new URL(routes.login, config.appOrigin)` (`modules/auth/src/proxy/index.ts:56`).
In Next 16's proxy, `request.url` carries the server's own hostname and port, not the public host
(`next/dist/server/lib/router-utils/resolve-routes.js`, `initURL`); Next fills `X-Forwarded-Host` from
`Host` when the front proxy did not.

**Chosen:**

1. `logoutAction(input?: FormData | LogoutInput)` with `LogoutInput = { readonly next?: string }`. A
   server action can be called by any client with any serializable argument, so the input is read as
   `unknown` and narrowed with zod (anything else counts as no target). The value goes through the same
   `nextPath` cut and `toSafeNextPath(next, routes.afterLogout)` as login, then `resolveRedirectTarget`. `LogoutButton` gets `next?: string`, rendered as a hidden field.
   Rejected: a separate `logoutToAction` (two actions for one job).
2. `AuthGuardOptions.trustedOrigins?: readonly string[]`. The guard derives the request's public origin
   from `X-Forwarded-Proto` / `X-Forwarded-Host` (first values), falling back to `Host` and then the
   request URL, and uses it only when it equals `appOrigin` or a listed origin; otherwise `appOrigin`
   as today. Entries are validated at creation (an origin, `scheme://host[:port]`, http or https; a
   trailing `/` is accepted and dropped). A forwarded host that does not parse falls back to `appOrigin`.
   Rejected: "always the request origin" (an open redirect through a spoofed `Host`), and a
   relative `Location` (the browser would resolve it on the public host, but the change would alter the
   default and every existing redirect test for no adopter that needs it).
3. Documentation for point 3 and for `cookie.secure`. Rejected: importing `next/headers.js` — the
   recorded measurement in `src/next/next-modules.d.ts` shows `next build` failing on the `.js` form.

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Logout argument | `FormData` or `{ next }` | a form posts `FormData`; app code calls it with an object, as the issue proposes | issue |
| Bad `next` at logout | falls back to `afterLogout` | same rule as login | `safe-next-path.ts` |
| Origin source | forwarded headers first, then `Host`, then URL | the URL in Next's proxy is the internal host | Next source |
| Unlisted origin | `appOrigin` | an allowlist cannot be steered by request headers | plan |
| Invalid `trustedOrigins` entry | throw at `createAuthGuard` | config errors surface at startup, like `protect` | `proxy/index.ts` |
| Version | 0.1.8 (patch, additive) | the package is pre-1.0 and versions bump by patch here | CHANGELOG |

## Phase 1: logout target, trusted origins, docs

**Discipline:** TDD. **Files:** `modules/auth/src/next/actions.ts`, `modules/auth/src/next/logout-button.tsx`,
`modules/auth/src/next/index.ts`, `modules/auth/src/proxy/index.ts`, `modules/auth/tests/actions.test.ts`,
`modules/auth/tests/guard.test.ts`, `modules/auth/tests/pages.test.tsx` (`LogoutButton` has no test
yet), `modules/auth/README.md`, `modules/auth/CHANGELOG.md`; the version commit touches
`modules/auth/package.json`, `modules/auth/module.json` and `package-lock.json`.

1. Tests, red first:
   - logout with `{ next: "/login?next=/oauth/authorize?x=1" }` and with a `FormData` `next` redirects there;
     `{ next: "https://evil.example" }`, `"//evil.example"`, an empty value and a non-object argument
     (a string, a number) redirect to `afterLogout`;
     the sessions and cookies are still cleared; no argument still gives `/login`.
   - `LogoutButton next="/x"` renders a hidden `next` input; without the prop it renders none.
   - guard with `trustedOrigins: ["https://example.com"]`: `X-Forwarded-Host: example.com` +
     `X-Forwarded-Proto: https` → `https://example.com/login?next=…`; `Host: example.com` with no forwarded
     headers and an `https:` URL → same; an unlisted forwarded host → `appOrigin`; without the option a
     listed-looking host → `appOrigin` (today's behaviour); a request on `appOrigin` itself → `appOrigin`;
     a malformed entry (`"example.com"`, `"https://example.com/path"`, `"ftp://x"`) throws at creation;
     `"https://example.com/"` is accepted; a forwarded host with a port matches only an entry with that port.
2. `actions.ts`: `logoutAction(input?)` as above; export `LogoutInput` type from `next/index.ts`.
3. `logout-button.tsx`: `next` prop and hidden input.
4. `proxy/index.ts`: `trustedOrigins`, origin parsing and validation, doc comments.
5. README: the logout target (server actions section), `trustedOrigins` (route guard section), the
   `cookie.secure` row and the cookie paragraph, a "Testing with Vitest" note on `server.deps.inline` and
   why the specifiers stay bare. CHANGELOG `## Unreleased`; then `npm run release:version -- auth patch`
   (0.1.8: `package.json`, `module.json`, the lockfile, the CHANGELOG heading) in its own commit.

**Done when:**
- Automated: the new tests fail before the implementation and pass after; gates green (typecheck, lint,
  test, build).
- Manual: the Vitest note is true (verified by agent: a scratch Vitest project importing the built
  `@softure-ai/auth/next` fails with `Cannot find module 'next/headers'` without the setting and loads with it).

## Risks and rollback

- An app lists an origin it does not serve: the redirect goes to a host it named itself; no third party
  can add one.
- `X-Forwarded-Host` spoofed by a client: only listed origins are ever used, so the worst case is a
  redirect to another of the app's own hosts.
- Rollback: revert the phase commit; the defaults never changed.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: logout target, trusted origins, docs

#### Automated
- [x] 1.1 New tests fail before the implementation and pass after — 33cb513 (13 red before, all green after)
- [x] 1.2 Gates green (typecheck, lint, test, build) — 33cb513 (npm test: 4516 passed, 107 skipped)

#### Manual
- [x] 1.3 The Vitest note in the README is true — 33cb513 (verified by agent: scratch Vitest project, fails without the setting, passes with it)
