---
change_id: core-request-origin-rule
status: archived
---

# Plan: one request-origin rule in core (issue #311)

Input: change.md. Complexity: medium (one core phase, four module phases, docs).

## Today (master `e13ae0c`)

| Copy | Host | Scheme | Bad value | Gate |
|---|---|---|---|---|
| auth `proxy/index.ts` `findPublicOrigin` (private) | first `X-Forwarded-Host`, else `Host`, else URL | first `X-Forwarded-Proto` (any value), else URL | `null` (strict `http(s)://host[:port]` check) | origin used only when in `trustedOrigins` (guard option), else `appOrigin` |
| agent-ready `origins.ts` `readRequestOrigin` (exported) | `Host`, else URL | first `X-Forwarded-Proto` if http(s), else URL | throws (`new URL`) | none: `requestOrigin` of root documents; app origin from the `resolveAppOrigin` option |
| mcp-access `origins.ts` `readRequestOrigin` (exported), `readRequestHost` | `Host`, else URL | same as agent-ready | throws | `resolveAppOrigin` option; consent `Origin` check on `readRequestHost` only (#294 decision 2) |
| analytics `server/channel.ts` `readPublicOrigin`, `proxy` `readOwnOrigin` | `Host`, else URL | first `X-Forwarded-Proto` picks among configured candidates | `null` | only configured first-party origins (`appOrigin` + `analytics({ origins })`) |

`getRequestOrigins` (mcp-access `next/context.ts`) is used by the consent page and the setup action but not
exported from `@softure-ai/mcp-access/next`.

## Decisions

1. **Core API** (`foundation/core/src/origins.ts`, root entry):
   - `OriginRequest`: `{ url: string; headers: { get(name): string | null } }` (a `Request`, or Next's `headers()`
     with a URL).
   - `parseOrigin(value)`: the normalized origin when the text is exactly `http(s)://host[:port]` (a trailing `/`
     allowed), else `null`. Auth's strict check, so a path, query, fragment, credentials or spaces are no origin.
   - `readRequestHost(request, { forwardedHost? })`: the first `X-Forwarded-Host` value when `forwardedHost` is set,
     else the first `Host` value, else the URL's host; trimmed and lowercased.
   - `readRequestOrigin(request, { forwardedHost? })`: scheme = the first `X-Forwarded-Proto` value when it is
     `http` or `https`, else the URL's scheme; host = `readRequestHost`; `parseOrigin` of the two, so `null` for a
     host that is no host.
   - `getTrustedOrigins(config, extra?)`: `appOrigin`, `config.origins.trustedOrigins`, then `extra` (each through
     `parseOrigin`, a bad entry throws by name), without repeats.
   - `resolveAppOrigin(config, request, { trustedOrigins? })`: the request's origin read with `forwardedHost` when it
     is one of `getTrustedOrigins(config, trustedOrigins)`; else, with `config.origins.trustRequestHost`, the
     request's origin read without it (when it parses); else `config.appOrigin`. Never throws for a request value.
2. **`X-Forwarded-Host` only behind a list.** A client can send `X-Forwarded-Host` through a proxy that does not
   overwrite it, so it may only pick among listed origins. `trustRequestHost` trusts what the old
   `resolveAppOrigin: readRequestOrigin` trusted (`Host`, `X-Forwarded-Proto`), nothing more. The #294 consent check
   keeps reading `Host` only.
3. **Config:** `SoftureConfig.origins: { trustedOrigins: readonly string[]; trustRequestHost: boolean }`, input
   optional (`origins?: { trustedOrigins?, trustRequestHost? }`), defaults `[]` / `false`, each entry validated like
   `appOrigin` (at most 16), frozen.
4. **Modules:**
   - auth guard: `resolveAppOrigin(config, request, { trustedOrigins: options.trustedOrigins })`; the guard option
     stays (validated as today, at guard creation).
   - agent-ready: app origin = the `resolveAppOrigin` option when it answers, else the `appOrigin` option, else
     core `resolveAppOrigin(config, request)`. `readRequestHost` / `readRequestOrigin` exports become core's
     (`readRequestOrigin` may now answer `null`, which a resolver may return anyway); the internal `requestOrigin`
     still throws by name for a malformed `Host` (the 500 test stays).
   - mcp-access: the same for `resolveMcpOrigins` (no request: `config.appOrigin`); `findServedResourceOrigin` and the
     consent check use core `readRequestHost` (no forwarded host). `getRequestOrigins` exported from `/next`.
   - analytics: first-party origins = `getTrustedOrigins(config, analytics({ origins }))`; `readPublicOrigin` and the
     proxy's `readOwnOrigin` read host and scheme through core.
   - `Vary` of agent-ready and mcp-access discovery answers adds `x-forwarded-host`, since a listed origin can now be
     picked by it.

## Phase 1: core (TDD)

Files: `foundation/core/src/origins.ts`, `src/config.ts`, `src/index.ts`, `tests/origins.test.ts`,
`tests/config.test.ts`.
Tests first: each function's rule and edge cases (forwarded host on/off, a list in headers, non-http(s) proto,
`localhost` without proto, uppercase host, malformed host, a host smuggling a path or credentials, trailing slash),
`resolveAppOrigin` for listed / unlisted / trustRequestHost / spoofed `X-Forwarded-Host`, and the config block
(defaults, bad entries refused, frozen).

## Phase 2: modules (TDD)

Files: the module sources named in decision 4 and their tests. Tests first, red on master: auth redirects to an
origin listed only in `config.origins`; agent-ready and mcp-access serve a listed origin picked by the request
without a `resolveAppOrigin` option, and keep `appOrigin` for an unlisted one; `trustRequestHost` reproduces the
old resolver; analytics accepts a page on an origin listed only in `config.origins`; `getRequestOrigins` importable
from `/next`. Existing tests stay, except the `Vary` value.

## Phase 3: docs and versions

Core README section "Request origins"; the module READMEs point to `origins`; CHANGELOG sections; versions per
change.md, the modules' core range `^0.1.8`, `package-lock.json`.

Done when: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` are green.

## Progress

- [x] Phase 1: core rule and config block
- [x] Phase 2: auth, agent-ready, mcp-access, analytics on the core rule
- [x] Phase 3: docs, versions
