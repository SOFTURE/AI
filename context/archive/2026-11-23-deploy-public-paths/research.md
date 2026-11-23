# Research: deploy-public-paths

## Findings

1. `tools/deploy/templates/deploy.json.tmpl` writes `verify.routes`: `/api/health` when `facts.hasHealthRoute`
   (`@softure-ai/ops` is a dependency), then always `{ "path": "/", "excludes": ["Application error"] }`. The template
   renderer only knows whole-line sections, so a list whose entries are optional is easier to render from a value
   built in `generate.ts` than with sections (comma placement).
2. `tools/deploy/src/verify/schema.ts`: `deploySchema` is a strict object (`$schema`, `releases`, `database`, `data`,
   `hooks`, `verify`); an unknown key fails. `schema/deploy.schema.json` is written by `npm run schema -w
   @softure-ai/deploy` and a repository test compares it with the zod schema.
3. `verify` (`src/verify/checks.ts`): `checkStatus` compares the status only; redirects are not followed, so a route
   behind Access answers 302 with `location: https://<team>.cloudflareaccess.com/cdn-cgi/access/login/...` (or
   `/cdn-cgi/access/login` on the app's host), and behind the app's login 302/303/307 to `/login` (`@softure-ai/auth`
   default `routes.login`) or `/sign-in`-like paths.
4. Public endpoints of the modules: `@softure-ai/ops` `/api/health`; `@softure-ai/mcp-access` `/api/mcp`,
   `/api/oauth/token`, `/api/oauth/register`, `/.well-known/oauth-authorization-server`,
   `/.well-known/oauth-protected-resource` (the consent page `/oauth/authorize` and its POST need the user's
   session, so they stay behind the login); `@softure-ai/mailing` `/unsubscribe`, `/api/mailing/unsubscribe`.
5. `tools/host`: `inventory/schema.ts` `access.bypassPaths` (paths `^/[A-Za-z0-9._~/-]*$`, default `[]`);
   `cloudflare/onboard.ts` `buildAccessApplications` makes one bypass application per path (domain `host/path`,
   which Access matches as a prefix). `cli/app-add-command.ts` reads repository files with `readRepositoryFile`
   (`gh api repos/<repo>/contents/<path>`, the default branch) and runs `runCloudflareStep` with the inventory app.
   `@softure-ai/host` does not depend on `@softure-ai/deploy`; it reads `deploy.json` itself (zod, loose).

## Options

- Default of "public": issue says `/` is verified only when init is told the app is public, never by default for an
  app behind a login. A whole host behind Access may have no `@softure-ai/auth`, so "public" is the `--public` flag
  only (default off), not inferred from dependencies.
- Inventory merge: union of inventory `bypassPaths` and `publicPaths` (the inventory may add more), reported both ways.
