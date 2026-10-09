---
change_id: mcp-access-consent-request-host
status: archived
---

# Plan: the consent decision accepts the request's host (issue #294)

Input: change.md (research and framing skipped, reasons there). Complexity: small (one phase plus docs).

## Today (master `8d8b8e5`)

- `handleAuthorizationDecision` (`modules/mcp-access/src/server/oauth-http.ts`) resolves
  `origins = resolveMcpOrigins(config, request)` and calls `isSameOrigin(request, origins)`:
  `Origin !== null && Origin === origins.appOrigin`, else an empty `403` with `no-store`. This runs before the body
  is read.
- `origins.appOrigin` is `resolveAppOrigin(request)` when the option is set and answers, else `config.appOrigin`.
  An app that bakes a public `APP_ORIGIN` into its image and leaves `resolveAppOrigin` unset (or answers the fixed
  value) gets that origin whatever host serves the request.
- The consent form posts to a path (`<form action={routes.oauthDecision}>`, `ui/consent-form.tsx`), so the browser
  posts to the host it loaded the page from, and sends that page's origin as `Origin`.
- `readRequestHost(request)` (`src/origins.ts`, exported) is the first `Host` value, trimmed and lower-cased, else the
  URL's host.
- Tests: `tests/oauth-http.test.ts` refuses `https://evil.example` and a missing `Origin`;
  `tests/oauth-origins.test.ts` runs register → decision → token under `resolveAppOrigin: readRequestOrigin` and
  refuses an `Origin` of the configured origin when the request was served elsewhere.

## Decisions

1. **Rule.** `isSameOrigin` accepts when `Origin === origins.appOrigin`, or when `Origin` parses as a URL with an
   `http:` or `https:` scheme and `new URL(Origin).host === readRequestHost(request)`. Host only, not scheme, like
   Next's Server Action check: behind a TLS-terminating proxy the request's own scheme is not known reliably, and
   `Host` is what the browser addressed.
2. **No `X-Forwarded-Host`.** Only `Host` (through `readRequestHost`). A proxy that rewrites `Host` still has the
   first rule (`Origin` is the app origin), which covers production; trusting a forwarded header would widen the
   rule for no case the issue needs.
3. **No option.** See change.md, Constraints.
4. **The rest of the request is unchanged:** `iss`, the accepted `resource` and the redirect still come from
   `origins.appOrigin`; only the `Origin` gate is widened.

## Security

- A browser sets `Host` to the host it sends the request to and `Origin` to the page that posted. A cross-site form
  on `https://evil.example` posting to the app arrives with `Host` = the app's host and `Origin` = `evil.example`:
  neither rule matches, `403`.
- DNS rebinding (an attacker's name resolving to the app's server) can make `Origin` host and `Host` agree, but the
  browser then holds no session cookie for that name: `userId` is null and the decision only sends the person back
  to the consent page. The same holds for the strict rule's `appOrigin`, so nothing new is reachable.
- `Origin: null` (sandboxed frames, some redirects), a missing `Origin`, a malformed value and non-http(s) schemes
  are refused.

## Phase 1: widen the Origin check (TDD)

Files: `modules/mcp-access/src/server/oauth-http.ts`, `modules/mcp-access/tests/oauth-origins.test.ts`.

1. Tests first, red on master, in `oauth-origins.test.ts` under "a fixed app origin served under another host
   (#294)" (config `appOrigin` `http://localhost:3000`, no resolver, and a resolver answering a fixed public origin):
   - the browser on `http://localhost:6510` completes register → decision (`Origin` = served origin, `303`, `iss` =
     the app origin) → token (`200`);
   - refused with `403`: `Origin` of another host (`https://evil.example`) with `Host` of the served host; `Origin`
     whose host matches only `X-Forwarded-Host`; `Origin: null`; a malformed `Origin`; a non-http(s) `Origin` with
     the same host; a missing `Origin`.
   - the existing tests stay unchanged (the strict cases they pin are still refused).
2. Implement decision 1; update the JSDoc on `isSameOrigin` and `handleAuthorizationDecision`.

Done when: the accepting tests fail on master and pass after; `npm run typecheck`, `npm run lint`, `npm test`,
`npm run build` are green.

## Phase 2: docs and version

Files: `modules/mcp-access/README.md` (the decision route's `Origin` sentence and the "Origins" paragraph),
`modules/mcp-access/CHANGELOG.md` (`## 0.1.11`), version 0.1.11 in `package.json`, `module.json`, `src/index.ts` and
`package-lock.json`.

Done when: the README states both accepted forms of `Origin`, and the CHANGELOG describes the change.

## Progress

- [x] Phase 1: widen the Origin check (new tests red on master, green after)
- [x] Phase 2: docs, version 0.1.11

Gates on the branch: `npm run typecheck`, `npm run lint`, `npm run build` green; the module's 211 tests pass, and the
full `npm test` runs in pre-push. A first full run started before impl-review #1 failed the new refusal test (the
tightening landed mid-run); the module run after the fix is green.
