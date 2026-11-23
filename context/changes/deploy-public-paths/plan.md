# Plan: deploy-public-paths

## Approach

1. deploy schema: `publicPaths` (array of `/path` strings of the characters Cloudflare Access matches, unique, `/`
   only alone), JSON schema regenerated.
2. deploy verify: `checkStatus` gets the login case: expected status not 3xx, response 3xx, `location` resolves to a
   Cloudflare Access login (`*.cloudflareaccess.com` or a `/cdn-cgi/access/` path) or a login page (last segment
   `login`, `log-in`, `signin`, `sign-in`) → failed status check whose detail is `<path> is behind a login (redirect
   to <url>); list it in publicPaths or remove it from verify`.
3. deploy init: facts `hasMcpAccess`, `hasMailing`; answer `public` from `--public`; `publicPaths` written from the
   facts (or `["/"]` with `--public`); `verify.routes` = health route when present, `/` only with `--public`; an app
   with neither gets `/` and a warning that verify needs a public route (`--public` or `@softure-ai/ops`).
4. host app add: read `deploy.json` from the default branch, take `publicPaths`, merge into `access.bypassPaths` for
   the Cloudflare step; report each path taken from `publicPaths`, warn for inventory paths not in `publicPaths`, warn
   when `deploy.json` cannot be read as JSON with a list.
5. READMEs (deploy: `publicPaths`, the rule "verify only what is public; everything public is in publicPaths", the
   new message; host: bypass list default), CHANGELOG `## Unreleased` of both.

## Decisions (auto)

- `--public` is the only way to verify `/` (not inferred from a missing `@softure-ai/auth`) → an app behind Access
  may have no app login; the issue says never by default.
- `--public` writes `publicPaths: ["/"]` alone → `/` covers every path, as `--paths` already requires.
- Inventory and `publicPaths` are united, not replaced → the issue: the inventory may add more.
- No schema rule that verify routes lie under `publicPaths` → a route may deliberately check a login redirect; the
  runtime message covers the failure the issue reports.

## Phases

1. deploy schema + verify login redirect, with tests.
2. deploy init (facts, flag, template), with tests.
3. host app add merge and report, with tests.
4. READMEs, CHANGELOGs.

## Acceptance

- `init` for an app behind a login writes a `verify` without `/` and with `/api/health` when the health route exists
  (generate test).
- `app add --check` with an inventory without `bypassPaths` plans one bypass per `publicPaths` entry (CLI test with a
  fake Cloudflare).
- A verify route redirected to an Access login fails with the message (checks test with a fake response).
- `npm run typecheck`, `npm run lint`, related tests green; CI green.

## Progress

- [ ] Phase 1
- [ ] Phase 2
- [ ] Phase 3
- [ ] Phase 4
